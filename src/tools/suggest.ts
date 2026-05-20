import type { Tool } from './index.js';
import { suggest } from '../kiwix-client.js';

export const suggestTitles: Tool = {
  name: 'kiwix_suggest',
  description:
    'Autocomplete-style title suggestions within a ZIM. Faster and cheaper than full-text search when you just need to confirm an article title or find canonical spelling.',
  inputSchema: {
    type: 'object',
    properties: {
      zim: { type: 'string', description: 'ZIM short name or content path' },
      term: { type: 'string', description: 'Partial term to autocomplete' },
      limit: { type: 'number', description: 'Max suggestions (default 10)' },
    },
    required: ['zim', 'term'],
  },
  handler: async (params) => {
    const zim = String(params.zim);
    const term = String(params.term);
    const limit = params.limit ? Number(params.limit) : 10;
    const suggestions = await suggest(zim, term, limit);
    return {
      zim,
      term,
      suggestions: suggestions.map((s) => ({ title: s.value, path: s.path })),
    };
  },
};
