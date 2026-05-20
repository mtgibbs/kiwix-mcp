import type { Tool } from './index.js';
import { search, resolveContentPath } from '../kiwix-client.js';

export const searchKiwix: Tool = {
  name: 'kiwix_search',
  description:
    'Full-text search across the home Kiwix library. Without `zim`, searches all ZIMs (Wikipedia, Gutenberg, Wiktionary, etc.). With `zim`, scopes to one (accepts short name like "wikipedia" or "gutenberg"). Returns ranked snippets with paths you can pass to kiwix_get_article.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms' },
      zim: {
        type: 'string',
        description:
          'Optional ZIM to scope search to. Use kiwix_list_zims to discover names. Aliases: wikipedia, wikipedia_simple, gutenberg, wiktionary, wikibooks, wikiquote, wikisource.',
      },
      limit: { type: 'number', description: 'Max results (default 10, max 50)' },
    },
    required: ['query'],
  },
  handler: async (params) => {
    const query = String(params.query);
    const limit = params.limit ? Number(params.limit) : 10;
    const contentPath = params.zim ? await resolveContentPath(String(params.zim)) : undefined;
    const result = await search(query, { contentPath, limit });
    return {
      query,
      scope: params.zim ?? 'all_zims',
      total_results: result.totalResults,
      returned: result.results.length,
      results: result.results.map((r) => ({
        title: r.title,
        from_zim: r.zimTitle,
        zim_content_path: r.contentPath,
        article_path: r.url.replace(/^\/content\/[^/]+\//, ''),
        snippet: r.snippet,
        word_count: r.wordCount,
      })),
    };
  },
};
