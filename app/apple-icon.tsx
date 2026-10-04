import { ImageResponse } from "next/og";

// The home-screen icon: the same loop mark as icon.svg, at 180px.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#D24A12" }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M22.4 11.2A8 8 0 1 0 24 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d="M23.6 6.4v5.4h-5.4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
