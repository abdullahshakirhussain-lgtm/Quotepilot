// Sent with every response. No full Content-Security-Policy yet (Next's inline
// scripts would need nonces); frame-ancestors alone stops other sites framing us.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// NEXT_PUBLIC_* values are copied into the JavaScript every visitor downloads.
// A Supabase service-role or secret key there would let anyone bypass row-level
// security and read or change every account, so the build stops instead.
function assertPublicSupabaseKey(key) {
  if (!key) return;
  if (/^sb_secret_/.test(key)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is a Supabase secret key. Use the anon/publishable key.");
  }
  const payload = key.split(".")[1];
  if (!payload) return;
  let role = null;
  try {
    role = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role ?? null;
  } catch {
    return;
  }
  if (role !== "anon") {
    throw new Error(`NEXT_PUBLIC_SUPABASE_ANON_KEY has role "${role}". Use the anon key; never ship the service-role key.`);
  }
}
assertPublicSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emails can carry up to 10MB of PDFs and photos (lib/attachments.ts),
  // which arrive base64-encoded inside the send action's request.
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // The checkout page hosts Paddle's payment frame, which may offer Apple
      // Pay or Google Pay; everywhere else payment stays off. (Later entries
      // override earlier ones for the same header.)
      { source: "/pay", headers: [{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=*" }] },
    ];
  },
};

export default nextConfig;
