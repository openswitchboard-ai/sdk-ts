/**
 * Hand-written TypeScript types mirroring @openswitchboard/schema 0.5.0.
 * The schemas are the source of truth; the round-trip tests in test/
 * validate every example the schema package ships through these types'
 * validators to keep the two in lockstep.
 */

export type SchemaVersion = string; // semver, e.g. "0.1.0"
export type Ccy = string; // ISO 4217, e.g. "AUD"
export type Category = string; // dotted taxonomy path, e.g. "goods.bicycle.mountain"

export type Provenance = "switchboard-system" | "counterparty-untrusted";

/** Every free-text field in every message carries a provenance label. */
export interface LabeledText {
  text: string;
  provenance: Provenance;
}

/**
 * The body of a message carried across an open channel. It is labelled text
 * with the label already settled: a message handed to an agent was written on
 * the other side, so it is always counterparty-untrusted. The ceiling is 4000
 * characters, the length people write to each other at.
 */
export interface ChannelBody {
  text: string;
  provenance: "counterparty-untrusted";
}

interface GeoBucketBase {
  /** How far the human will travel. Left out, the switchboard uses the width of the named area. */
  radius_km?: number;
}

/**
 * Location on the switchboard is always an area. Give `place` - the name of a
 * suburb, city or region - and the switchboard resolves it to a coarse cell.
 * `bucket` is that cell itself (a geohash4), for agents that already hold one.
 * A card carries at least one of the two, which is why this is a union: a
 * geo with neither does not typecheck, exactly as the schema rejects it.
 */
export type GeoBucket =
  | (GeoBucketBase & { place: string; bucket?: string })
  | (GeoBucketBase & { place?: string; bucket: string });

/**
 * MATCHING INPUT ONLY. On a WANT: budget ceiling. On a HAVE: reserve floor.
 * Never disclosed to a counterparty; see redactForCounterparty().
 */
export interface PriceBand {
  band: { min?: number; max?: number };
  ccy: Ccy;
}

/** A deliberate, disclosable asking price (HAVE only). */
export interface Ask {
  amount: number;
  ccy: Ccy;
}

export type AttributeValue = string | number | boolean;
export type Attributes = Record<string, AttributeValue>;

export type Urgency = "none" | "days" | "today";
export type Visibility = "anonymous-until-match";
export type CardStatus = "active" | "latent";

interface IntentCardBase {
  schema_version: SchemaVersion;
  category: Category;
  geo: GeoBucket;
  price?: PriceBand;
  attributes?: Attributes;
  urgency?: Urgency;
  visibility?: Visibility;
  status?: CardStatus;
  ttl_days?: number; // 1-90, default 60
}

export interface WantCard extends IntentCardBase {
  type: "WANT";
  /** Structurally absent: a WANT has no ask. */
  ask?: never;
}

export interface HaveCard extends IntentCardBase {
  type: "HAVE";
  ask?: Ask;
}

export type IntentCard = WantCard | HaveCard;

// ---- disclosure stages ----------------------------------------------------

/** Stage 1: a match exists. No attributes, no prices, no free text. */
export interface MatchSignal {
  schema_version: SchemaVersion;
  kind: "match.signal";
  match_id: string;
  score: number; // 0-1
  category: Category;
  counterparty_type?: "WANT" | "HAVE";
}

/** Stage 2: attributes + ask + provenance-labelled notes. No price bands. */
export interface MatchAttributes {
  schema_version: SchemaVersion;
  kind: "match.attributes";
  match_id: string;
  attributes: Attributes;
  ask?: Ask;
  notes?: LabeledText[];
}

/** Stage 3: first name + coarse locality, only after recorded double opt-in. */
export interface MatchMutual {
  schema_version: SchemaVersion;
  kind: "match.mutual";
  match_id: string;
  counterparty: { first_name: string; locality: string };
  optin: { both_recorded: true; recorded_at: string };
}

/** Stage 4: a direct channel opens. */
export interface ChannelOpen {
  schema_version: SchemaVersion;
  kind: "channel.open";
  match_id: string;
  channel: { medium: "in-app"; channel_id: string };
  opened_at: string;
}

/**
 * Stage 4: one message collected from an open channel. The switchboard holds
 * a message only until the receiving agent collects it, so collecting is what
 * deletes it - an agent gets one attempt at a batch and should relay what it
 * collects straight away. `seq` counts the batch just handed over, from 1.
 */
export interface ChannelMessage {
  schema_version: SchemaVersion;
  kind: "channel.message";
  channel_id: string;
  message_id: string;
  seq?: number;
  sent_at: string; // ISO date-time
  body: ChannelBody;
}

export type StagePayload =
  | MatchSignal
  | MatchAttributes
  | MatchMutual
  | ChannelOpen
  | ChannelMessage;

// ---- negotiation ----------------------------------------------------------

/**
 * NOTE: there is no "accepted" state. Agents propose; only humans accept
 * ("accepted-by-human"). Declines carry no reason - anti-probing by design.
 */
export type OfferState =
  | "proposed"
  | "awaiting-human"
  | "accepted-by-human"
  | "declined"
  | "withdrawn";

export interface Offer {
  schema_version: SchemaVersion;
  kind: "offer";
  offer_id: string;
  match_id: string;
  amount: number;
  ccy: Ccy;
  expiry: string; // ISO date-time
  state: OfferState;
  message?: LabeledText;
  /** Structurally absent: declines never carry a reason. */
  reason?: never;
}

// ---- settlement -----------------------------------------------------------

/**
 * NOTE: an agent proposes a settlement and reads its state. That is the whole
 * agent surface, and the enum shows it: there is no approve, release or
 * refund an agent can express. Humans approve, confirm and dispute on their
 * approval page; 'funded', 'released' and 'refunded' are recorded only from
 * the payment provider's verified events. The last three are terminal.
 */
export type SettlementState =
  | "proposed"
  | "approved-by-buyer"
  | "approved-by-seller"
  | "approved"
  | "funded"
  | "evidence-locked"
  | "confirmed"
  | "disputed"
  | "released"
  | "refunded"
  | "declined";

export interface Settlement {
  schema_version: SchemaVersion;
  kind: "settlement";
  settlement_id: string;
  match_id: string;
  amount: number;
  ccy: Ccy;
  /** What the settlement is for, in the proposer's words. */
  description?: LabeledText;
  state: SettlementState;
  /** Structurally absent: a decline carries no reason, here as on an offer. */
  reason?: never;
}

// ---- errors ---------------------------------------------------------------

export type ErrorCode =
  | "CONSENT_REQUIRED"
  | "SCHEMA_VERSION_UNSUPPORTED"
  | "QUOTA_EXCEEDED"
  | "CATEGORY_PROHIBITED"
  | "STAGE_LOCKED"
  | "INTENT_EXPIRED"
  | "SCREENING_REJECTED"
  | "RATE_LIMITED_OFFERS"
  | "SETTLEMENT_UNAVAILABLE"
  | "LOCATION_UNRESOLVED";

export interface SwitchboardError {
  schema_version?: SchemaVersion;
  code: ErrorCode;
  human_action?: string;
  retry_after?: number;
  /**
   * Up to three open categories closest to one that was refused, nearest
   * first. A server that cannot work them out still refuses the card the same
   * way, so handle this being absent.
   */
  suggestions?: Category[];
  docs_url: string;
}

// ---- standing arrangement -------------------------------------------------

export type SuggestionAppetite = "keen" | "occasional" | "big-things-only" | "never";

/**
 * The account-level note saying how a human wants their agents to behave:
 * how often to check, what earns an interruption, what waits for a summary,
 * when to stay quiet. Held on the account rather than in one agent's memory,
 * it survives a restart, a change of model and any other client the human
 * connects.
 *
 * There is no schema for it, and that is deliberate: an arrangement never
 * crosses to a counterparty and never appears in a disclosure message, so
 * this type is client-side only, mirroring the table in the schema package's
 * TOOLS.md. Preferences only - names, addresses, ways to reach someone and
 * card content have no place in it. It approves nothing: every consent gate
 * still goes to the human.
 */
export interface StandingArrangement {
  /** How often to check, in the human's words. */
  check_cadence?: string;
  /** What earns an interruption there and then. */
  interrupt_for?: string[];
  /** What waits for a summary, and when that summary comes. */
  summarize?: string;
  /** How forward to be about surfacing new wants and haves. */
  suggestion_appetite?: SuggestionAppetite;
  /** When to stay quiet. */
  quiet_hours?: string;
  /** Anything else standing. */
  notes?: string;
}

// ---- deny list ------------------------------------------------------------

export interface DenyListEntry {
  jurisdiction: string; // ISO 3166-1 alpha-2 or "*"
  denied: string[]; // category globs
  reason_code: string;
  status?: "denied" | "vertical-policy-pending";
}

export interface DenyList {
  schema_version: SchemaVersion;
  entries: DenyListEntry[];
}
