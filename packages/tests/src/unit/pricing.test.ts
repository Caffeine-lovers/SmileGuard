import { describe, it, expect } from "vitest";
import { calculateDiscount as sharedCalculateDiscount } from "@smileguard/shared-types";
import { calculateDiscount as appCalculateDiscount } from "@/lib/database";
import {
  computeCheckoutTotal,
  getServicePrice,
  getServicePriceForClinic,
  resolveBaseAmount,
  FALLBACK_PRICE,
} from "@/lib/pricing";

describe("calculateDiscount — single source of truth", () => {
  it("the billing page uses the same function as shared-types", () => {
    expect(appCalculateDiscount).toBe(sharedCalculateDiscount);
  });
});

describe("getServicePrice()", () => {
  it("returns catalog prices for known services", () => {
    expect(getServicePrice("Whitening")).toBe(5000);
    expect(getServicePrice("Checkup")).toBe(300);
    expect(getServicePrice("Braces")).toBe(35000);
  });

  it("is case/whitespace insensitive", () => {
    expect(getServicePrice("  whitening ")).toBe(5000);
  });

  it("prefers an exact match over a partial one", () => {
    // "Root Canals" must not be priced via a partial match on something else
    expect(getServicePrice("Root Canals")).toBe(8000);
    expect(getServicePrice("Implants Consultation")).toBe(45000);
  });

  it("falls back for unknown or missing services", () => {
    expect(getServicePrice("Something New")).toBe(FALLBACK_PRICE);
    expect(getServicePrice(null)).toBe(FALLBACK_PRICE);
    expect(getServicePrice(undefined)).toBe(FALLBACK_PRICE);
  });
});

describe("getServicePriceForClinic()", () => {
  const clinic = [
    { name: "Whitening", price: 4500 },
    { name: "Deep Cleaning", price: 2500 },
    { name: "Free Checkup", price: 0 },
  ];

  it("uses the clinic's own price when listed", () => {
    expect(getServicePriceForClinic("Whitening", clinic)).toBe(4500);
  });

  it("matches partially against clinic service names", () => {
    expect(getServicePriceForClinic("Cleaning", clinic)).toBe(2500);
  });

  it("ignores non-positive clinic prices and uses the catalog", () => {
    expect(getServicePriceForClinic("Checkup", [{ name: "Checkup", price: 0 }])).toBe(300);
  });

  it("falls back to the catalog with no clinic list", () => {
    expect(getServicePriceForClinic("Whitening", [])).toBe(5000);
    expect(getServicePriceForClinic("Whitening")).toBe(5000);
  });
});

describe("resolveBaseAmount() — server and billing page agree on the price", () => {
  it("uses the billing row's final_amount first", () => {
    expect(resolveBaseAmount({ amount: 5000, final_amount: 4200 }, "Whitening")).toBe(4200);
  });

  it("uses the billing row's amount when final_amount is missing", () => {
    expect(resolveBaseAmount({ amount: 1800, final_amount: null }, "Whitening")).toBe(1800);
  });

  it("accepts numeric strings from Postgres NUMERIC columns", () => {
    expect(resolveBaseAmount({ amount: "1500.00", final_amount: "1500.00" }, "X")).toBe(1500);
  });

  it("falls back to the clinic/catalog price without a usable billing row", () => {
    expect(resolveBaseAmount(null, "Whitening")).toBe(5000);
    expect(resolveBaseAmount({ amount: 0, final_amount: 0 }, "Whitening", [{ name: "Whitening", price: 4500 }])).toBe(4500);
  });
});

describe("computeCheckoutTotal() — statutory PWD/Senior discount", () => {
  it("applies 20% for an approved PWD", () => {
    expect(computeCheckoutTotal(5000, "pwd", "approved")).toEqual({
      baseAmount: 5000,
      discountType: "pwd",
      discountAmount: 1000,
      finalAmount: 4000,
    });
  });

  it("applies 20% for an approved Senior Citizen", () => {
    const t = computeCheckoutTotal(300, "senior", "approved");
    expect(t.discountType).toBe("senior");
    expect(t.finalAmount).toBe(240);
  });

  it.each(["pending", "rejected", "none", null, undefined])("charges full price when approval is %s", (status) => {
    const t = computeCheckoutTotal(5000, "pwd", status as any);
    expect(t.discountType).toBe("none");
    expect(t.discountAmount).toBe(0);
    expect(t.finalAmount).toBe(5000);
  });

  it("charges full price when no discount is requested, even if approved", () => {
    expect(computeCheckoutTotal(5000, "none", "approved").finalAmount).toBe(5000);
  });

  it("ignores unknown discount types", () => {
    expect(computeCheckoutTotal(5000, "insurance", "approved").finalAmount).toBe(5000);
  });

  it("rounds to centavos", () => {
    const t = computeCheckoutTotal(333.33, "pwd", "approved");
    expect(t.discountAmount).toBe(66.67);
    expect(t.finalAmount).toBe(266.66);
  });
});
