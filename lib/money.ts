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

// --- BigInt <-> number boundary ---------------------------------------------
// Money columns are BigInt in the DB (64-bit: no ₹2.14 Cr overflow). The app
// keeps computing in `number`, which is EXACT for integers up to
// MAX_SAFE_INTEGER paise (≈ ₹90,071,98,75,47,409 — far beyond any real balance).
// lib/db.ts converts every `*Minor` field bigint -> number on read through this
// guard; Prisma accepts a plain number on write, so no write-side conversion.

/** Largest paise value representable exactly as a JS number. */
export const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

/** Read-boundary: bigint (or number) -> number, refusing values that would lose precision. */
export function toNumberMinor(v: bigint | number): number {
  const n = typeof v === "bigint" ? Number(v) : v;
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Monetary value ${v} exceeds the safe integer range (₹${MAX_SAFE_MINOR / 100}).`);
  }
  return n;
}

/** Serialization-boundary helper: render paise as a string when a caller must
 * avoid JS number/JSON limits entirely (e.g. exporting raw ledgers). */
export function serializeMoney(paise: number | bigint): string {
  return typeof paise === "bigint" ? paise.toString() : String(paise);
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
