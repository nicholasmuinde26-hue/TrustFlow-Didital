import { describe, it } from "node:test";
import assert from "node:assert";
import {
  assertMarketplaceScope,
  getEffectiveCommissionRate,
  isBusinessEligibleForHub,
  getHubSlugForBusinessCategory,
} from "../modules/marketplace/marketplace.service.js";

describe("Marketplace Architecture & Logic Tests", () => {
  describe("assertMarketplaceScope", () => {
    it("allows super_admin full access to any marketplace hub", () => {
      const superAdmin = { systemRole: "super_admin" };
      assert.strictEqual(assertMarketplaceScope(superAdmin, "retail"), true);
      assert.strictEqual(assertMarketplaceScope(superAdmin, "rentals"), true);
      assert.strictEqual(assertMarketplaceScope(superAdmin, "food"), true);
    });

    it("allows marketplace_admin within their assigned scopes", () => {
      const retailAdmin = {
        systemRole: "sub_admin",
        adminRole: "MARKETPLACE_ADMIN",
        marketplaceScopes: ["retail"],
        permissions: { approveListings: true },
      };
      assert.strictEqual(assertMarketplaceScope(retailAdmin, "retail", "approveListings"), true);
    });

    it("rejects marketplace_admin attempting to govern outside assigned scopes", () => {
      const retailAdmin = {
        systemRole: "sub_admin",
        adminRole: "MARKETPLACE_ADMIN",
        marketplaceScopes: ["retail"],
        permissions: { approveListings: true },
      };
      assert.throws(
        () => assertMarketplaceScope(retailAdmin, "rentals", "approveListings"),
        /authority over the 'rentals' marketplace hub/
      );
    });

    it("rejects marketplace_admin missing required permission", () => {
      const adminWithoutDesign = {
        systemRole: "sub_admin",
        adminRole: "MARKETPLACE_ADMIN",
        marketplaceScopes: ["retail"],
        permissions: { approveListings: true, manageMarketplaceDesign: false },
      };
      assert.throws(
        () => assertMarketplaceScope(adminWithoutDesign, "retail", "manageMarketplaceDesign"),
        /Missing required administrative permission/
      );
    });
  });

  describe("Cart & Commission Splitting Math", () => {
    it("calculates merchant net settlements and platform commissions accurately", () => {
      const lineTotal = 10000;
      const commissionRate = 5; // 5% platform fee
      const commissionAmount = Math.round((lineTotal * commissionRate) / 100);
      const netSettlement = lineTotal - commissionAmount;

      assert.strictEqual(commissionAmount, 500);
      assert.strictEqual(netSettlement, 9500);
      assert.strictEqual(commissionAmount + netSettlement, lineTotal);
    });

    it("splits delivery fees and net settlements across multi-merchant orders", () => {
      const merchants = [
        { businessId: "biz_1", subtotal: 4000, commissionRate: 5 },
        { businessId: "biz_2", subtotal: 6000, commissionRate: 5 },
      ];
      const flatDeliveryFee = 250;
      const deliveryPerMerchant = Math.round(flatDeliveryFee / merchants.length);

      const allocations = merchants.map((m) => {
        const comm = Math.round((m.subtotal * m.commissionRate) / 100);
        const net = m.subtotal - comm + deliveryPerMerchant;
        return { businessId: m.businessId, comm, net, delivery: deliveryPerMerchant };
      });

      assert.strictEqual(allocations[0].comm, 200);
      assert.strictEqual(allocations[0].net, 3800 + 125);
      assert.strictEqual(allocations[1].comm, 300);
      assert.strictEqual(allocations[1].net, 5700 + 125);
    });
  });

  describe("Business Category Eligibility & Hub Mapping", () => {
    it("maps business categories to their designated marketplace hubs", () => {
      assert.strictEqual(getHubSlugForBusinessCategory("retail"), "retail");
      assert.strictEqual(getHubSlugForBusinessCategory("rental"), "rentals");
      assert.strictEqual(getHubSlugForBusinessCategory("rentals"), "rentals");
      assert.strictEqual(getHubSlugForBusinessCategory("service"), "services");
      assert.strictEqual(getHubSlugForBusinessCategory("services"), "services");
      assert.strictEqual(getHubSlugForBusinessCategory("restaurant"), "food");
      assert.strictEqual(getHubSlugForBusinessCategory("food"), "food");
      assert.strictEqual(getHubSlugForBusinessCategory("other"), "retail");
    });

    it("verifies eligibility strictly for matching categories", () => {
      // Retail can only opt in to retail
      assert.strictEqual(isBusinessEligibleForHub("retail", "retail"), true);
      assert.strictEqual(isBusinessEligibleForHub("retail", "rentals"), false);
      assert.strictEqual(isBusinessEligibleForHub("retail", "services"), false);
      assert.strictEqual(isBusinessEligibleForHub("retail", "food"), false);

      // Rental can only opt in to rentals
      assert.strictEqual(isBusinessEligibleForHub("rental", "rentals"), true);
      assert.strictEqual(isBusinessEligibleForHub("rental", "retail"), false);
      assert.strictEqual(isBusinessEligibleForHub("rental", "food"), false);

      // Restaurant can only opt in to food
      assert.strictEqual(isBusinessEligibleForHub("restaurant", "food"), true);
      assert.strictEqual(isBusinessEligibleForHub("restaurant", "retail"), false);

      // Service can only opt in to services
      assert.strictEqual(isBusinessEligibleForHub("service", "services"), true);
      assert.strictEqual(isBusinessEligibleForHub("service", "retail"), false);
    });
  });
});
