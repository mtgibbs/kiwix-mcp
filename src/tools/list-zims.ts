import type { Tool } from './index.js';
import { getCatalog } from '../kiwix-client.js';

export const listZims: Tool = {
  name: 'kiwix_list_zims',
  description:
    'List the offline reference libraries (ZIMs) available in the home Kiwix instance. Returns each ZIM with its short name (use this in other tools), title, language, article count, and on-disk size. Call this first if you need to know what content is available.',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => {
    const zims = await getCatalog();
    return {
      count: zims.length,
      zims: zims.map((z) => ({
        short_name: z.shortName,
        title: z.title,
        language: z.language,
        article_count: z.articleCount,
        size_bytes: z.sizeBytes,
        size_human: z.sizeBytes ? formatBytes(z.sizeBytes) : undefined,
      })),
    };
  },
};

function formatBytes(b: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}
