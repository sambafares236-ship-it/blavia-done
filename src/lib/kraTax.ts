/**
 * KRA eTIMS tax type codes — the single source of truth for this repo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  UNVERIFIED MAPPING — CONFIRM AGAINST KRA'S CURRENT eTIMS SPEC BEFORE
 *  SUBMITTING LIVE INVOICES.
 *
 *  The table below preserves the mapping this codebase has always assumed
 *  (A = 16% standard, B = exempt). KRA's published eTIMS documentation
 *  describes a different one:
 *
 *      A = Exempt      B = 16% standard      C = 0% zero-rated      D = Non-VAT
 *
 *  If KRA's mapping is the live one, every invoice submitted so far has
 *  declared the wrong band, and A/B below must be swapped. That change is a
 *  single edit here: every consumer resolves codes and rates through this
 *  table rather than hardcoding letters, and `supabase/functions/_shared/
 *  kraTax.ts` is asserted identical to this file by src/test/kraTax.test.ts.
 *
 *  NON_VAT ("D") does not conflict with either mapping — the code had no
 *  concept of it at all — so it is safe to adopt now.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type TaxKey = "standard" | "exempt" | "zeroRated" | "nonVat";

export interface KraTaxType {
  /** taxTyCd sent per line item, and the band its amounts aggregate into. */
  code: string;
  /** Shown in the invoice line-item selector. */
  label: string;
  /** Percentage, sent as taxRt<band>. */
  rate: number;
}

export const KRA_TAX_TYPES: Record<TaxKey, KraTaxType> = {
  standard: { code: "A", label: "VAT 16%", rate: 16 },
  exempt: { code: "B", label: "Exempt", rate: 0 },
  zeroRated: { code: "C", label: "Zero-rated", rate: 0 },
  nonVat: { code: "D", label: "Non-VAT", rate: 0 },
};

/** Every band KRA expects amounts for, in payload order. */
export const KRA_BANDS = ["A", "B", "C", "D"] as const;
export type KraBand = (typeof KRA_BANDS)[number];

export const STANDARD_CODE = KRA_TAX_TYPES.standard.code;
export const EXEMPT_CODE = KRA_TAX_TYPES.exempt.code;
export const ZERO_RATED_CODE = KRA_TAX_TYPES.zeroRated.code;
export const NON_VAT_CODE = KRA_TAX_TYPES.nonVat.code;

/** Standard VAT rate as a fraction, for invoice-line arithmetic. */
export const VAT_RATE = KRA_TAX_TYPES.standard.rate / 100;

/** Rate for a given taxTyCd; 0 for anything unrecognised. */
export const rateForCode = (code: string | null | undefined): number =>
  Object.values(KRA_TAX_TYPES).find((t) => t.code === code)?.rate ?? 0;

/**
 * Codes a business may choose between. A business that is not VAT-registered
 * charges no VAT but must still report the sale, so it gets exactly one
 * option rather than no eTIMS at all.
 */
export const codesForBusiness = (vatRegistered: boolean): KraTaxType[] =>
  vatRegistered
    ? [KRA_TAX_TYPES.standard, KRA_TAX_TYPES.exempt, KRA_TAX_TYPES.zeroRated]
    : [KRA_TAX_TYPES.nonVat];

/** The code new invoice lines start on. */
export const defaultCodeFor = (vatRegistered: boolean): string =>
  vatRegistered ? STANDARD_CODE : NON_VAT_CODE;

/** How a business issues eTIMS invoices. Mirrors etims_configs.mode. */
export type EtimsMode = "none" | "oscu" | "lite";

/** KRA PINs are 11 characters: a letter, nine digits, then a letter (e.g. A123456789Z). */
const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/;

/** Strips whitespace and any non-alphanumeric characters, and uppercases. */
export const cleanKraPin = (raw: string): string =>
  raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

/** True if a (cleaned) KRA PIN matches KRA's standard 11-character format. */
export const isValidKraPin = (raw: string): boolean =>
  KRA_PIN_PATTERN.test(cleanKraPin(raw));