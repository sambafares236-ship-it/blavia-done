import { describe, expect, it } from "vitest";
import {
  calcNssf,
  calcHousingLevy,
  calcShif,
  calcEmployerCost,
  NSSF_CAP,
  NSSF_LEL,
  NSSF_UEL,
} from "@/lib/payeCalculator";

describe("calcNssf (Phase 4 rates, effective Feb 2026)", () => {
  it("charges 6% flat below the Lower Earnings Limit", () => {
    expect(calcNssf(5000)).toBeCloseTo(300, 5);
  });

  it("caps Tier I exactly at the Lower Earnings Limit", () => {
    expect(calcNssf(NSSF_LEL)).toBeCloseTo(540, 5);
  });

  it("adds Tier II for pay between the LEL and UEL", () => {
    // Gross 50,000: Tier I = 9,000*6% = 540, Tier II = (50,000-9,000)*6% = 2,460
    expect(calcNssf(50000)).toBeCloseTo(3000, 5);
  });

  it("caps the total at the combined per-side maximum once gross reaches the UEL", () => {
    expect(calcNssf(NSSF_UEL)).toBeCloseTo(NSSF_CAP, 5);
    expect(calcNssf(NSSF_UEL)).toBeCloseTo(6480, 5);
  });

  it("stays capped for pay above the Upper Earnings Limit", () => {
    expect(calcNssf(500000)).toBeCloseTo(NSSF_CAP, 5);
  });
});

describe("calcHousingLevy", () => {
  it("is 1.5% of gross with no cap, even for very high pay", () => {
    expect(calcHousingLevy(150000)).toBeCloseTo(2250, 5);
    expect(calcHousingLevy(1000000)).toBeCloseTo(15000, 5);
  });
});

describe("calcShif", () => {
  it("is 2.75% of gross — this is the employee's own deduction, no employer match exists", () => {
    expect(calcShif(150000)).toBeCloseTo(4125, 5);
  });
});

describe("calcEmployerCost", () => {
  it("is gross pay plus the employer's own NSSF and Housing Levy matches", () => {
    const gross = 50000;
    const nssfEmployer = calcNssf(gross); // employer matches employee's NSSF exactly
    const housingEmployer = calcHousingLevy(gross); // employer matches employee's Housing Levy exactly
    expect(calcEmployerCost(gross, nssfEmployer, housingEmployer)).toBeCloseTo(
      gross + nssfEmployer + housingEmployer,
      5,
    );
    // Worked example: 50,000 + 3,000 (NSSF) + 750 (Housing) = 53,750
    expect(calcEmployerCost(gross, nssfEmployer, housingEmployer)).toBeCloseTo(53750, 5);
  });
});