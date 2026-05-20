import { listZims } from './list-zims.js';
import { searchKiwix } from './search.js';
import { getArticle } from './get-article.js';
import { suggestTitles } from './suggest.js';
import { searchBooks } from './search-books.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export const tools: Tool[] = [
  listZims,
  searchKiwix,
  getArticle,
  suggestTitles,
  searchBooks,
];

export async function handleToolCall(name: string, args: Record<string, unknown> | undefined) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const result = await tool.handler(args ?? {});
    return {
      content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
}
