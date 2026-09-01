/**
 * The protocol ships its own conformance suite so that an implementation can
 * prove itself against it. This runs that suite with the SDK's validators
 * standing in for the reference ones: if the SDK ever accepts something the
 * protocol refuses, or refuses something it accepts, this is where it shows.
 */
import { describe, it, expect } from "vitest";
import { runConformance, type SchemaName } from "@openswitchboard/schema";
import { validateAgainst } from "../src/index.js";

describe("the SDK passes the protocol's own conformance suite", () => {
  const report = runConformance((schema: SchemaName, data: unknown) =>
    validateAgainst(schema, data),
  );

  it("runs the whole suite", () => {
    expect(report.total).toBeGreaterThanOrEqual(60);
  });

  it("passes every case", () => {
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.total);
  });
});
