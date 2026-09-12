import {
  buildSystemPrompt,
  buildUserPrompt,
  templateFallback,
  type MessageContext,
} from "./prompts";

export interface GenerateResult {
  content: string;
  provider: "anthropic" | "openai" | "template";
  fellBack: boolean;
  error?: string;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/**
 * Generates a follow-up message. Chooses a provider based on which key is set,
 * and always returns usable content (falls back to a template on error / no key).
 */
export async function generateMessage(ctx: MessageContext): Promise<GenerateResult> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(ctx);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const content = await callAnthropic(system, user);
      return { content, provider: "anthropic", fellBack: false };
    } catch (err) {
      return {
        content: templateFallback(ctx),
        provider: "template",
        fellBack: true,
        error: err instanceof Error ? err.message : "AI request failed",
      };
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const content = await callOpenAICompatible(system, user);
      return { content, provider: "openai", fellBack: false };
    } catch (err) {
      return {
        content: templateFallback(ctx),
        provider: "template",
        fellBack: true,
        error: err instanceof Error ? err.message : "AI request failed",
      };
    }
  }

  // No key configured — deterministic template.
  return { content: templateFallback(ctx), provider: "template", fellBack: false };
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

async function callOpenAICompatible(system: string, user: string): Promise<string> {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.AI_MODEL || DEFAULT_OPENAI_MODEL;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
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
