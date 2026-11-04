/** The Settings areas, one view each (/settings?area=…). */
export const SETTINGS_AREAS = [
  { key: "business", label: "Business" },
  { key: "messages", label: "Messages" },
  { key: "billing", label: "Billing" },
  { key: "data", label: "Your data" },
] as const;
export type SettingsArea = (typeof SETTINGS_AREAS)[number]["key"];

/**
 * The area to show: the one asked for, else the one a returning link implies
 * (back from checkout → Billing, a failed export → Your data), else Business.
 */
export function settingsArea(params: { area?: string; billing?: string; export?: string }): SettingsArea {
  const asked = SETTINGS_AREAS.find((a) => a.key === params.area)?.key;
  if (asked) return asked;
  if (params.billing) return "billing";
  if (params.export) return "data";
  return "business";
}

/** The address of one Settings area. */
export const settingsHref = (area: SettingsArea) => `/settings?area=${area}`;
