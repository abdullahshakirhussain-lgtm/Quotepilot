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
  error?: string;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

/**
 * Generates a follow-up message. Picks a provider from whichever key is set
 * (Anthropic > DeepSeek > OpenAI-compatible) and always returns usable content,
 * falling back to a template on error or when no key is configured.
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
      return fallback(ctx, err);
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
      return fallback(ctx, err);
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
      return fallback(ctx, err);
    }
  }

  // 4) No key configured — deterministic template.
  return { content: templateFallback(ctx), provider: "template", fellBack: false };
}

function fallback(ctx: MessageContext, err: unknown): GenerateResult {
  return {
    content: templateFallback(ctx),
    provider: "template",
    fellBack: true,
    error: err instanceof Error ? err.message : "AI request failed",
  };
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
