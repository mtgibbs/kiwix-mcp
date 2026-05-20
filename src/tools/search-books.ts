import type { Tool } from './index.js';
import { search, resolveContentPath } from '../kiwix-client.js';

export const searchBooks: Tool = {
  name: 'kiwix_search_books',
  description:
    'Convenience wrapper: search ONLY the Project Gutenberg ZIM. Same as kiwix_search with zim="gutenberg". Use this when looking for books/literature specifically.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms — book title, author, or topic' },
      limit: { type: 'number', description: 'Max results (default 10, max 50)' },
    },
    required: ['query'],
  },
  handler: async (params) => {
    const query = String(params.query);
    const limit = params.limit ? Number(params.limit) : 10;
    const contentPath = await resolveContentPath('gutenberg');
    const result = await search(query, { contentPath, limit });
    return {
      query,
      source: 'Project Gutenberg',
      total_results: result.totalResults,
      returned: result.results.length,
      books: result.results.map((r) => ({
        title: r.title,
        path: r.url.replace(/^\/content\/[^/]+\//, ''),
        zim_content_path: r.contentPath,
        snippet: r.snippet,
        word_count: r.wordCount,
      })),
    };
  },
};
