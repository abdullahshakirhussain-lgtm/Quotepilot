import { ImageResponse } from "next/og";
import { PRICE_LABEL, TRIAL_DAYS } from "@/lib/marketing";

// The card shown when a QuoteLoop link is shared (WhatsApp, Facebook, LinkedIn, X...).
// The app's look: white board, black-marker rules, one yellow highlight.
export const alt = "QuoteLoop: win more of the jobs you quote";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1F2328";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          color: INK,
          padding: "56px 72px 60px",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: -1.5 }}>QuoteLoop</div>
        <div style={{ display: "flex", height: 8, background: INK, marginTop: 22 }} />
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 0.98, letterSpacing: -4 }}>
            Win more of the jobs you quote
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 34, color: "#363D45" }}>
            Follow-up reminders and AI-drafted follow-ups for small service businesses
          </div>
        </div>
        <div style={{ display: "flex", height: 3, background: INK, marginBottom: 22 }} />
        <div style={{ display: "flex", alignItems: "center", fontSize: 32 }}>
          <div
            style={{
              display: "flex",
              padding: "6px 14px",
              background: "#FFE45C",
              borderRadius: "3px 10px 4px 12px",
              fontWeight: 800,
            }}
          >
            {`${TRIAL_DAYS}-day free trial`}
          </div>
          <div style={{ display: "flex", marginLeft: 22, color: "#4B535C" }}>{`then ${PRICE_LABEL} a month. quoteloop.site`}</div>
        </div>
      </div>
    ),
    size,
  );
}
