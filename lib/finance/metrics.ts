// Small pure metrics used across accounts/investments/subscriptions (spec §10/§11/§46).

/** Available credit = limit − outstanding. */
export function availableCredit(limitMinor: number, outstandingMinor: number): number {
  return limitMinor - outstandingMinor;
}

/** Utilization % = outstanding / limit × 100. 0 when no limit. */
export function creditUtilization(outstandingMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) return 0;
  return (outstandingMinor / limitMinor) * 100;
}

export function investmentReturn(currentMinor: number, investedMinor: number) {
  const plMinor = currentMinor - investedMinor;
  const plPct = investedMinor > 0 ? (plMinor / investedMinor) * 100 : 0;
  return { plMinor, plPct };
}

export type BillingFrequency =
  | "weekly"
  | "monthly"
  | "every2months"
  | "quarterly"
  | "every6months"
  | "yearly"
  | "custom";

/** Monthly-equivalent cost of a subscription (spec §8). Custom uses intervalDays. */
export function subscriptionMonthlyEquivalent(
  amountMinor: number,
  frequency: BillingFrequency,
  intervalDays?: number,
): number {
  switch (frequency) {
    case "weekly":
      return Math.round((amountMinor * 52) / 12);
    case "monthly":
      return amountMinor;
    case "every2months":
      return Math.round(amountMinor / 2);
    case "quarterly":
      return Math.round(amountMinor / 3);
    case "every6months":
      return Math.round(amountMinor / 6);
    case "yearly":
      return Math.round(amountMinor / 12);
    case "custom":
      if (!intervalDays || intervalDays <= 0) return amountMinor;
      return Math.round((amountMinor * 365) / 12 / intervalDays);
  }
}

export function subscriptionAnnualCost(
  amountMinor: number,
  frequency: BillingFrequency,
  intervalDays?: number,
): number {
  return subscriptionMonthlyEquivalent(amountMinor, frequency, intervalDays) * 12;
}
