// Phone, tablet or computer, from what the browser says about itself: used to
// record page visits for the product's own analytics (see lib/visits-server.ts
// and the privacy policy). Pure, so it is tested directly.

export type Device = "phone" | "tablet" | "desktop";

export function deviceFrom(headers: Headers): Device {
  const ua = headers.get("user-agent") ?? "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (headers.get("sec-ch-ua-mobile") === "?1" || /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "phone";
  return "desktop";
}
