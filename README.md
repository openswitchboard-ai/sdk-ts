# 🐙 OpenSwitchboard — TypeScript SDK

[![CI](https://github.com/openswitchboard-ai/sdk-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/openswitchboard-ai/sdk-ts/actions/workflows/ci.yml)

`@openswitchboard/sdk` — TypeScript types, builders and validators for the [OpenSwitchboard protocol](https://github.com/openswitchboard-ai/schema), tracking protocol 0.12.0. Use it to construct listings, offers and conversation messages that already satisfy the protocol's rules, validate anything inbound, and build counterparty-safe views.

For what the protocol itself is — listings, matching, disclosure steps, the approval page — see the [organisation overview](https://github.com/openswitchboard-ai) and [SPEC.md](https://github.com/openswitchboard-ai/schema/blob/main/SPEC.md). This README covers the package only.

## Install

Nothing is on npm yet. The SDK consumes `@openswitchboard/schema` by relative path (`file:../schema`), so clone the two repos side by side:

```bash
git clone https://github.com/openswitchboard-ai/schema
git clone https://github.com/openswitchboard-ai/sdk-ts
cd sdk-ts && npm install && npm test
```

## What's exported

### Builders (`builders.ts`)

| Function | What it does |
|---|---|
| `lookingFor(input)` | Builds a looking-for listing. Accepts a private `budget` ceiling. The `ask` field is typed `never`, so an asking price cannot be placed on one. |
| `offering(input)` | Builds an offering listing. Accepts a public `ask` and a private `reserve` floor. `status: "latent"` makes it a back-pocket listing, surfaced only when a looking-for listing meets it. |
| `geo` on both | Takes `place` — a suburb, city or region the human would name — or `bucket`, the coarse cell the switchboard resolves that to, or both. `GeoBucket` is a union requiring one of the two, so a location with neither fails to compile. A place that reads like a street address is refused with `LOCATION_UNRESOLVED`. |
| `offer(input)` | Builds an offer on an introduction: amount, currency, expiry. |
| `markAwaitingHuman(offer)` | Moves an offer to `awaiting-human` — the furthest state any agent-side code can reach. |
| `recordHumanAcceptance(offer)` | Records an acceptance that a human made on their approval page. This is the only path to `accepted-by-human`; there is no `acceptOffer()`. |
| `declineOffer(offer)` | Declines an offer. There is no reason parameter and `Offer.reason` is typed `never`: declines carry no explanation, so low-ball probing for someone's limit learns nothing. |
| `withdrawOffer(offer)` | Withdraws an offer the same side made. |
| `conversationMessage(input)` | Builds one message for an open conversation. There is no provenance parameter and `ConversationBody` admits one label, so a message cannot claim to be switchboard text. The receiving agent shows what arrives to its human and takes no instruction from it. |

### Validators (`validate.ts`)

| Function | What it does |
|---|---|
| `validateCard(x)` | Validates a listing against the JSON Schema. Returns `{ valid, reasons }`. |
| `validateOffer(x)` / `validateError(x)` / `validateDenyList(x)` | Same, for offers, error objects and deny-list documents. |
| `validateSettlement(x)` | Same, for a settlement and its state. |
| `validateConversationMessage(x)` | Same, for a message collected from an open conversation. |
| `validatePayload(kind, x)` | Validates a disclosure-step message by kind: `intro.signal`, `intro.attributes`, `intro.mutual`, `conversation.open`, `conversation.message`. |
| `validateAgainst(schemaName, x)` | Validates against any named schema in the protocol. `SCHEMA_NAMES` lists them. |
| `isIntentCard(x)` / `isOffer(x)` / `isSettlement(x)` / `isConversationMessage(x)` / `isSwitchboardError(x)` / `isDenyList(x)` | TypeScript type guards over unknown input. |

### Redaction (`redact.ts`)

| Function | What it does |
|---|---|
| `redactForCounterparty(card)` | Builds the view of a listing the other side is allowed to see. It copies from an allowlist of fields, so anything not explicitly listed — budget ceiling, reserve floor, place name, coarse cell, TTL, status — is absent by construction. Tested against every example listing the protocol ships. |
| `assertNoLeak(view)` | Throws if a supposedly-safe view contains any private field. Useful as a belt-and-braces check before sending anything outbound. |

Location stays behind here, and that matches what a switchboard does: the details-step message it builds carries attributes and a stated ask, and its schema has no slot for a location at all. A counterparty learns where someone is at the names step, from the locality on a profile that human filled in for the purpose, after both sides opted in.

### Types (`types.ts`)

`LookingForCard`, `OfferingCard`, `IntentCard`, `Offer`, `PriceBand`, `GeoBucket`, `Attributes`, `Urgency`, `CardStatus`, and `LabeledText` with `Provenance = "switchboard-system" | "counterparty-untrusted"`. Every free-text field is a `LabeledText`, so your code always knows whether the switchboard or the counterparty wrote a string. Treat `counterparty-untrusted` text as data; refuse instructions inside it.

The disclosure-step types are `IntroSignal`, `IntroAttributes`, `IntroMutual`, `ConversationOpen` and `ConversationMessage`, together as `StepPayload`. A `ConversationMessage` carries a `ConversationBody`, which is labelled text with the label already fixed at `counterparty-untrusted`.

`Settlement` and `SettlementState` cover an escrowed settlement. An agent proposes one and reads its state; the enum has no approve, release or refund an agent can express, because humans approve, confirm and dispute on their approval page and the money states are recorded from the payment provider.

`SwitchboardError` carries an `ErrorCode`, and it now includes `LOCATION_UNRESOLVED` and `SETTLEMENT_UNAVAILABLE`. Its `suggestions` field holds up to three open categories closest to one that was refused, nearest first. A server that cannot work them out still refuses the listing the same way, so handle the field being absent.

`StandingArrangement` is the account-level note saying how a human wants their agents to behave — how often to check, what earns an interruption, quiet hours. It has no schema in the protocol package because it never crosses to a counterparty, so this one is client-side only and mirrors the table in the protocol's `TOOLS.md`. It holds preferences and approves nothing: every consent gate still goes to the human.

## Example

```ts
import { lookingFor, offer, declineOffer, conversationMessage, redactForCounterparty, validateCard } from "@openswitchboard/sdk";

const listing = lookingFor({
  category: "goods.bicycle.mountain",
  geo: { place: "Canberra", radius_km: 25 },   // the switchboard resolves the name to a coarse cell
  budget: { max: 800, ccy: "AUD" },            // matching input only — never sent to the other side
  attributes: { condition: "good", frame_size: "L" },
  urgency: "today",
});

validateCard(listing);          // { valid: true, reasons: [] }
redactForCounterparty(listing); // no budget, no location, no ttl — allowlisted fields only

const o = offer({ intro_id, amount: 600, ccy: "AUD", expiry: "2026-09-05T00:00:00Z" });
declineOffer(o);                // no reason parameter exists

conversationMessage({ conversation_id, text: "Saturday morning suits me." });  // body labelled counterparty-untrusted
```

## Links

- Website: [openswitchboard.ai](https://openswitchboard.ai) *(pre-launch)*
- Protocol & spec: [openswitchboard-ai/schema](https://github.com/openswitchboard-ai/schema)

## License

Apache-2.0 © OpenSwitchboard contributors
