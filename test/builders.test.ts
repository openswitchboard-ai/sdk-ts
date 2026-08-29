import { describe, it, expect } from "vitest";
import {
  want,
  have,
  offer,
  markAwaitingHuman,
  recordHumanAcceptance,
  declineOffer,
  withdrawOffer,
  validateCard,
  validateOffer,
} from "../src/index.js";

const geo = { bucket: "r3gx", radius_km: 20 };
const MID = "0d9f2c1e-7b4a-4f7e-9c2d-1a2b3c4d5e6f";

describe("card builders emit schema-valid cards", () => {
  it("want() with budget ceiling", () => {
    const card = want({
      category: "goods.bicycle.mountain",
      geo,
      budget: { max: 800, ccy: "AUD" },
      attributes: { condition: "good", frame_size: "L" },
      urgency: "today",
      ttl_days: 7,
    });
    expect(validateCard(card).reasons).toEqual([]);
    expect(card.type).toBe("WANT");
    // The type makes an ask unrepresentable on a WANT:
    // @ts-expect-error - ask cannot exist on a WantCard
    card.ask = { amount: 1, ccy: "AUD" };
  });

  it("have() latent with reserve floor and ask", () => {
    const card = have({
      category: "goods.bicycle.road",
      geo,
      reserve: { min: 450, ccy: "AUD" },
      ask: { amount: 650, ccy: "AUD" },
      latent: true,
    });
    expect(validateCard(card).reasons).toEqual([]);
    expect(card.status).toBe("latent");
    expect(card.price?.band.min).toBe(450);
  });

  it("minimal want() applies protocol defaults", () => {
    const card = want({ category: "goods.baby.stroller", geo: { bucket: "r1r0" } });
    expect(validateCard(card).reasons).toEqual([]);
    expect(card.visibility).toBe("anonymous-until-match");
    expect(card.status).toBe("active");
    expect(card.ttl_days).toBe(60);
    expect(card.urgency).toBe("none");
  });
});

describe("offer builders and the human-only accept", () => {
  const base = offer({
    match_id: MID,
    amount: 600,
    ccy: "AUD",
    expiry: "2026-09-05T00:00:00Z",
    message: { text: "Can collect this weekend." },
  });

  it("proposed offers are schema-valid and provenance-labelled", () => {
    expect(validateOffer(base).reasons).toEqual([]);
    expect(base.state).toBe("proposed");
    expect(base.message?.provenance).toBe("counterparty-untrusted");
  });

  it("every transition emits a schema-valid offer", () => {
    for (const next of [
      markAwaitingHuman(base),
      recordHumanAcceptance(base),
      declineOffer(base),
      withdrawOffer(base),
    ]) {
      expect(validateOffer(next).reasons).toEqual([]);
    }
  });

  it("there is no way to express an agent accept or a decline reason", () => {
    expect(recordHumanAcceptance(base).state).toBe("accepted-by-human");
    const declined = declineOffer(base);
    expect(declined.state).toBe("declined");
    expect("reason" in declined).toBe(false);
    // declineOffer's signature admits no reason:
    // @ts-expect-error - declineOffer takes exactly one argument
    declineOffer(base, "too low");
    // and the schema rejects a smuggled one:
    expect(validateOffer({ ...declined, reason: "too low" }).valid).toBe(false);
  });
});
