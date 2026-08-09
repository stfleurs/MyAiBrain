import { loadConfig } from "./config.js";

const config = loadConfig();

console.log(
  `[personal-ai-memory] mcp-server bootstrap on port ${config.MCP_PORT} ` +
    `(tools registered in Phase 3)`
);
