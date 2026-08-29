/**
 * Hand-written TypeScript types mirroring @openswitchboard/schema 0.1.0.
 * The schemas are the source of truth; the round-trip tests in test/
 * validate every schema fixture through these types' validators to keep
 * the two in lockstep.
 */

export type SchemaVersion = string; // semver, e.g. "0.1.0"
export type Ccy = string; // ISO 4217, e.g. "AUD"
export type Category = string; // dotted taxonomy path, e.g. "goods.bicycle.mountain"

export type Provenance = "switchboard-system" | "counterparty-untrusted";

/** Every free-text field in every payload carries a provenance label. */
export interface LabeledText {
  text: string;
  provenance: Provenance;
}

/** Location is always bucketed, never exact. */
export interface GeoBucket {
  bucket: string;
  radius_km?: number;
}

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

export type StagePayload = MatchSignal | MatchAttributes | MatchMutual | ChannelOpen;

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

// ---- errors ---------------------------------------------------------------

export type ErrorCode =
  | "CONSENT_REQUIRED"
  | "SCHEMA_VERSION_UNSUPPORTED"
  | "QUOTA_EXCEEDED"
  | "CATEGORY_PROHIBITED"
  | "STAGE_LOCKED"
  | "INTENT_EXPIRED"
  | "SCREENING_REJECTED"
  | "RATE_LIMITED_OFFERS";

export interface SwitchboardError {
  schema_version?: SchemaVersion;
  code: ErrorCode;
  human_action?: string;
  retry_after?: number;
  docs_url: string;
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
