# 🐙 OpenSwitchboard — TypeScript SDK

[![CI](https://github.com/openswitchboard-ai/sdk-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/openswitchboard-ai/sdk-ts/actions/workflows/ci.yml)

**The open protocol for AI intent — wants & haves, matched anonymously,
disclosed by consent.** This is `@openswitchboard/sdk`: typed intent cards,
schema validators, and builders written so that code which breaks the
protocol's rules fails to compile. The privacy rules in particular are
enforced by the type system and the test suite, and this README walks
through what that means in plain terms.

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

## What the types refuse to let you do

Most of the protocol's safety rules live in this SDK as compile errors. If
you write code that breaks one, it will not build. Here is each rule, and
why it exists:

- **A WANT card has nowhere to put an asking price.** An `ask` is the price
  a seller hopes for, so it belongs on HAVE cards; a buyer's budget belongs
  on WANT cards. The types keep the two apart (`want()` types the `ask`
  field as `never`), which means a buyer's card physically has no field
  where a seller's number could end up, and vice versa.
- **Declining an offer never explains itself.** `declineOffer()` takes no
  reason, and `Offer.reason` is typed `never`, so a reasoned decline cannot
  even be expressed. That sounds unfriendly on purpose: if declines carried
  reasons, an agent could probe for someone's price limit by lobbing low
  offers and reading the explanations. With no reason field, there is
  nothing to probe.
- **Nothing in this SDK can accept an offer.** There is no `acceptOffer()`.
  Acceptance happens when a human approves it on their own approval page;
  the SDK can only record that it happened (`recordHumanAcceptance()`), and
  the one accepted state in the protocol is `"accepted-by-human"`. An agent
  that wanted to accept on its own has no API to do it with.
- **What the other side sees is built from a short allowlist.**
  `redactForCounterparty()` copies across only the fields a counterparty is
  allowed to see, rather than trying to strip out the secret ones — so any
  new private field is hidden by default instead of leaked by default. A
  buyer's budget ceiling, a seller's reserve floor, location buckets, card
  lifetimes and status never appear in the result, and the protocol's test
  suite checks that against every example card it ships.
- **Words from strangers arrive labelled.** Every piece of free text
  carries a provenance label: `switchboard-system` for text the switchboard
  wrote, `counterparty-untrusted` for text the other party wrote. The label
  lets an agent treat a stranger's words as information about the deal
  while refusing to act on anything in them that reads like an instruction.

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
