// Records that the signed-in user opened a page of QuoteLoop, for the product's
// own analytics (see the privacy policy): the page's name and the kind of
// screen, nothing from its content, no cookie. Called from each app page's own
// server render, alongside the queries it already runs, so it is done before
// the page is sent and never overlaps anything the person does next. (Recording
// it from the browser, or after the response, could delay the list refreshing
// after a button press.)
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { deviceFrom } from "@/lib/visits";

export async function recordVisit(path: string): Promise<void> {
  try {
    const h = await headers();
    // A link prefetch isn't someone opening the page.
    if (h.get("next-router-prefetch") || h.get("sec-purpose")?.includes("prefetch")) return;
    const supabase = await createClient();
    // The database accepts only QuoteLoop's own page names, caps an account at
    // 1,000 a day and counts the same page again straight away (a refresh after
    // a button press) once. A missing function (SQL not run yet) is ignored.
    await supabase.rpc("log_page_view", { p_path: path, p_device: deviceFrom(h) });
  } catch {
    // Analytics never gets in anyone's way.
  }
}
