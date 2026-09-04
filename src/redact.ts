/**
 * The no-leak rule, proven in code.
 *
 * A listing's price band (budget ceiling on a looking-for listing, reserve
 * floor on an offering listing) is a MATCHING INPUT: the switchboard may use it
 * to decide whether two listings meet, and it is never disclosed to a
 * counterparty. Only deliberate terms cross the wire - the ask on an offering
 * listing, or an offer message.
 *
 * redactForCounterparty() is allowlist-based: it constructs the outgoing
 * view field by field and never spreads the card, so a new private field
 * added to IntentCard later is excluded by default and never leaked by
 * default. The place name a human gave for their listing is one such field: it
 * is a matching input like the cell it resolves to, and it stays behind. A
 * counterparty learns where someone is at the names step, from the locality on
 * a profile that human filled in for the purpose, after both sides opted in.
 */
import type { Ask, Attributes, Category, IntentCard, Urgency } from "./types.js";

/** The most a counterparty can ever learn about a listing (the details-step ceiling). */
export interface CounterpartyView {
  type: "looking_for" | "offering";
  category: Category;
  attributes: Attributes;
  urgency: Urgency;
  /** Present only when an offering listing deliberately states an asking price. */
  ask?: Ask;
}

const DISCLOSABLE_KEYS = ["type", "category", "attributes", "urgency", "ask"] as const;

export function redactForCounterparty(card: IntentCard): CounterpartyView {
  const view: CounterpartyView = {
    type: card.type,
    category: card.category,
    attributes: { ...(card.attributes ?? {}) },
    urgency: card.urgency ?? "none",
  };
  if (card.type === "offering" && card.ask) {
    view.ask = { amount: card.ask.amount, ccy: card.ask.ccy };
  }
  return view;
}

/**
 * Belt-and-braces runtime assertion used in tests (and available to
 * implementers): verifies a counterparty view leaks no matching inputs.
 */
export function assertNoLeak(view: object): void {
  const keys = Object.keys(view);
  for (const k of keys) {
    if (!(DISCLOSABLE_KEYS as readonly string[]).includes(k)) {
      throw new Error(`non-disclosable field leaked to counterparty view: ${k}`);
    }
  }
  const blob = JSON.stringify(view);
  for (const forbidden of [
    '"price"',
    '"band"',
    '"geo"',
    '"place"',
    '"bucket"',
    '"ttl_days"',
    '"status"',
  ]) {
    if (blob.includes(forbidden)) {
      throw new Error(`matching input leaked into counterparty view: ${forbidden}`);
    }
  }
}
