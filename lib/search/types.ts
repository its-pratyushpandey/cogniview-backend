export type SearchCategory = "questions" | "topics" | "navigation";

export type SearchResultKind = "question" | "topic" | "feature" | "company";

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  badge?: string;
}

export interface SearchResponsePayload {
  query: string;
  categories: {
    questions: SearchResultItem[];
    topics: SearchResultItem[];
    navigation: SearchResultItem[];
  };
  meta: {
    tookMs: number;
    weakAreas: string[];
    recentActivity: string[];
    cacheHit: boolean;
  };
}
