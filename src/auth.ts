const API_KEY = process.env.MCP_API_KEY;

export function validateApiKey(providedKey: string | undefined): boolean {
  if (!API_KEY) {
    console.error('Error: MCP_API_KEY not set. Authentication failing securely.');
    return false;
  }
  return providedKey === API_KEY;
}

export function requireAuth(headers: Record<string, string | string[] | undefined>): void {
  const apiKey = (headers['x-api-key'] || headers['authorization']) as string | undefined;
  const candidate = apiKey?.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;
  if (!validateApiKey(candidate)) {
    throw new Error('Unauthorized: Invalid or missing API key');
  }
}
