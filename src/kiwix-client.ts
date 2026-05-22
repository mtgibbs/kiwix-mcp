// Thin client around kiwix-serve HTTP API. Caches the catalog so we can map
// short ZIM names (wikipedia, gutenberg) to the actual dated content names
// (wikipedia_en_all_nopic_2026-03) without forcing callers to know them.

import { XMLParser } from 'fast-xml-parser';
import TurndownService from 'turndown';

// Internal base used to FETCH article content server-side (in-cluster DNS in
// prod — no public round-trip). NOT browser-reachable for end users.
const KIWIX_BASE = process.env.KIWIX_BASE_URL || 'https://kiwix.lab.mtgibbs.dev';
// PUBLIC base for links we hand to humans (kids click these). Must be the
// LAN/ingress address, NOT the internal fetch host. Defaults to the ingress.
const KIWIX_PUBLIC_URL = process.env.KIWIX_PUBLIC_URL || 'https://kiwix.lab.mtgibbs.dev';
const CATALOG_REFRESH_MS = 60 * 60 * 1000; // 1 hour

// Reduce any content reference (relative "/content/<book>/<path>" or an absolute
// URL against the internal fetch host) to just its "/content/..." path.
function contentRelPath(p: string): string {
  const m = p.match(/\/content\/.+$/);
  return m ? m[0] : p.startsWith('/') ? p : `/${p}`;
}

// PUBLIC raw-article URL (browser-reachable), regardless of the internal fetch host.
export function publicUrl(p: string): string {
  return `${KIWIX_PUBLIC_URL}${contentRelPath(p)}`;
}

// PUBLIC reader link. kiwix-serve serves the raw article at /content/<book>/<path>
// and the friendly reader UI at /viewer#<book>/<path> — we hand out the viewer
// form on the PUBLIC host, e.g.
//   https://kiwix.lab.mtgibbs.dev/viewer#wikipedia_en_all_nopic_2026-03/Cinematography
// The <book> segment carries its own date, so callers never guess it.
export function viewerUrl(p: string): string {
  return publicUrl(p).replace('/content/', '/viewer#');
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
// Strip nav/footer noise that adds tokens without information.
turndown.remove(['script', 'style', 'nav', 'footer', 'noscript', 'header']);

export interface ZimMeta {
  shortName: string; // e.g. "wikipedia_en_simple_all"
  contentPath: string; // e.g. "wikipedia_en_simple_all_nopic_2026-02"
  title: string; // e.g. "Wikipedia (Simple English)"
  description?: string;
  language?: string;
  articleCount?: number;
  sizeBytes?: number;
}

let catalogCache: { fetchedAt: number; zims: ZimMeta[] } | null = null;

async function fetchCatalog(): Promise<ZimMeta[]> {
  const r = await fetch(`${KIWIX_BASE}/catalog/v2/entries?count=-1`);
  if (!r.ok) throw new Error(`catalog fetch failed: ${r.status}`);
  const text = await r.text();
  const parsed = xml.parse(text);
  const rawEntries = parsed?.feed?.entry;
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];

  const zims: ZimMeta[] = [];
  for (const e of entries) {
    // <name> tags appear multiple times — the first one is the ZIM short name.
    const names = Array.isArray(e.name) ? e.name : [e.name];
    const shortName = String(names[0] ?? '').trim();
    if (!shortName) continue;
    const links = Array.isArray(e.link) ? e.link : e.link ? [e.link] : [];
    const contentLink = links.find((l: { [k: string]: string }) =>
      String(l['@_href'] || '').startsWith('/content/')
    );
    if (!contentLink) continue;
    const contentPath = String(contentLink['@_href']).replace(/^\/content\//, '');
    zims.push({
      shortName,
      contentPath,
      title: String(e.title ?? shortName),
      description: e.summary ? String(e.summary) : undefined,
      language: e?.['dc:language'] ? String(e['dc:language']) : undefined,
      articleCount: e?.['count:articleCount']
        ? Number(e['count:articleCount'])
        : undefined,
      sizeBytes: e?.['count:size'] ? Number(e['count:size']) : undefined,
    });
  }
  return zims;
}

export async function getCatalog(forceRefresh = false): Promise<ZimMeta[]> {
  if (!forceRefresh && catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_REFRESH_MS) {
    return catalogCache.zims;
  }
  const zims = await fetchCatalog();
  catalogCache = { fetchedAt: Date.now(), zims };
  return zims;
}

// Accept either short name, content path with date, or shorthand aliases.
export async function resolveContentPath(input: string): Promise<string> {
  const zims = await getCatalog();
  const i = input.toLowerCase();

  // 1. Exact contentPath match (already dated)
  const exact = zims.find((z) => z.contentPath.toLowerCase() === i);
  if (exact) return exact.contentPath;

  // 2. Exact shortName match
  const shortExact = zims.find((z) => z.shortName.toLowerCase() === i);
  if (shortExact) return shortExact.contentPath;

  // 3. Friendly aliases — map common short forms to the most specific ZIM
  const aliases: Record<string, string[]> = {
    wikipedia: ['wikipedia_en_all'],
    wikipedia_simple: ['wikipedia_en_simple_all'],
    gutenberg: ['gutenberg_en_all'],
    books: ['gutenberg_en_all'],
    wiktionary: ['wiktionary_en_all'],
    dictionary: ['wiktionary_en_all'],
    wikibooks: ['wikibooks_en_all'],
    wikiquote: ['wikiquote_en_all'],
    quotes: ['wikiquote_en_all'],
    wikisource: ['wikisource_en_all'],
  };
  for (const alias of aliases[i] ?? []) {
    const m = zims.find((z) => z.shortName === alias);
    if (m) return m.contentPath;
  }

  // 4. Fuzzy prefix match on short name
  const prefix = zims.find((z) => z.shortName.toLowerCase().startsWith(i));
  if (prefix) return prefix.contentPath;

  throw new Error(
    `unknown ZIM: "${input}". Known: ${zims.map((z) => z.shortName).join(', ')}`
  );
}

export interface SearchResult {
  title: string;
  url: string; // /content/<path>
  contentPath: string;
  zimTitle: string;
  snippet: string;
  wordCount?: number;
}

export async function search(
  pattern: string,
  options: { contentPath?: string; limit?: number } = {}
): Promise<{ totalResults: number; results: SearchResult[] }> {
  const limit = Math.min(options.limit ?? 10, 50);
  const params = new URLSearchParams({
    pattern,
    pageLength: String(limit),
    format: 'xml',
  });
  if (options.contentPath) {
    params.set('books.name', options.contentPath);
  }
  const r = await fetch(`${KIWIX_BASE}/search?${params.toString()}`);
  if (!r.ok) throw new Error(`search failed: ${r.status}`);
  const text = await r.text();
  const parsed = xml.parse(text);
  const channel = parsed?.rss?.channel;
  if (!channel) return { totalResults: 0, results: [] };
  const total = Number(
    String(channel['opensearch:totalResults'] ?? '0').replace(/,/g, '')
  );
  const rawItems = channel.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const results: SearchResult[] = items.map((it) => {
    const url = String(it.link ?? '');
    const m = url.match(/^\/content\/([^/]+)\//);
    return {
      title: String(it.title ?? ''),
      url,
      contentPath: m ? m[1]! : '',
      zimTitle: String(it.book?.title ?? ''),
      snippet: String(it.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
      wordCount: it.wordCount ? Number(it.wordCount) : undefined,
    };
  });
  return { totalResults: total, results };
}

export async function getArticle(
  contentPathOrShort: string,
  path: string
): Promise<{ title: string; markdown: string; sourceUrl: string }> {
  const content = await resolveContentPath(contentPathOrShort);
  const clean = path.replace(/^\/+/, '');
  const url = `${KIWIX_BASE}/content/${content}/${clean}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`article fetch ${r.status} for ${url}`);
  const html = await r.text();
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1]! : html;
  let markdown = turndown.turndown(body);
  // Strip kiwix runtime banners that leak into output.
  markdown = markdown
    .split('\n')
    .filter((line) => !/^!\[\]\(.*kiwix.*\)$/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    title: (titleMatch ? titleMatch[1]! : path).trim(),
    markdown,
    sourceUrl: url,
  };
}

export interface Suggestion {
  value: string;
  path: string;
}

export async function suggest(
  contentPathOrShort: string,
  term: string,
  limit = 10
): Promise<Suggestion[]> {
  const content = await resolveContentPath(contentPathOrShort);
  const r = await fetch(
    `${KIWIX_BASE}/suggest?content=${encodeURIComponent(content)}&term=${encodeURIComponent(term)}&count=${limit}`
  );
  if (!r.ok) throw new Error(`suggest failed: ${r.status}`);
  const data = (await r.json()) as Array<{ value: string; path?: string; kind?: string }>;
  return data
    .filter((s) => s.kind === 'path' && s.path)
    .map((s) => ({ value: s.value, path: s.path! }));
}
