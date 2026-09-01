/**
 * Ajv-backed validators over the schemas shipped in @openswitchboard/schema.
 * The schema package is consumed by file reference (file:../schema) - see
 * the README for how CI checks the two repos out side by side.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type {
  ChannelMessage,
  DenyList,
  IntentCard,
  Offer,
  Settlement,
  SwitchboardError,
} from "./types.js";

const require = createRequire(import.meta.url);
/** Absolute path to the installed @openswitchboard/schema package root. */
export const schemaPackageRoot = dirname(
  require.resolve("@openswitchboard/schema/package.json"),
);

export const SCHEMA_NAMES = [
  "common",
  "intent-card",
  "match.signal",
  "match.attributes",
  "match.mutual",
  "channel.open",
  "channel.message",
  "offer",
  "settlement",
  "error",
  "deny-list",
] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];
export type PayloadKind =
  | "match.signal"
  | "match.attributes"
  | "match.mutual"
  | "channel.open"
  | "channel.message";

export interface ValidationResult {
  valid: boolean;
  /** Machine-checkable reasons; empty when valid. */
  reasons: string[];
}

let ajvSingleton: Ajv2020 | undefined;

function ajv(): Ajv2020 {
  if (!ajvSingleton) {
    const instance = new Ajv2020({
      allErrors: true,
      strict: true,
      allowUnionTypes: true,
    });
    (addFormats as unknown as { default?: (a: Ajv2020) => void }).default
      ? (addFormats as unknown as { default: (a: Ajv2020) => void }).default(instance)
      : (addFormats as unknown as (a: Ajv2020) => void)(instance);
    for (const name of SCHEMA_NAMES) {
      const doc = JSON.parse(
        readFileSync(join(schemaPackageRoot, "schemas", `${name}.json`), "utf8"),
      );
      instance.addSchema(doc);
    }
    ajvSingleton = instance;
  }
  return ajvSingleton;
}

function run(schema: SchemaName, data: unknown): ValidationResult {
  const validate = ajv().getSchema(
    `https://schema.openswitchboard.ai/v0/${schema}.json`,
  ) as ValidateFunction | undefined;
  if (!validate) throw new Error(`unknown schema: ${schema}`);
  const valid = validate(data) as boolean;
  const reasons = (validate.errors ?? []).map(
    (e) => `${e.instancePath} ${e.keyword} ${e.message} ${JSON.stringify(e.params)}`,
  );
  return { valid, reasons };
}

/** Validate a WANT/HAVE intent card. */
export function validateCard(card: unknown): ValidationResult {
  return run("intent-card", card);
}

/** Validate a stage-1 to stage-4 message against the schema for `kind`. */
export function validatePayload(kind: PayloadKind, payload: unknown): ValidationResult {
  return run(kind, payload);
}

export function validateOffer(offer: unknown): ValidationResult {
  return run("offer", offer);
}

export function validateSettlement(settlement: unknown): ValidationResult {
  return run("settlement", settlement);
}

export function validateChannelMessage(message: unknown): ValidationResult {
  return run("channel.message", message);
}

export function validateError(err: unknown): ValidationResult {
  return run("error", err);
}

export function validateDenyList(doc: unknown): ValidationResult {
  return run("deny-list", doc);
}

/** Escape hatch used by the fixture round-trip tests. */
export function validateAgainst(schema: SchemaName, data: unknown): ValidationResult {
  return run(schema, data);
}

/** Type guard built on schema validation. */
export function isIntentCard(x: unknown): x is IntentCard {
  return validateCard(x).valid;
}
export function isOffer(x: unknown): x is Offer {
  return validateOffer(x).valid;
}
export function isSettlement(x: unknown): x is Settlement {
  return validateSettlement(x).valid;
}
export function isChannelMessage(x: unknown): x is ChannelMessage {
  return validateChannelMessage(x).valid;
}
export function isSwitchboardError(x: unknown): x is SwitchboardError {
  return validateError(x).valid;
}
export function isDenyList(x: unknown): x is DenyList {
  return validateDenyList(x).valid;
}
