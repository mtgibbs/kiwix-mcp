import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { createServer } from './server.js';
import { requireAuth } from './auth.js';

const transport = process.env.MCP_TRANSPORT || 'stdio';
const port = parseInt(process.env.MCP_PORT || '3000', 10);

async function main(): Promise<void> {
  if (transport === 'stdio') {
    const server = createServer();
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('kiwix-mcp running on stdio');
    return;
  }

  if (transport !== 'http') {
    console.error(`Unknown MCP_TRANSPORT: ${transport}`);
    process.exit(1);
  }

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kiwix-mcp' });
  });

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.all('/mcp', async (req, res) => {
    try {
      requireAuth(req.headers as Record<string, string>);
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const t = sessions.get(sessionId)!;
      await t.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'POST') {
      const newSessionId = randomUUID();
      const t = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
      });
      sessions.set(newSessionId, t);
      t.onclose = () => sessions.delete(newSessionId);

      const server = createServer();
      await server.connect(t);
      await t.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({ error: 'No session, and not a POST to initialize one' });
  });

  app.listen(port, () => {
    console.error(`kiwix-mcp HTTP listening on :${port}`);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
