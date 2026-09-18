import { unstable_rethrow } from "next/navigation";

/** Shown when a form's request never got an answer (connection lost, signed out elsewhere). */
export const FORM_UNREACHABLE =
  "QuoteLoop couldn't be reached, so this may not have been saved. Check your connection and try again — what you typed is still here.";

/**
 * Wraps a form's server action for useActionState. A request that never gets
 * an answer then comes back as a message next to the form, instead of the
 * whole page switching to the error screen and losing what was typed.
 */
export function reportUnreachable<S extends { error?: string }>(
  action: (prev: S, data: FormData) => Promise<S>
): (prev: S, data: FormData) => Promise<S> {
  return async (prev, data) => {
    try {
      return await action(prev, data);
    } catch (e) {
      unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
      return { error: FORM_UNREACHABLE } as S;
    }
  };
}
