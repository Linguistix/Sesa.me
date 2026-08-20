import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "../csv";

describe("escapeCsvField", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsvField("Mon site")).toBe("Mon site");
    expect(escapeCsvField(42)).toBe("42");
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("quotes fields containing a delimiter, quote or newline", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas — CSV injection", () => {
    for (const payload of [
      "=HYPERLINK(\"http://evil\",\"click\")",
      "+1+1",
      "-1+1",
      "@SUM(A1)",
    ]) {
      // The apostrophe goes before the formula; it sits inside the quotes
      // when the value also needs quoting.
      expect(escapeCsvField(payload)).toMatch(/^"?'/);
    }
  });

  it("still quotes a formula that also contains a delimiter", () => {
    const result = escapeCsvField("=A1,B1");
    expect(result).toBe("\"'=A1,B1\"");
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toContain("a,b\r\n1,2");
  });

  it("starts with a UTF-8 BOM so Excel reads accents correctly", () => {
    expect(toCsv(["libellé"], [["café"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("handles an empty row set", () => {
    const csv = toCsv(["a"], []);
    expect(csv).toBe("﻿a\r\n");
  });
});
