/**
 * Proof of the no-leak rule: redactForCounterparty() strips every matching
 * input (price band, location, ttl, status) from every card - including every
 * valid card the protocol package ships as an example.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  offering,
  lookingFor,
  redactForCounterparty,
  assertNoLeak,
  schemaPackageRoot,
  type IntentCard,
} from "../src/index.js";

describe("redactForCounterparty proves the no-leak rule", () => {
  it("strips the reserve floor from an offering listing but keeps the deliberate ask", () => {
    const card = offering({
      category: "goods.bicycle.road",
      geo: { bucket: "r3gx" },
      reserve: { min: 450, ccy: "AUD" },
      ask: { amount: 650, ccy: "AUD" },
      attributes: { condition: "like-new" },
    });
    const view = redactForCounterparty(card);
    expect(view).toEqual({
      type: "offering",
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

  it("strips the budget ceiling from a looking-for listing entirely", () => {
    const card = lookingFor({
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

  it("keeps the place name back, the same as the cell it resolves to", () => {
    // A place is a matching input and never a disclosure: the details-step message the
    // server builds carries attributes and a stated ask and nothing else, and
    // its schema has no slot for a location at all. Where someone is reaches a
    // counterparty at the names step, from the locality on the profile that human
    // filled in for it, once both sides have opted in.
    const card = offering({
      category: "goods.furniture.sofa",
      geo: { place: "Newtown, NSW", bucket: "r3gx", radius_km: 15 },
      ask: { amount: 120, ccy: "AUD" },
      attributes: { condition: "good" },
    });
    const view = redactForCounterparty(card);
    const blob = JSON.stringify(view);
    for (const leak of ["Newtown", "NSW", "r3gx", "place", "bucket", "geo", "15"]) {
      expect(blob).not.toContain(leak);
    }
    expect(() => assertNoLeak(view)).not.toThrow();
    expect(() => assertNoLeak({ ...view, place: "Newtown, NSW" })).toThrow(/leaked/);
  });

  it("holds for every valid card fixture in the protocol suite", () => {
    const dir = join(schemaPackageRoot, "fixtures");
    const cards = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
      .filter((fx) => fx.schema === "intent-card" && fx.valid)
      .map((fx) => fx.data as IntentCard);
    expect(cards.length).toBeGreaterThanOrEqual(5);
    expect(cards.filter((c) => c.geo.place !== undefined).length).toBeGreaterThanOrEqual(2);
    for (const card of cards) {
      const view = redactForCounterparty(card);
      expect(() => assertNoLeak(view)).not.toThrow();
      const blob = JSON.stringify(view);
      expect(blob).not.toContain('"price"');
      expect(blob).not.toContain('"band"');
      if (card.geo.place !== undefined) expect(blob).not.toContain(card.geo.place);
      if (card.geo.bucket !== undefined) expect(blob).not.toContain(card.geo.bucket);
      if (card.price?.band.min !== undefined) {
        expect(blob).not.toContain(String(card.price.band.min));
      }
      if (card.price?.band.max !== undefined) {
        expect(blob).not.toContain(String(card.price.band.max));
      }
    }
  });

  it("assertNoLeak catches a leaky view", () => {
    expect(() => assertNoLeak({ type: "offering", price: { band: { min: 1 } } })).toThrow(
      /leaked/,
    );
  });
});
