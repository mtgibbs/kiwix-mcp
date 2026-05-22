import type { Tool } from './index.js';
import { getArticle as fetchArticle, viewerUrl } from '../kiwix-client.js';

export const getArticle: Tool = {
  name: 'kiwix_get_article',
  description:
    'Fetch a specific article from a ZIM and return it as clean markdown (HTML stripped, navigation chrome removed). Use the `zim` short name + `path` returned from kiwix_search.',
  inputSchema: {
    type: 'object',
    properties: {
      zim: {
        type: 'string',
        description:
          'ZIM short name (e.g. wikipedia, gutenberg) or full content path (e.g. wikipedia_en_all_nopic_2026-03)',
      },
      path: {
        type: 'string',
        description: 'Article path within the ZIM (e.g. "Linus_Torvalds" or "A/Linus_Torvalds")',
      },
      max_chars: {
        type: 'number',
        description: 'Optional cap on returned markdown length (default 30000)',
      },
    },
    required: ['zim', 'path'],
  },
  handler: async (params) => {
    const zim = String(params.zim);
    const path = String(params.path);
    const maxChars = params.max_chars ? Number(params.max_chars) : 30000;
    const article = await fetchArticle(zim, path);
    const truncated = article.markdown.length > maxChars;
    return {
      title: article.title,
      source_url: article.sourceUrl,
      // Friendly reader link — hand this to the user verbatim.
      url: viewerUrl(article.sourceUrl),
      char_count: article.markdown.length,
      truncated,
      markdown: truncated ? article.markdown.slice(0, maxChars) + '\n\n[...truncated]' : article.markdown,
    };
  },
};
