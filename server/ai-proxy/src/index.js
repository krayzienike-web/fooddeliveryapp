import Anthropic from "@anthropic-ai/sdk";

/**
 * «Шеф ИИ» proxy for the Android build. The app never holds the Claude API key:
 * it POSTs { system, context, messages } here, the Worker adds the key and calls the Claude API.
 *
 *   system   – stable instructions + menu (same every turn → prompt-cached)
 *   context  – per-turn situation (time, cart, order)
 *   messages – recent chat turns [{ role: "user" | "assistant", content: string }]
 *
 * Responds { text, stopReason }.
 */

const MAX_SYSTEM = 200_000;
const MAX_TURNS = 24;
const MAX_TURN_CHARS = 8_000;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-app-key",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });

function validate(body) {
  if (!body || typeof body.system !== "string" || body.system.length > MAX_SYSTEM) return "system";
  if (body.context !== undefined && (typeof body.context !== "string" || body.context.length > MAX_TURN_CHARS)) return "context";
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_TURNS) return "messages";
  for (const m of body.messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content || m.content.length > MAX_TURN_CHARS) return "messages";
  }
  if (body.messages[0].role !== "user" || body.messages.at(-1).role !== "user") return "messages";
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    // A shared app key only keeps casual traffic out; put Cloudflare rate limiting in front for real abuse protection.
    if (env.APP_KEY && request.headers.get("x-app-key") !== env.APP_KEY) return json({ error: "unauthorized" }, 401);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    const bad = validate(body);
    if (bad) return json({ error: `invalid_${bad}` }, 400);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
    try {
      const message = await client.beta.messages.create({
        model: env.MODEL || "claude-opus-5-5",
        max_tokens: 4096,
        // Short conversational answers: low effort keeps the reply fast on a phone.
        output_config: { effort: "low" },
        // If a safety classifier declines, the API retries on a suitable model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: body.system, cache_control: { type: "ephemeral" } },
          ...(body.context ? [{ type: "text", text: body.context }] : []),
        ],
        messages: body.messages,
      });
      const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      return json({ text, stopReason: message.stop_reason });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
      if (e instanceof Anthropic.AuthenticationError) return json({ error: "proxy_misconfigured" }, 500);
      if (e instanceof Anthropic.BadRequestError) return json({ error: "bad_request", message: e.message }, 400);
      if (e instanceof Anthropic.APIError) return json({ error: "upstream", status: e.status }, 502);
      return json({ error: "upstream" }, 502);
    }
  },
};
