/**
 * Hand-written TypeScript types mirroring @openswitchboard/schema 0.17.1.
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
 * The body of a message carried across an open conversation. It is labelled
 * text with the label already settled: a message handed to an agent was written on
 * the other side, so it is always counterparty-untrusted. The ceiling is 4000
 * characters, the length people write to each other at.
 */
export interface ConversationBody {
  text: string;
  provenance: "counterparty-untrusted";
}

/**
 * How far the human will meet the other side. 'radius' (the default) is within
 * radius_km of the place; 'country' is anywhere in the place's own country;
 * 'anywhere' has no limit, for something done online.
 */
export type Reach = "radius" | "country" | "anywhere";

interface GeoBucketBase {
  /** How far the human will travel on 'radius'. Left out, the switchboard uses the width of the named area. */
  radius_km?: number;
  reach?: Reach;
}

/**
 * Location on the switchboard is always an area. Give `place`, written in full
 * as town, state and country ("Hobart, Tasmania, Australia"), and the
 * switchboard resolves it to a coarse cell. A shorter place is refused with
 * LOCATION_NOT_FULL.
 * `bucket` is that cell itself (a geohash4), for agents that already hold one.
 * A listing carries at least one of the two, which is why this is a union: a
 * geo with neither does not typecheck, exactly as the schema rejects it.
 */
export type GeoBucket =
  | (GeoBucketBase & { place: string; bucket?: string })
  | (GeoBucketBase & { place?: string; bucket: string });

/**
 * MATCHING INPUT ONLY. On a looking-for listing: budget ceiling. On an
 * offering listing: reserve floor.
 * Never disclosed to a counterparty; see redactForCounterparty().
 */
export interface PriceBand {
  band: { min?: number; max?: number };
  ccy: Ccy;
}

/** A deliberate, disclosable asking price (a have on a straight sale only). */
export interface Ask {
  amount: number;
  ccy: Ccy;
}

export type AttributeValue = string | number | boolean;
export type Attributes = Record<string, AttributeValue>;

export type Urgency = "none" | "days" | "today";
export type Visibility = "anonymous-until-introduced";
export type CardStatus = "active" | "latent";
/**
 * How a have is sold. 'straight' carries the asking price in `ask`.
 * 'best-offer' carries no asking price: its floor is the private price band,
 * and a server refuses a best-offer have with an `ask` (FLOOR_IS_PRIVATE).
 */
export type Sale = "straight" | "best-offer";

interface IntentCardBase {
  schema_version: SchemaVersion;
  category: Category;
  /**
   * What the thing is in the human's own plain words, at most 60 characters
   * and six words. Required where the category names a leaf the taxonomy does
   * not know.
   */
  kind?: string;
  geo: GeoBucket;
  price?: PriceBand;
  attributes?: Attributes;
  urgency?: Urgency;
  visibility?: Visibility;
  status?: CardStatus;
  ttl_days?: number; // 1-90, default 60
  /** How many people this can take at once, 1-10, default 1. Never shown to anyone. */
  slots?: number;
}

export interface LookingForCard extends IntentCardBase {
  type: "looking_for";
  /** Structurally absent: a want has no ask. */
  ask?: never;
  /** Structurally absent: a want is not sold. */
  sale?: never;
}

export interface OfferingCard extends IntentCardBase {
  type: "offering";
  ask?: Ask;
  sale?: Sale;
}

export type IntentCard = LookingForCard | OfferingCard;

// ---- disclosure steps -----------------------------------------------------

/** The signal step: an introduction exists. No attributes, no prices, no free text. */
export interface IntroSignal {
  schema_version: SchemaVersion;
  kind: "intro.signal";
  intro_id: string;
  category: Category;
  counterparty_type?: "looking_for" | "offering";
}

/** The details step: attributes + ask + provenance-labelled notes. No price bands. */
export interface IntroAttributes {
  schema_version: SchemaVersion;
  kind: "intro.attributes";
  intro_id: string;
  attributes: Attributes;
  ask?: Ask;
  notes?: LabeledText[];
}

/** The names step: first name + coarse locality, only after recorded double opt-in. */
export interface IntroMutual {
  schema_version: SchemaVersion;
  kind: "intro.mutual";
  intro_id: string;
  counterparty: { first_name: string; locality: string };
  optin: { both_recorded: true; recorded_at: string };
}

/** The conversation opens. */
export interface ConversationOpen {
  schema_version: SchemaVersion;
  kind: "conversation.open";
  intro_id: string;
  conversation: { medium: "in-app"; conversation_id: string };
  opened_at: string;
}

/**
 * One message collected from an open conversation. The switchboard
 * holds a message only until the receiving agent collects it, so collecting is what
 * deletes it - an agent gets one attempt at a batch and should relay what it
 * collects straight away. `seq` counts the batch just handed over, from 1.
 */
export interface ConversationMessage {
  schema_version: SchemaVersion;
  kind: "conversation.message";
  conversation_id: string;
  message_id: string;
  seq?: number;
  sent_at: string; // ISO date-time
  body: ConversationBody;
}

export type StepPayload =
  | IntroSignal
  | IntroAttributes
  | IntroMutual
  | ConversationOpen
  | ConversationMessage;

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
  intro_id: string;
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
 * main page; 'funded', 'released' and 'refunded' are recorded only from
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
  intro_id: string;
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
  | "NOT_UNLOCKED_YET"
  | "INTENT_EXPIRED"
  | "SCREENING_REJECTED"
  | "RATE_LIMITED_OFFERS"
  | "RATE_LIMITED"
  | "SETTLEMENT_UNAVAILABLE"
  | "LOCATION_UNRESOLVED"
  | "LOCATION_AMBIGUOUS"
  | "LOCATION_NOT_FULL"
  | "SUSPENDED"
  | "CONVERSATION_PAUSED"
  | "NEEDS_DETAIL"
  | "CONFIRM_FIGURE"
  | "SHELF_UNCLEAR"
  | "SHELF_PICK"
  | "FLOOR_IS_PRIVATE";

/** A place a full name could still mean, on LOCATION_AMBIGUOUS. */
export interface PlaceCandidate {
  display: string;
  place: string;
}

/** A shelf a posting could go on, on SHELF_UNCLEAR. The last is 'none_of_these'. */
export interface ShelfCandidate {
  category: string;
  words: string;
}

/** A money figure read back on CONFIRM_FIGURE. */
export interface ErrorFigure {
  what: string;
  amount: number;
  currency: Ccy;
}

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
  /** LOCATION_AMBIGUOUS: places; SHELF_UNCLEAR: shelves. At most five. */
  candidates?: (PlaceCandidate | ShelfCandidate)[];
  /** NEEDS_DETAIL and CONFIRM_FIGURE: the questions to put to the human, at most four. */
  questions?: string[];
  /** CONFIRM_FIGURE: the figures to say back to the human, at most four. */
  figures?: ErrorFigure[];
  /** The press to wait on with wait_for_press, when the refusal hands over a link. */
  press_id?: string;
  /** The posting attempt's own number, sent back with the next try. Never said to a human. */
  reference?: string;
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
  /**
   * Whether this agent runs between conversations: it can wake itself and
   * reach its human without being spoken to first. Saving it true with a
   * cadence makes the agent the human's messenger, and the switchboard's
   * email notices stop until the human turns them back on.
   */
  runs_on_its_own?: boolean;
  /** How often to check, in minutes, 30-10080. Accepted only with runs_on_its_own: true. */
  check_every_minutes?: number;
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
