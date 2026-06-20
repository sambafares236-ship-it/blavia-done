// Shared Kenyan payroll constants and PAYE calculation.
// This is the single source of truth — RunPayrollSection (which runs payroll
// and saves payslips) and PayslipsSection (which displays them) both import
// from here. Keeping the formula in one place means they can't silently
// drift out of sync the way they previously did.

export const PERSONAL_RELIEF = 2400;
export const HOUSING_LEVY = 0.015;
export const SHIF = 0.0275;
export const NSSF_RATE = 0.06;
export const NSSF_CAP = 4320; // Tier I + II employee contribution cap (KES)
export const STANDARD_DAYS = 26;

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
 */
export const calcTaxable = (
  gross: number,
  nssf: number,
  housing: number,
  shif: number,
): number => Math.max(0, gross - nssf - housing - shif);