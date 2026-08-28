// Money is ALWAYS integer paise (spec §22). Never floats for storage/math.
// 1 rupee = 100 paise. ₹123.45 => 12345.

/** Parse a user-entered rupee value into integer paise. Exact for realistic amounts. */
export function rupeesToPaise(input: number | string): number {
  const cleaned = String(input).trim().replace(/[₹,\s]/g, "");
  if (cleaned === "" || !/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === "." || cleaned === "-") {
    throw new Error(`Invalid amount: ${input}`);
  }
  // *100 then round kills the binary-float epsilon (e.g. 1234.56*100 = 123456.0000001).
  return Math.round(Number(cleaned) * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** ₹1,50,000.00 — Indian grouping via Intl. Whole rupees drop the decimals by default. */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  const decimals = opts.decimals ?? !Number.isInteger(rupees);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(rupees);
}

/** Compact big values as Lakh/Crore (spec §27): ₹1.25 Cr, ₹2.40 L. */
export function compactINR(paise: number): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return formatINR(paise);
}

/** Signed display for deltas: +₹500 / −₹500. */
export function formatSignedINR(paise: number): string {
  const s = formatINR(Math.abs(paise));
  if (paise > 0) return `+${s}`;
  if (paise < 0) return `−${s}`;
  return s;
}
