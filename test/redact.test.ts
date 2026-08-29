/**
 * Proof of the no-leak rule: redactForCounterparty() strips every matching
 * input (price band, geo, ttl, status) from every card - including every
 * valid card fixture shipped with the protocol.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  have,
  want,
  redactForCounterparty,
  assertNoLeak,
  schemaPackageRoot,
  type IntentCard,
} from "../src/index.js";

describe("redactForCounterparty proves the no-leak rule", () => {
  it("strips the reserve floor from a HAVE but keeps the deliberate ask", () => {
    const card = have({
      category: "goods.bicycle.road",
      geo: { bucket: "r3gx" },
      reserve: { min: 450, ccy: "AUD" },
      ask: { amount: 650, ccy: "AUD" },
      attributes: { condition: "like-new" },
    });
    const view = redactForCounterparty(card);
    expect(view).toEqual({
      type: "HAVE",
      category: "goods.bicycle.road",
      attributes: { condition: "like-new" },
      urgency: "none",
      ask: { amount: 650, ccy: "AUD" },
    });
    const blob = JSON.stringify(view);
    expect(blob).not.toContain("450"); // the reserve number itself is gone
    expect(blob).not.toContain("price");
    expect(blob).not.toContain("band");
    expect(() => assertNoLeak(view)).not.toThrow();
  });

  it("strips the budget ceiling from a WANT entirely", () => {
    const card = want({
      category: "goods.electronics.laptop",
      geo: { bucket: "dr5r", radius_km: 15 },
      budget: { min: 200, max: 900, ccy: "USD" },
      urgency: "days",
    });
    const view = redactForCounterparty(card);
    expect("ask" in view).toBe(false);
    const blob = JSON.stringify(view);
    for (const leak of ["price", "band", "200", "900", "geo", "bucket"]) {
      expect(blob).not.toContain(leak);
    }
    expect(() => assertNoLeak(view)).not.toThrow();
  });

  it("holds for every valid card fixture in the protocol suite", () => {
    const dir = join(schemaPackageRoot, "fixtures");
    const cards = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
      .filter((fx) => fx.schema === "intent-card" && fx.valid)
      .map((fx) => fx.data as IntentCard);
    expect(cards.length).toBeGreaterThanOrEqual(5);
    for (const card of cards) {
      const view = redactForCounterparty(card);
      expect(() => assertNoLeak(view)).not.toThrow();
      const blob = JSON.stringify(view);
      expect(blob).not.toContain('"price"');
      expect(blob).not.toContain('"band"');
      if (card.price?.band.min !== undefined) {
        expect(blob).not.toContain(String(card.price.band.min));
      }
      if (card.price?.band.max !== undefined) {
        expect(blob).not.toContain(String(card.price.band.max));
      }
    }
  });

  it("assertNoLeak catches a leaky view", () => {
    expect(() => assertNoLeak({ type: "HAVE", price: { band: { min: 1 } } })).toThrow(
      /leaked/,
    );
  });
});
