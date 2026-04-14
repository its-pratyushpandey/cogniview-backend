import { NextResponse } from "next/server";

type DuckDuckGoResultItem = {
  Text?: string;
  FirstURL?: string;
  Topics?: DuckDuckGoResultItem[];
};

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Results?: DuckDuckGoResultItem[];
  RelatedTopics?: DuckDuckGoResultItem[];
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

function splitTitleAndSnippet(text: string): { title: string; snippet?: string } {
  const separator = " - ";
  const idx = text.indexOf(separator);
  if (idx > 0) {
    return {
      title: text.slice(0, idx).trim(),
      snippet: text.slice(idx + separator.length).trim() || undefined,
    };
  }

  return { title: text.trim() };
}

function collectResults(items: DuckDuckGoResultItem[] | undefined, max: number): SearchResult[] {
  const results: SearchResult[] = [];

  const visit = (node: DuckDuckGoResultItem) => {
    if (results.length >= max) return;

    if (node.FirstURL && node.Text) {
      const { title, snippet } = splitTitleAndSnippet(node.Text);
      results.push({ title, url: node.FirstURL, snippet });
      if (results.length >= max) return;
    }

    if (Array.isArray(node.Topics)) {
      for (const child of node.Topics) {
        visit(child);
        if (results.length >= max) return;
      }
    }
  };

  for (const item of items ?? []) {
    visit(item);
    if (results.length >= max) break;
  }

  return results;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryRaw = searchParams.get("query") ?? searchParams.get("q") ?? "";
    const query = queryRaw.trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (query.length > 200) {
      return NextResponse.json({ error: "Query is too long" }, { status: 400 });
    }

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Search provider error" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as DuckDuckGoResponse;

    const results: SearchResult[] = [];

    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || data.AbstractSource || "Overview",
        url: data.AbstractURL,
        snippet: data.AbstractText,
      });
    }

    results.push(...collectResults(data.Results, 6 - results.length));

    if (results.length < 6) {
      results.push(
        ...collectResults(data.RelatedTopics, 6 - results.length)
      );
    }

    return NextResponse.json({
      query,
      provider: "duckduckgo",
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
