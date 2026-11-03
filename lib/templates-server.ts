import { createClient } from "@/lib/supabase/server";
import type { MessageTemplate, TemplateKind } from "./templates";

/**
 * The user's templates, oldest first. Templates are optional, so a failed
 * load (for example before the schema was re-run) shows none rather than
 * breaking the page.
 */
export async function loadTemplates(userId: string, kind?: TemplateKind): Promise<MessageTemplate[]> {
  const supabase = await createClient();
  let query = supabase
    .from("message_templates")
    .select("id, kind, name, subject, body, builtin_key, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) {
    console.error("[templates] loading templates failed:", error.message);
    return [];
  }
  return (data ?? []) as MessageTemplate[];
}
