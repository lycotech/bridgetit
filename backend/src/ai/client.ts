import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

/**
 * Anthropic client for the real AI Assistant (routes/ai-assistant.ts).
 *
 * Lazily constructed so a deployment without ANTHROPIC_API_KEY set still
 * boots normally — the key is optional in env.ts, same pattern as
 * OPENAI_API_KEY. Callers get a clear error at request time instead of a
 * crash at startup.
 */
let client: Anthropic | null = null;

export function isAiAssistantConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export function getAnthropicClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}
