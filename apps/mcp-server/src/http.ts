import { randomUUID } from "node:crypto";
import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyAuthToken } from "./auth.js";
import type { Config } from "./config.js";

type McpRequest = IncomingMessage & { body?: unknown };

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

export function createHttpApp(
  config: Config,
  createServer: () => McpServer
): express.Express {
  const app = express();
  app.use(express.json());
  const sessions = new Map<string, Session>();

  app.get("/health", (_req, res) => {
    res.json({ ok: true, name: "personal-ai-memory" });
  });

  app.all("/mcp", async (req, res) => {
    if (!verifyAuthToken(req.headers.authorization, config.MCP_AUTH_TOKEN)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const sessionId = req.headers["mcp-session-id"];
    const existing = sessionId ? sessions.get(String(sessionId)) : undefined;

    if (existing) {
      await existing.transport.handleRequest(
        req as McpRequest,
        res as unknown as ServerResponse,
        req.body
      );
      return;
    }

    if (req.method !== "POST") {
      res.status(400).json({ error: "unknown session" });
      return;
    }

    const server = createServer();
    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      enableJsonResponse: true,
    });
    const session: Session = { server, transport };
    transport.onclose = () => {
      sessions.delete(newSessionId);
    };
    sessions.set(newSessionId, session);
    await server.connect(transport);
    await transport.handleRequest(req as McpRequest, res as unknown as ServerResponse, req.body);
  });

  return app;
}
