import {
  buildSystemPrompt,
  buildUserPrompt,
  templateFallback,
  type MessageContext,
} from "./prompts";

export interface GenerateResult {
  content: string;
  provider: "anthropic" | "deepseek" | "openai" | "template";
  fellBack: boolean;
  /** Short, user-safe reason when the AI call failed (details go to server logs). */
  error?: string;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

// Never let a slow provider hang the request; fall back to a template instead.
const AI_TIMEOUT_MS = 25_000;

/**
 * Generates a follow-up message. Picks a provider from whichever key is set
 * (Anthropic > DeepSeek > OpenAI-compatible) and always returns usable content,
 * falling back to a template on error, timeout, or when no key is configured.
 */
export async function generateMessage(ctx: MessageContext): Promise<GenerateResult> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(ctx);

  // 1) Anthropic (Claude)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const content = await callAnthropic(system, user);
      return { content, provider: "anthropic", fellBack: false };
    } catch (err) {
      return fallback(ctx, "anthropic", err);
    }
  }

  // 2) DeepSeek — OpenAI-compatible, but with sane built-in defaults so only the
  //    DEEPSEEK_API_KEY variable is required.
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const content = await callChatCompletions(system, user, {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL || DEEPSEEK_BASE_URL,
        model: process.env.AI_MODEL || DEFAULT_DEEPSEEK_MODEL,
      });
      return { content, provider: "deepseek", fellBack: false };
    } catch (err) {
      return fallback(ctx, "deepseek", err);
    }
  }

  // 3) Any other OpenAI-compatible endpoint (OpenAI, Groq, Together, OpenRouter…)
  if (process.env.OPENAI_API_KEY) {
    try {
      const content = await callChatCompletions(system, user, {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || OPENAI_BASE_URL,
        model: process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
      });
      return { content, provider: "openai", fellBack: false };
    } catch (err) {
      return fallback(ctx, "openai", err);
    }
  }

  // 4) No key configured — deterministic template.
  return { content: templateFallback(ctx), provider: "template", fellBack: false };
}

function fallback(ctx: MessageContext, provider: string, err: unknown): GenerateResult {
  // Full provider error (which can include response bodies) stays server-side.
  console.error(`[ai] ${provider} generation failed:`, err);
  return {
    content: templateFallback(ctx),
    provider: "template",
    fellBack: true,
    error: describeError(err),
  };
}

/** Turns a provider failure into a short reason that is safe to show users. */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "request timed out";
    const status = /API (\d{3})/.exec(err.message)?.[1];
    if (status === "401" || status === "403") return "API key was rejected";
    if (status === "402") return "account has insufficient balance";
    if (status === "429") return "rate limit reached";
    if (status) return `provider returned HTTP ${status}`;
    if (/empty message/i.test(err.message)) return "provider returned an empty message";
  }
  return "request failed";
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const model = process.env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Anthropic returned an empty message.");
  return text;
}

/**
 * Calls any OpenAI-compatible /chat/completions endpoint. DeepSeek and OpenAI
 * both go through here — only the base URL, model and key differ.
 */
async function callChatCompletions(
  system: string,
  user: string,
  opts: { apiKey: string; baseUrl: string; model: string }
): Promise<string> {
  const base = opts.baseUrl.replace(/\/$/, "");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI provider returned an empty message.");
  return text;
}
