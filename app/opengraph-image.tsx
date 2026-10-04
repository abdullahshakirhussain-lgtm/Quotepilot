import { ImageResponse } from "next/og";
import { PRICE_LABEL, TRIAL_DAYS } from "@/lib/marketing";

// The card shown when a QuoteLoop link is shared (WhatsApp, Facebook, LinkedIn, X...).
export const alt = "QuoteLoop: win more of the jobs you quote";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0C0A09",
          color: "#FAFAF9",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>QuoteLoop</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>
            Win more of the jobs you quote
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#D6D3D1" }}>
            Follow-up reminders and AI-drafted follow-ups for small service businesses
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              padding: "14px 28px",
              borderRadius: 12,
              background: "#D24A12",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {`${TRIAL_DAYS}-day free trial`}
          </div>
          <div style={{ display: "flex", marginLeft: 24, fontSize: 30, color: "#A8A29E" }}>{`then ${PRICE_LABEL}/month · quoteloop.site`}</div>
        </div>
      </div>
    ),
    size,
  );
}
