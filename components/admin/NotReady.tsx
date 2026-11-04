/** Says plainly what the admin can't read yet, and how to fix it. */
export function NotReady({ reason, missing = [] }: { reason?: string; missing?: string[] }) {
  if (!reason && missing.length === 0) return null;
  return (
    <div role="status" className="msg-info">
      {reason ?? (
        <>
          Not set up yet: {missing.join(", ")}. Run <span className="font-medium">supabase/2026-11-admin.sql</span> in the
          Supabase SQL editor, then reload. Until then those figures show as zero.
        </>
      )}
    </div>
  );
}
