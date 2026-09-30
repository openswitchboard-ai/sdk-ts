import { describe, it, expect } from "vitest";
import { validateError, isSwitchboardError, SCHEMA_VERSION, type SwitchboardError } from "../src/index.js";

const docs = (code: string) => `https://openswitchboard.ai/docs/errors#${code}`;

describe("the error codes added in protocol 0.17.0", () => {
  const errors: SwitchboardError[] = [
    { schema_version: SCHEMA_VERSION, code: "LOCATION_NOT_FULL", human_action: "Write the place in full.", docs_url: docs("LOCATION_NOT_FULL") },
    { schema_version: SCHEMA_VERSION, code: "SUSPENDED", docs_url: docs("SUSPENDED") },
    { schema_version: SCHEMA_VERSION, code: "CONVERSATION_PAUSED", docs_url: docs("CONVERSATION_PAUSED") },
    { schema_version: SCHEMA_VERSION, code: "NEEDS_DETAIL", questions: ["What condition is it in?"], reference: "ref-1", docs_url: docs("NEEDS_DETAIL") },
    {
      schema_version: SCHEMA_VERSION,
      code: "CONFIRM_FIGURE",
      questions: ["Is $420 AUD your asking price?"],
      figures: [{ what: "asking price", amount: 420, currency: "AUD" }],
      reference: "ref-1",
      docs_url: docs("CONFIRM_FIGURE"),
    },
    {
      schema_version: SCHEMA_VERSION,
      code: "SHELF_UNCLEAR",
      candidates: [
        { category: "goods.motoring.parts", words: "car parts" },
        { category: "none_of_these", words: "none of these" },
      ],
      docs_url: docs("SHELF_UNCLEAR"),
    },
    { schema_version: SCHEMA_VERSION, code: "SHELF_PICK", press_id: "press-1", docs_url: docs("SHELF_PICK") },
    { schema_version: SCHEMA_VERSION, code: "FLOOR_IS_PRIVATE", docs_url: docs("FLOOR_IS_PRIVATE") },
  ];
  for (const e of errors) {
    it(e.code, () => {
      expect(validateError(e).reasons).toEqual([]);
      expect(isSwitchboardError(e)).toBe(true);
    });
  }
});
