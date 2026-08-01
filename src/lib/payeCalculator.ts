// Shared Kenyan payroll constants and PAYE calculation.
// This is the single source of truth — RunPayrollSection (which runs payroll
// and saves payslips) and PayslipsSection (which displays them) both import
// from here. Keeping the formula in one place means they can't silently
// drift out of sync the way they previously did.

export const PERSONAL_RELIEF = 2400;
export const STANDARD_DAYS = 26;

// ── Housing Levy (Affordable Housing Act, 2024) ─────────────────────────────
// 1.5% of gross pay, uncapped. The employer pays a *separate, equal* 1.5% —
// it is not split from the employee's share, it is an additional cost.
export const HOUSING_LEVY_RATE = 0.015;
/** @deprecated use HOUSING_LEVY_RATE — kept as an alias so existing imports don't break. */
export const HOUSING_LEVY = HOUSING_LEVY_RATE;

// ── SHIF (Social Health Insurance Fund) ─────────────────────────────────────
// 2.75% of gross pay. Employee-only — there is NO employer-matched SHIF
// contribution under current law (this replaced NHIF in October 2024).
export const SHIF_RATE = 0.0275;
/** @deprecated use SHIF_RATE — kept as an alias so existing imports don't break. */
export const SHIF = SHIF_RATE;

// ── NSSF (NSSF Act, 2013 — Phase 4 rates effective 1 February 2026) ────────
// Two tiers, each 6%, each matched equally by the employer:
//   Tier I:  6% of pay up to the Lower Earnings Limit (LEL)
//   Tier II: 6% of pay between the LEL and the Upper Earnings Limit (UEL)
export const NSSF_RATE = 0.06;
export const NSSF_LEL = 9000;    // Lower Earnings Limit (KES) — was 8,000 pre-Feb-2026
export const NSSF_UEL = 108000;  // Upper Earnings Limit (KES) — was 72,000 pre-Feb-2026
export const NSSF_TIER1_CAP = NSSF_LEL * NSSF_RATE;               // 540
export const NSSF_TIER2_CAP = (NSSF_UEL - NSSF_LEL) * NSSF_RATE;  // 5,940
/** Combined per-side (employee OR employer) cap: 6,480. */
export const NSSF_CAP = NSSF_TIER1_CAP + NSSF_TIER2_CAP;

/**
 * NSSF contribution for ONE side (employee or employer — they're identical).
 * Correctly banded across Tier I / Tier II rather than a flat
 * `gross * 6%` capped at a single number, which mis-calculates pay that
 * straddles the Lower Earnings Limit.
 */
export const calcNssf = (gross: number): number => {
  const tier1 = Math.min(Math.max(gross, 0), NSSF_LEL) * NSSF_RATE;
  const tier2 = Math.max(0, Math.min(gross, NSSF_UEL) - NSSF_LEL) * NSSF_RATE;
  return tier1 + tier2;
};

/** Housing Levy for ONE side (employee or employer — same rate, uncapped). */
export const calcHousingLevy = (gross: number): number => Math.max(0, gross) * HOUSING_LEVY_RATE;

/** SHIF — employee side only. There is no employer-side SHIF figure to calculate. */
export const calcShif = (gross: number): number => Math.max(0, gross) * SHIF_RATE;

/**
 * What the employer actually pays out, on top of net pay and the PAYE it
 * withholds and remits: gross pay plus the employer's OWN NSSF and Housing
 * Levy matches. This — not net pay, and not the employee deduction total —
 * is the figure that belongs on the employer's books as payroll cost.
 */
export const calcEmployerCost = (
  gross: number,
  nssfEmployer: number,
  housingEmployer: number,
): number => gross + nssfEmployer + housingEmployer;

/**
 * Kenyan PAYE — monthly bands, tax BEFORE personal relief.
 * Bands per KRA / Finance Act 2023: 10% / 25% / 30% / 32.5% / 35%.
 * The 35% band (above KES 800,000 taxable/month) matters for higher
 * earners — a previous copy of this formula was missing it.
 */
export const calcPAYEBeforeRelief = (taxable: number): number => {
  if (taxable <= 24000) return taxable * 0.1;
  if (taxable <= 32333) return 2400 + (taxable - 24000) * 0.25;
  if (taxable <= 500000) return 2400 + 2083.25 + (taxable - 32333) * 0.3;
  if (taxable <= 800000) return 2400 + 2083.25 + 140300.1 + (taxable - 500000) * 0.325;
  return 2400 + 2083.25 + 140300.1 + 97500 + (taxable - 800000) * 0.35;
};

/**
 * Taxable income = gross pay minus NSSF, Housing Levy, and SHIF —
 * all three are allowable deductions before PAYE is calculated.
 * (Only the employee's own deductions reduce their taxable income —
 * the employer's matching NSSF/Housing Levy contributions do not.)
 */
export const calcTaxable = (
  gross: number,
  nssf: number,
  housing: number,
  shif: number,
): number => Math.max(0, gross - nssf - housing - shif);