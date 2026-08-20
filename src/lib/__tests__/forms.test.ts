import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM_FIELDS,
  MISSING_FIELD_MESSAGE,
  formFieldsSchema,
  submissionSchema,
  toStoredData,
  type FormField,
} from "../forms";

describe("formFieldsSchema", () => {
  it("accepts the default field set", () => {
    expect(formFieldsSchema.safeParse(DEFAULT_FORM_FIELDS).success).toBe(true);
  });

  it("rejects duplicate field ids", () => {
    const fields = [
      { id: "email", label: "A", type: "email", required: false },
      { id: "email", label: "B", type: "text", required: false },
    ];
    expect(formFieldsSchema.safeParse(fields).success).toBe(false);
  });

  it("rejects field ids that are not safe object keys", () => {
    for (const id of ["Email", "e-mail", "__proto__x!", "a b", ""]) {
      expect(
        formFieldsSchema.safeParse([{ id, label: "A", type: "text", required: false }]).success,
      ).toBe(false);
    }
  });

  it("requires at least one field and caps the count", () => {
    expect(formFieldsSchema.safeParse([]).success).toBe(false);
    const many = Array.from({ length: 13 }, (_, i) => ({
      id: `f${i}`,
      label: "A",
      type: "text" as const,
      required: false,
    }));
    expect(formFieldsSchema.safeParse(many).success).toBe(false);
  });
});

describe("submissionSchema", () => {
  const fields: FormField[] = [
    { id: "name", label: "Nom", type: "text", required: true },
    { id: "email", label: "E-mail", type: "email", required: true },
    { id: "note", label: "Note", type: "textarea", required: false },
  ];
  const schema = submissionSchema(fields);

  it("accepts a complete valid submission", () => {
    const result = schema.safeParse({
      name: "Camille",
      email: "camille@example.com",
      note: "Bonjour",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an omitted optional field", () => {
    expect(schema.safeParse({ name: "C", email: "c@example.com" }).success).toBe(true);
    expect(schema.safeParse({ name: "C", email: "c@example.com", note: "" }).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    expect(schema.safeParse({ email: "c@example.com" }).success).toBe(false);
    expect(schema.safeParse({ name: "", email: "c@example.com" }).success).toBe(false);
  });

  it("validates the email field as an email", () => {
    expect(schema.safeParse({ name: "C", email: "not-an-email" }).success).toBe(false);
  });

  it("strips fields the owner never declared", () => {
    const result = schema.parse({
      name: "C",
      email: "c@example.com",
      is_admin: "true",
      __proto__: "polluted",
    });
    expect(result).not.toHaveProperty("is_admin");
    expect(Object.keys(result).sort()).toEqual(["email", "name"]);
  });

  it("enforces length caps so a submission cannot be used as storage", () => {
    expect(schema.safeParse({ name: "a".repeat(501), email: "c@example.com" }).success).toBe(false);
    expect(
      schema.safeParse({ name: "C", email: "c@example.com", note: "a".repeat(5001) }).success,
    ).toBe(false);
  });

  it("validates phone numbers loosely but not arbitrarily", () => {
    const phone = submissionSchema([{ id: "tel", label: "Tel", type: "tel", required: true }]);
    expect(phone.safeParse({ tel: "+33 6 12 34 56 78" }).success).toBe(true);
    expect(phone.safeParse({ tel: "(01) 23-45" }).success).toBe(true);
    expect(phone.safeParse({ tel: "<script>" }).success).toBe(false);
  });
});

describe("toStoredData", () => {
  const fields: FormField[] = [
    { id: "name", label: "Nom", type: "text", required: true },
    { id: "note", label: "Note", type: "textarea", required: false },
  ];

  it("keeps only declared, non-empty fields", () => {
    expect(toStoredData(fields, { name: "C", note: "", extra: "x" })).toEqual({ name: "C" });
  });

  it("preserves declared values", () => {
    expect(toStoredData(fields, { name: "C", note: "Bonjour" })).toEqual({
      name: "C",
      note: "Bonjour",
    });
  });
});

describe("error messages reach visitors, not developers", () => {
  const schema = submissionSchema([
    { id: "name", label: "Nom", type: "text", required: true },
    { id: "email", label: "E-mail", type: "email", required: true },
  ]);

  it("reports an absent required field in French, not Zod's internal wording", () => {
    const result = schema.safeParse({ email: "c@example.com" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe(MISSING_FIELD_MESSAGE);
    expect(result.error!.issues[0]!.message).not.toMatch(/expected|received|invalid input/i);
  });

  it("reports an empty required field the same way", () => {
    const result = schema.safeParse({ name: "", email: "c@example.com" });
    expect(result.error!.issues[0]!.message).toBe(MISSING_FIELD_MESSAGE);
  });

  it("reports a bad email in French", () => {
    const result = schema.safeParse({ name: "C", email: "nope" });
    expect(result.error!.issues[0]!.message).toBe("Adresse e-mail invalide.");
  });

  it("reports a wrong-typed value in French rather than leaking the type name", () => {
    const result = schema.safeParse({ name: 42, email: "c@example.com" });
    expect(result.error!.issues[0]!.message).toBe(MISSING_FIELD_MESSAGE);
  });
});

describe("field ids are stable keys, not derived from labels", () => {
  it("keeps stored answers reachable after a label is renamed", () => {
    // A submission is stored keyed by field id. If the id moved with the
    // label, renaming "Votre nom" to "Nom complet" would orphan every answer
    // already collected — so the editor fixes the id at creation.
    const before: FormField[] = [{ id: "name", label: "Votre nom", type: "text", required: true }];
    const after: FormField[] = [{ id: "name", label: "Nom complet", type: "text", required: true }];

    const stored = toStoredData(before, { name: "Camille" });
    expect(toStoredData(after, stored)).toEqual({ name: "Camille" });
  });

  it("drops answers whose field was removed, rather than carrying them forever", () => {
    const after: FormField[] = [{ id: "email", label: "E-mail", type: "email", required: true }];
    expect(toStoredData(after, { name: "Camille", email: "c@example.com" })).toEqual({
      email: "c@example.com",
    });
  });
});
