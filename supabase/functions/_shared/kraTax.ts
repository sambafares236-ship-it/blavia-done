// Deno cannot import from src/, so this table is duplicated from
// src/lib/kraTax.ts. src/test/kraTax.test.ts asserts the two stay identical —
// if you edit one, edit both or that test fails.
//
// See src/lib/kraTax.ts for the standing warning: this mapping is UNVERIFIED
// against KRA's current eTIMS spec and A/B may need swapping.

export type TaxKey = "standard" | "exempt" | "zeroRated" | "nonVat";

export interface KraTaxType {
  code: string;
  label: string;
  rate: number;
}

export const KRA_TAX_TYPES: Record<TaxKey, KraTaxType> = {
  standard: { code: "A", label: "VAT 16%", rate: 16 },
  exempt: { code: "B", label: "Exempt", rate: 0 },
  zeroRated: { code: "C", label: "Zero-rated", rate: 0 },
  nonVat: { code: "D", label: "Non-VAT", rate: 0 },
};

export const KRA_BANDS = ["A", "B", "C", "D"] as const;
export type KraBand = (typeof KRA_BANDS)[number];

export const NON_VAT_CODE = KRA_TAX_TYPES.nonVat.code;

export const rateForCode = (code: string | null | undefined): number =>
  Object.values(KRA_TAX_TYPES).find((t) => t.code === code)?.rate ?? 0;

/** Band a taxTyCd aggregates into, falling back to non-VAT for unknown codes. */
export const bandForCode = (code: string | null | undefined): KraBand => {
  const match = KRA_BANDS.find((b) => b === code);
  return match ?? (NON_VAT_CODE as KraBand);
};
