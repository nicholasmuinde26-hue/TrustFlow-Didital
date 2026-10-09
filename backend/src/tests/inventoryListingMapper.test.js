import { describe, it } from "node:test";
import assert from "node:assert";
import { effectiveOnlinePrice, listingFieldsFromItem } from "../modules/marketplace/inventoryListingMapper.js";

const item = (over = {}) => ({
  name: "Dish Soap 750ml",
  description: "Lemon scent",
  price: 260,
  online_price: null,
  quantity: 42,
  track_stock: true,
  visible_online: true,
  status: "active",
  category: "Household",
  image_url: "",
  ...over,
});

describe("inventory -> marketplace listing mapping", () => {
  it("uses the in-store price when no online price is set", () => {
    assert.strictEqual(effectiveOnlinePrice(item()), 260);
    assert.strictEqual(effectiveOnlinePrice(item({ online_price: 0 })), 260);
  });

  it("prefers the online price when set", () => {
    assert.strictEqual(effectiveOnlinePrice(item({ online_price: 300 })), 300);
    assert.strictEqual(listingFieldsFromItem(item({ online_price: 300 })).price, 300);
  });

  it("mirrors stock, and never goes negative", () => {
    assert.strictEqual(listingFieldsFromItem(item({ quantity: 7 })).stock, 7);
    assert.strictEqual(listingFieldsFromItem(item({ quantity: -3 })).stock, 0);
  });

  it("does not track stock for services and menu items", () => {
    const f = listingFieldsFromItem(item({ track_stock: false, quantity: 99 }));
    assert.strictEqual(f.track_stock, false);
    assert.strictEqual(f.stock, 0);
  });

  it("hides the listing when the item is hidden or archived", () => {
    assert.strictEqual(listingFieldsFromItem(item()).visibility, "public");
    assert.strictEqual(listingFieldsFromItem(item({ visible_online: false })).visibility, "unlisted");
    assert.strictEqual(listingFieldsFromItem(item({ status: "archived" })).visibility, "unlisted");
  });

  it("only overwrites photos when the item has one", () => {
    assert.strictEqual("images" in listingFieldsFromItem(item()), false);
    const f = listingFieldsFromItem(item({ image_url: "data:image/png;base64,AAA" }));
    assert.deepStrictEqual(f.images, ["data:image/png;base64,AAA"]);
    assert.strictEqual(f.thumbnail, "data:image/png;base64,AAA");
  });

  it("copies category and trims the short description to 160 chars", () => {
    const f = listingFieldsFromItem(item({ description: "x".repeat(400) }));
    assert.strictEqual(f.subcategory, "Household");
    assert.strictEqual(f.short_description.length, 160);
  });
});
