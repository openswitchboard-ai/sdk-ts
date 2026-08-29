/**
 * The no-leak rule, proven in code.
 *
 * A card's price band (budget ceiling on a WANT, reserve floor on a HAVE) is
 * a MATCHING INPUT: the switchboard may use it to decide whether two cards
 * meet, but it is never disclosed to a counterparty. Only deliberate terms -
 * the ask on a HAVE, or an offer message - cross the wire.
 *
 * redactForCounterparty() is allowlist-based: it constructs the outgoing
 * view field by field and never spreads the card, so a new private field
 * added to IntentCard later is excluded by default rather than leaked by
 * default.
 */
import type { Ask, Attributes, Category, IntentCard, Urgency } from "./types.js";

/** The most a counterparty can ever learn about a card (stage-2 ceiling). */
export interface CounterpartyView {
  type: "WANT" | "HAVE";
  category: Category;
  attributes: Attributes;
  urgency: Urgency;
  /** Present only when a HAVE deliberately states an asking price. */
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
  if (card.type === "HAVE" && card.ask) {
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
  for (const forbidden of ['"price"', '"band"', '"geo"', '"ttl_days"', '"status"']) {
    if (blob.includes(forbidden)) {
      throw new Error(`matching input leaked into counterparty view: ${forbidden}`);
    }
  }
}
