import type { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolContext } from "../context.js";

export interface ToolDefinition<Args extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: (ctx: ToolContext, args: Args) => Promise<CallToolResult>;
}

export function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function fail(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
