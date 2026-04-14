type ActionParams = Record<string, unknown>;

export async function runAction(action: string, params: ActionParams) {
  try {
    switch (action) {
      case "fetch_github_stats": {
        const { owner, repo } = params as { owner: string; repo: string };
        const response = await fetch(`/api/actions/github?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
        return await response.json();
      }
      
      case "fetch_weather": {
        const { location } = params as { location: string };
        const response = await fetch(`/api/actions/weather?location=${encodeURIComponent(location)}`);
        return await response.json();
      }
      
      case "create_todo": {
        const { text, title } = params as { text?: string; title?: string };
        const response = await fetch('/api/todo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text ?? title ?? "" })
        });
        return await response.json();
      }

      case "get_todos": {
        const response = await fetch('/api/todo', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        return await response.json();
      }

      case "update_todo": {
        const response = await fetch('/api/todo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        return await response.json();
      }

      case "delete_todo": {
        const response = await fetch('/api/todo', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        return await response.json();
      }
      
      case "calculate": {
        const response = await fetch('/api/actions/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        return await response.json();
      }
      
      case "get_time": {
        const { timezone = "UTC" } = params as { timezone?: string };
        const response = await fetch(`/api/actions/time?timezone=${encodeURIComponent(timezone)}`);
        return await response.json();
      }
      
      case "search_web": {
        const { query } = params as { query?: string };
        if (!query?.trim()) {
          return { error: "Query is required" };
        }

        const response = await fetch(
          `/api/actions/search?query=${encodeURIComponent(query)}`
        );
        return await response.json();
      }

      case "open_company_prep": {
        return {
          success: true,
          route: "/company-prep",
        };
      }
      
      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}