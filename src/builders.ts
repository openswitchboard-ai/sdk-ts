/**
 * Builders that make invalid states unrepresentable where practical:
 *
 * - want() has no way to attach an ask (the type forbids it).
 * - declineOffer() takes no reason parameter, and Offer.reason is `never` -
 *   a decline reason cannot be expressed (anti-probing by design).
 * - There is no acceptOffer(): agents cannot accept. The only path to an
 *   accepted state is recordHumanAcceptance(), which exists precisely so the
 *   call site reads as what it must be - a recorded human decision.
 * - channelMessage() has no provenance parameter: a message carried across a
 *   channel is always the other side's words, and the label says so.
 */
import { randomUUID } from "node:crypto";
import type {
  Ask,
  Attributes,
  Ccy,
  Category,
  ChannelMessage,
  GeoBucket,
  HaveCard,
  Offer,
  PriceBand,
  Urgency,
  WantCard,
} from "./types.js";

export const SCHEMA_VERSION = "0.5.0";

export interface WantInput {
  category: Category;
  /** A place name, a canonical cell, or both. Matching input only. */
  geo: GeoBucket;
  /** Budget ceiling - matching input only, never disclosed. */
  budget?: { max: number; min?: number; ccy: Ccy };
  attributes?: Attributes;
  urgency?: Urgency;
  latent?: boolean;
  ttl_days?: number;
}

export function want(input: WantInput): WantCard {
  const card: WantCard = {
    schema_version: SCHEMA_VERSION,
    type: "WANT",
    category: input.category,
    geo: input.geo,
    visibility: "anonymous-until-match",
    status: input.latent ? "latent" : "active",
    urgency: input.urgency ?? "none",
    ttl_days: input.ttl_days ?? 60,
  };
  if (input.budget) {
    const band: PriceBand["band"] = { max: input.budget.max };
    if (input.budget.min !== undefined) band.min = input.budget.min;
    card.price = { band, ccy: input.budget.ccy };
  }
  if (input.attributes) card.attributes = input.attributes;
  return card;
}

export interface HaveInput {
  category: Category;
  /** A place name, a canonical cell, or both. Matching input only. */
  geo: GeoBucket;
  /** Reserve floor - matching input only, never disclosed. */
  reserve?: { min: number; ccy: Ccy };
  /** Deliberate, disclosable asking price. */
  ask?: Ask;
  attributes?: Attributes;
  urgency?: Urgency;
  latent?: boolean;
  ttl_days?: number;
}

export function have(input: HaveInput): HaveCard {
  const card: HaveCard = {
    schema_version: SCHEMA_VERSION,
    type: "HAVE",
    category: input.category,
    geo: input.geo,
    visibility: "anonymous-until-match",
    status: input.latent ? "latent" : "active",
    urgency: input.urgency ?? "none",
    ttl_days: input.ttl_days ?? 60,
  };
  if (input.reserve) {
    card.price = { band: { min: input.reserve.min }, ccy: input.reserve.ccy };
  }
  if (input.ask) card.ask = input.ask;
  if (input.attributes) card.attributes = input.attributes;
  return card;
}

export interface OfferInput {
  match_id: string;
  amount: number;
  ccy: Ccy;
  /** ISO date-time. */
  expiry: string;
  message?: { text: string };
}

/** Propose an offer. Outgoing free text is labelled counterparty-untrusted
 * because that is what it is to the receiving side. */
export function offer(input: OfferInput): Offer {
  const o: Offer = {
    schema_version: SCHEMA_VERSION,
    kind: "offer",
    offer_id: randomUUID(),
    match_id: input.match_id,
    amount: input.amount,
    ccy: input.ccy,
    expiry: input.expiry,
    state: "proposed",
  };
  if (input.message) {
    o.message = { text: input.message.text, provenance: "counterparty-untrusted" };
  }
  return o;
}

/** Park an offer for the human's decision. */
export function markAwaitingHuman(o: Offer): Offer {
  return { ...o, state: "awaiting-human" };
}

/**
 * Record that the HUMAN accepted. This is the only way to reach an accepted
 * state; there is deliberately no acceptOffer() for agents.
 */
export function recordHumanAcceptance(o: Offer): Offer {
  return { ...o, state: "accepted-by-human" };
}

/**
 * Decline an offer. Note the signature: there is no reason parameter, and
 * none can be smuggled in - Offer.reason is typed `never` and the schema
 * rejects it. A decline is just a decline (anti-probing).
 */
export function declineOffer(o: Offer): Offer {
  return { ...o, state: "declined" };
}

/** Withdraw a proposed offer. */
export function withdrawOffer(o: Offer): Offer {
  return { ...o, state: "withdrawn" };
}

export interface ChannelMessageInput {
  /** The channel to send on, as issued by channel.open. */
  channel_id: string;
  text: string;
  /** ISO date-time. Defaults to now. */
  sent_at?: string;
  /** Position in the batch being handed over, counting from 1. */
  seq?: number;
}

/**
 * Build one message for an open channel. Note the signature again: there is
 * no provenance parameter and ChannelBody admits one value, so a message
 * cannot be built claiming to be switchboard text. Whatever this carries, the
 * agent receiving it is told to show it to its human rather than act on it.
 */
export function channelMessage(input: ChannelMessageInput): ChannelMessage {
  const msg: ChannelMessage = {
    schema_version: SCHEMA_VERSION,
    kind: "channel.message",
    channel_id: input.channel_id,
    message_id: randomUUID(),
    sent_at: input.sent_at ?? new Date().toISOString(),
    body: { text: input.text, provenance: "counterparty-untrusted" },
  };
  if (input.seq !== undefined) msg.seq = input.seq;
  return msg;
}
