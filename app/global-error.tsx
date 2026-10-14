"use client";

import { useEffect } from "react";

// Last resort, when the root layout itself fails: it replaces the whole page,
// so it brings its own <html> and plain styles (the app's CSS may not load).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f5f2", color: "#1c1917" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: "center", background: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, padding: 32 }}>
            <h1 style={{ fontSize: 18, margin: 0 }}>QuoteLoop couldn&apos;t load</h1>
            <p style={{ fontSize: 14, color: "#57534e", marginTop: 8 }}>
              Something went wrong on our side. Your data is safe. Please try again in a moment.
            </p>
            {error.digest && <p style={{ fontSize: 12, color: "#a8a29e" }}>Reference: {error.digest}</p>}
            <button
              onClick={reset}
              style={{ marginTop: 16, padding: "8px 16px", borderRadius: 6, border: 0, background: "#1c1917", color: "#fff", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
