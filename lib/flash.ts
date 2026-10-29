// A confirmation that survives one full page reload ("Sample data removed…").
//
// Settings actions that change what other parts of the screen show (the
// sidebar, the reminder badge) reload the page instead of asking Next to
// re-render it in the action's response: on self-hosted production builds that
// re-render can stall and leave the button spinning forever
// (vercel/next.js#99028). A hard reload always lands.

const KEY = "qp_flash:";

/**
 * Reloads the page, then shows `message` once on the page that loads, where
 * the component with the same `scope` takes it.
 */
export function reloadWithMessage(scope: string, message: string) {
  try {
    sessionStorage.setItem(KEY + scope, message);
  } catch {
    // Storage blocked: the change is still saved, only the message is lost.
  }
  window.location.reload();
}

/** The message reloadWithMessage left for `scope`, once (null if none). */
export function takeFlash(scope: string): string | null {
  try {
    const message = sessionStorage.getItem(KEY + scope);
    if (message !== null) sessionStorage.removeItem(KEY + scope);
    return message;
  } catch {
    return null;
  }
}
