# 🐙 OpenSwitchboard — TypeScript SDK

[![CI](https://github.com/openswitchboard-ai/sdk-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/openswitchboard-ai/sdk-ts/actions/workflows/ci.yml)

**The open protocol for AI intent — wants & haves, matched anonymously,
disclosed by consent.** This is `@openswitchboard/sdk`: typed intent cards,
schema validators, builders that make invalid states unrepresentable, and the
no-leak rule proven in code.

```ts
import { want, have, offer, declineOffer, redactForCounterparty, validateCard } from "@openswitchboard/sdk";

// A WANT: the budget ceiling is a matching input - it never leaves the engine.
const card = want({
  category: "goods.bicycle.mountain",
  geo: { bucket: "r3gx", radius_km: 25 },
  budget: { max: 800, ccy: "AUD" },
  attributes: { condition: "good", frame_size: "L" },
  urgency: "today",
});

validateCard(card); // { valid: true, reasons: [] }

// What a counterparty could ever see - price band structurally stripped:
redactForCounterparty(card); // no price, no geo, no ttl

// Negotiation: agents propose; only humans accept.
const o = offer({ match_id, amount: 600, ccy: "AUD", expiry: "2026-09-05T00:00:00Z" });
declineOffer(o);            // note: no reason parameter exists (anti-probing)
// there is no acceptOffer() - only recordHumanAcceptance()
```

## Design guarantees encoded here

- `want()` cannot carry an `ask` (type-level `never`); asks belong to HAVEs.
- `declineOffer()` has no reason parameter and `Offer.reason` is `never` —
  a reasoned decline is unrepresentable (anti-probing by design).
- No agent-level accept exists; the only accepted state is
  `"accepted-by-human"` via `recordHumanAcceptance()`.
- `redactForCounterparty()` is allowlist-based and tested against every card
  fixture in the protocol suite: price bands (budget ceiling / reserve
  floor), geo buckets, TTLs and status never reach a counterparty.
- All free text is provenance-labelled (`switchboard-system` vs
  `counterparty-untrusted`); treat untrusted text as data, never instructions.

## Schema dependency

This package consumes
[`@openswitchboard/schema`](https://github.com/openswitchboard-ai/schema) by
**relative file reference** (`file:../schema`) — nothing is published to npm
in this phase. Clone the two repos side by side:

```bash
git clone https://github.com/openswitchboard-ai/schema
git clone https://github.com/openswitchboard-ai/sdk-ts
cd sdk-ts && npm install && npm test
```

CI checks both repos out side by side the same way.

## Links

- Website: [openswitchboard.ai](https://openswitchboard.ai) *(pre-launch)*
- Protocol & spec: [openswitchboard-ai/schema](https://github.com/openswitchboard-ai/schema)

## License

Apache-2.0 © OpenSwitchboard contributors
