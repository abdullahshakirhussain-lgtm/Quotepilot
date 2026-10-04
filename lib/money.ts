// Reading an amount the way people type it. Shared by the browser (to show
// what was understood) and the server (which decides what is saved).

/**
 * The amount in plain text, or null when it isn't a positive number.
 *
 * Accepts the common ways of writing money:
 *   1250   1,250   1,250.50   $1,250   1 250,50   1.250,50   1'250.50   12,5   USD 480
 * The last comma or point is the decimal mark when there are both. With only
 * one kind, a single mark followed by exactly three digits is a thousands
 * separator (1,250 and 1.250 both mean one thousand two hundred and fifty);
 * otherwise it is the decimal mark (12,50 and 12.50 are both twelve fifty).
 */
export function readAmount(text: string | number | null | undefined): number | null {
  if (typeof text === "number") return Number.isFinite(text) && text > 0 ? round2(text) : null;
  let s = String(text ?? "").normalize("NFKC").trim();
  if (!s) return null;

  // Currency codes and symbols around the number, and spaces or apostrophes used as thousands separators.
  s = s
    .replace(/^[A-Za-z]{3}\s*|\s*[A-Za-z]{3}$/g, "")
    .replace(/[$€£¥₹₨₦₩₱₫₺₴₪฿]|R\$|Rs\.?|Rp|kr|zł|CHF|AED|SAR|R(?=\s?\d)/gi, "")
    .replace(/[\s'’]/g, "");
  if (!/^\d*[.,]?[\d.,]*$/.test(s) || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimal: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) {
    decimal = lastDot > lastComma ? "." : ",";
    // "1.234,56" has one decimal mark, after every thousands mark.
    if (s.split(decimal).length !== 2) return null;
  } else if (lastDot >= 0 || lastComma >= 0) {
    const mark = lastDot >= 0 ? "." : ",";
    const parts = s.split(mark);
    const after = parts[parts.length - 1];
    const whole = parts[0];
    // "0.250" is a quarter; "1.250" or "12,500" is a thousands separator.
    decimal = parts.length === 2 && (after.length !== 3 || whole === "" || /^0+$/.test(whole)) ? mark : null;
  }

  const thousands = decimal === "." ? "," : decimal === "," ? "." : null;
  let plain = s;
  if (thousands) plain = plain.split(thousands).join("");
  if (decimal) {
    const i = plain.lastIndexOf(decimal);
    plain = `${plain.slice(0, i).replace(/[.,]/g, "")}.${plain.slice(i + 1)}`;
  } else {
    plain = plain.replace(/[.,]/g, "");
  }
  if (!/^\d*\.?\d+$/.test(plain) && !/^\d+\.?$/.test(plain)) return null;

  const n = Number(plain);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
