import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KRA_TAX_TYPES, KRA_BANDS, rateForCode, codesForBusiness, defaultCodeFor, NON_VAT_CODE } from "@/lib/kraTax";

/**
 * The edge function can't import from src/, so the KRA tax table is duplicated
 * into supabase/functions/_shared/kraTax.ts. Drift between the two would mean
 * the invoice UI and the KRA payload disagree about what a tax code means —
 * silently, and only visible once KRA rejects a return. Compare the literal
 * table text so an edit to one file without the other fails here.
 */
const readTable = (path: string) => {
  const src = readFileSync(resolve(__dirname, "../../", path), "utf8");
  const match = src.match(/KRA_TAX_TYPES: Record<TaxKey, KraTaxType> = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error(`Could not locate KRA_TAX_TYPES in ${path}`);
  return match[1].replace(/\s+/g, " ").trim();
};

describe("KRA tax table", () => {
  it("is identical in src/lib and the edge function's _shared copy", () => {
    expect(readTable("supabase/functions/_shared/kraTax.ts")).toBe(
      readTable("src/lib/kraTax.ts"),
    );
  });

  it("gives every tax type a distinct band that KRA expects amounts for", () => {
    const codes = Object.values(KRA_TAX_TYPES).map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach((c) => expect(KRA_BANDS).toContain(c));
  });

  it("resolves rates by code and treats unknown codes as untaxed", () => {
    expect(rateForCode(KRA_TAX_TYPES.standard.code)).toBe(16);
    expect(rateForCode(NON_VAT_CODE)).toBe(0);
    expect(rateForCode("ZZ")).toBe(0);
    expect(rateForCode(null)).toBe(0);
  });

  it("offers a non-VAT business exactly one, zero-rated option", () => {
    const options = codesForBusiness(false);
    expect(options).toHaveLength(1);
    expect(options[0].code).toBe(NON_VAT_CODE);
    expect(options[0].rate).toBe(0);
    expect(defaultCodeFor(false)).toBe(NON_VAT_CODE);
  });

  it("offers a VAT-registered business the standard rate by default", () => {
    expect(codesForBusiness(true).length).toBeGreaterThan(1);
    expect(defaultCodeFor(true)).toBe(KRA_TAX_TYPES.standard.code);
  });
});
