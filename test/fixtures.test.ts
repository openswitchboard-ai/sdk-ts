/**
 * Round-trip every example shipped by @openswitchboard/schema through the
 * SDK's validators: the SDK must agree exactly with the protocol's
 * conformance suite, including WHY each one that must fail does.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  schemaPackageRoot,
  validateAgainst,
  type SchemaName,
} from "../src/index.js";

interface Fixture {
  file: string;
  description: string;
  schema: SchemaName;
  valid: boolean;
  error_contains?: string;
  data: unknown;
}

const dir = join(schemaPackageRoot, "fixtures");
const fixtures: Fixture[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((file) => ({ file, ...JSON.parse(readFileSync(join(dir, file), "utf8")) }));

describe("SDK round-trips every schema fixture", () => {
  it("found the full fixture suite", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(60);
  });

  for (const f of fixtures) {
    it(`${f.file}: ${f.description}`, () => {
      const result = validateAgainst(f.schema, f.data);
      if (f.valid) {
        expect(result.reasons.join("; ")).toBe("");
        expect(result.valid).toBe(true);
      } else {
        expect(result.valid).toBe(false);
        expect(result.reasons.join("\n")).toContain(f.error_contains!);
      }
    });
  }
});
