import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./server.js";
import { createHttpApp } from "./http.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.MCP_TRANSPORT === "stdio") {
    const server = createMcpServer(config);
    await server.connect(new StdioServerTransport());
    return;
  }

  const app = createHttpApp(config, () => createMcpServer(config));
  app.listen(config.MCP_PORT, () => {
    console.log(`[personal-ai-memory] MCP server listening on 0.0.0.0:${config.MCP_PORT}`);
  });
}

main().catch((err) => {
  console.error("[personal-ai-memory] fatal:", err);
  process.exit(1);
});
