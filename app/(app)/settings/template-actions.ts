"use server";

import { createClient, requireUser } from "@/lib/supabase/server";
import { readOnlyReason } from "@/lib/billing-server";
import { TEMPLATE_KINDS, TEMPLATE_LIMITS, type MessageTemplate, type TemplateKind } from "@/lib/templates";
import { builtinByKey } from "@/lib/template-library";

// No revalidatePath here (see the note in ./actions.ts): the templates cards
// keep their own state from what these return.

export type TemplateOutcome = { ok: true; template: MessageTemplate } | { ok: false; error: string };
type Outcome = { ok: true } | { ok: false; error: string };

const COLUMNS = "id, kind, name, subject, body, builtin_key, updated_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unreachable = "The template couldn't be saved just now. Please try again.";

/**
 * Saves the user's own template, or (with builtinKey) their edited copy of a
 * ready-made one. A ready-made template keeps its own name and kind.
 */
export async function saveTemplate(input: {
  id?: string | null;
  builtinKey?: string | null;
  kind: string;
  name: string;
  subject: string;
  body: string;
}): Promise<TemplateOutcome> {
  const user = await requireUser();
  const readOnly = await readOnlyReason(user.id);
  if (readOnly) return { ok: false, error: readOnly };

  const builtin = input.builtinKey ? builtinByKey(input.builtinKey) : undefined;
  if (input.builtinKey && !builtin) return { ok: false, error: "That template no longer exists. Refresh the page." };
  if (!builtin && !(TEMPLATE_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: "Choose what the template is for." };
  }
  const kind = (builtin?.kind ?? input.kind) as TemplateKind;
  const name = builtin?.name ?? String(input.name ?? "").trim();
  const subject = String(input.subject ?? "").trim();
  const body = String(input.body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!name) return { ok: false, error: "Give the template a name." };
  if (name.length > TEMPLATE_LIMITS.name) {
    return { ok: false, error: `The name is too long. Keep it under ${TEMPLATE_LIMITS.name} characters.` };
  }
  if (subject.length > TEMPLATE_LIMITS.subject) {
    return { ok: false, error: `The subject is too long. Keep it under ${TEMPLATE_LIMITS.subject} characters.` };
  }
  if (!body) return { ok: false, error: "Write the message before saving." };
  if (body.length > TEMPLATE_LIMITS.body) {
    return {
      ok: false,
      error: `The message is too long. Keep it under ${TEMPLATE_LIMITS.body.toLocaleString("en-US")} characters.`,
    };
  }

  const row = { kind, name, subject: subject || null, body, builtin_key: builtin?.key ?? null };
  const supabase = await createClient();

  // An edited ready-made template is one row per account, found by its key.
  let id = input.id ?? null;
  if (builtin) {
    const { data: existing, error } = await supabase
      .from("message_templates")
      .select("id")
      .eq("user_id", user.id)
      .eq("builtin_key", builtin.key)
      .maybeSingle();
    if (error) {
      console.error("[templates] finding an edited template failed:", error.message);
      return { ok: false, error: unreachable };
    }
    id = existing?.id ?? null;
  }

  const { data, error } = id
    ? await supabase.from("message_templates").update(row).eq("id", id).eq("user_id", user.id).select(COLUMNS)
    : await supabase.from("message_templates").insert({ ...row, user_id: user.id }).select(COLUMNS);

  if (error) {
    if (/template limit reached/.test(error.message)) {
      return {
        ok: false,
        error: `You have ${TEMPLATE_LIMITS.perAccount} of your own templates, the most an account can keep. Delete one you no longer use, then save this one.`,
      };
    }
    // Saved twice at once (two tabs): the other save made the row first.
    if (error.code === "23505") return { ok: false, error: "This template was just saved in another tab. Refresh the page and try again." };
    console.error("[templates] saving a template failed:", error.message);
    return { ok: false, error: unreachable };
  }
  const saved = (data as MessageTemplate[] | null)?.[0];
  if (!saved) return { ok: false, error: "This template no longer exists. Refresh the page to see your templates." };
  return { ok: true, template: saved };
}

/** Deletes the user's own template, or their edits to a ready-made one (restoring it). */
export async function deleteTemplate(id: string): Promise<Outcome> {
  const user = await requireUser();
  const readOnly = await readOnlyReason(user.id);
  if (readOnly) return { ok: false, error: readOnly };
  if (!UUID.test(String(id))) return { ok: false, error: "That template no longer exists. Refresh the page." };

  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("[templates] deleting a template failed:", error.message);
    return { ok: false, error: "The template couldn't be deleted just now. Please try again." };
  }
  return { ok: true };
}

/** Which quote email template new quotes start from. */
export async function setQuoteTemplate(choice: string): Promise<Outcome> {
  const user = await requireUser();
  const readOnly = await readOnlyReason(user.id);
  if (readOnly) return { ok: false, error: readOnly };

  const supabase = await createClient();
  const builtin = builtinByKey(choice);
  let valid = builtin?.kind === "quote_email";
  if (!builtin && UUID.test(String(choice))) {
    const { data } = await supabase
      .from("message_templates")
      .select("id")
      .eq("id", choice)
      .eq("user_id", user.id)
      .eq("kind", "quote_email")
      .is("builtin_key", null)
      .maybeSingle();
    valid = Boolean(data);
  }
  if (!valid) return { ok: false, error: "That template no longer exists. Refresh the page." };

  const { data, error } = await supabase
    .from("businesses")
    .update({ quote_template: choice })
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[templates] choosing the quote template failed:", error.message);
    return { ok: false, error: "That couldn't be saved just now. Please try again." };
  }
  if (!data?.length) return { ok: false, error: "Your workspace wasn't found. Refresh the page and try again." };
  return { ok: true };
}

/** The sign-off and signature that end every template and AI draft. */
export async function saveSignOff(input: { signOff: string; signature: string }): Promise<Outcome> {
  const user = await requireUser();
  const readOnly = await readOnlyReason(user.id);
  if (readOnly) return { ok: false, error: readOnly };

  // One line for the sign-off; at most five short lines for the signature.
  const signOff = String(input.signOff ?? "").replace(/\s+/g, " ").trim();
  const signature = String(input.signature ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (signOff.length > TEMPLATE_LIMITS.signOff) {
    return { ok: false, error: `The sign-off is too long. Keep it under ${TEMPLATE_LIMITS.signOff} characters.` };
  }
  if (signature.length > TEMPLATE_LIMITS.signature) {
    return { ok: false, error: `The signature is too long. Keep it under ${TEMPLATE_LIMITS.signature} characters.` };
  }
  if (signature.split("\n").length > 5) return { ok: false, error: "Keep the signature to 5 lines or fewer." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({ sign_off: signOff || null, signature: signature || null })
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[templates] saving the sign-off failed:", error.message);
    return { ok: false, error: "Your sign-off couldn't be saved just now. Please try again." };
  }
  if (!data?.length) return { ok: false, error: "Your workspace wasn't found. Refresh the page and try again." };
  return { ok: true };
}
