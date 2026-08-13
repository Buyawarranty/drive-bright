import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^3.0.30";

/**
 * Lovable AI Gateway provider for the Vercel AI SDK.
 * Server-side only — LOVABLE_API_KEY must never reach the browser.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
