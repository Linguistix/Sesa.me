import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, isLocale, negotiateLocale } from "../config";
import { CATALOGUES, translator } from "../messages";

describe("negotiateLocale", () => {
  it("picks an exact match", () => {
    expect(negotiateLocale("es")).toBe("es");
    expect(negotiateLocale("en")).toBe("en");
  });

  it("matches the base language of a regional tag", () => {
    expect(negotiateLocale("en-GB")).toBe("en");
    expect(negotiateLocale("es-419")).toBe("es");
    expect(negotiateLocale("fr-CA")).toBe("fr");
  });

  it("honours q-values instead of taking the first entry", () => {
    // German is unsupported; English outranks French, so English wins.
    expect(negotiateLocale("de,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(negotiateLocale("de,fr;q=0.9,en;q=0.8")).toBe("fr");
  });

  it("skips entries explicitly refused with q=0", () => {
    expect(negotiateLocale("en;q=0,es;q=0.5")).toBe("es");
  });

  it("falls back to the default for unsupported or missing headers", () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("")).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("de,ja,zh-CN")).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale("*")).toBe(DEFAULT_LOCALE);
  });

  it("tolerates a malformed q-value rather than throwing", () => {
    expect(() => negotiateLocale("en;q=abc")).not.toThrow();
    expect(negotiateLocale("en;q=abc,es;q=0.5")).toBe("es");
  });
});

describe("isLocale", () => {
  it("accepts supported locales and rejects everything else", () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    for (const other of ["de", "EN", "", "fr-CA"]) expect(isLocale(other)).toBe(false);
  });
});

describe("catalogues", () => {
  it("covers every locale the app advertises", () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...LOCALES].sort());
  });

  it("translates every key in every locale — no gaps", () => {
    const keys = Object.keys(CATALOGUES.fr);
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = CATALOGUES[locale][key as keyof typeof CATALOGUES.fr];
        expect(value, `${locale}/${key}`).toBeTruthy();
      }
    }
  });

  it("actually translates rather than copying French through", () => {
    // A handful of keys that must genuinely differ, to catch a lazy paste.
    for (const key of ["page.poweredBy", "unlock.submit", "form.send"] as const) {
      expect(CATALOGUES.en[key]).not.toBe(CATALOGUES.fr[key]);
      expect(CATALOGUES.es[key]).not.toBe(CATALOGUES.fr[key]);
    }
  });
});

describe("translator", () => {
  it("returns the message for its locale", () => {
    expect(translator("en")("form.send")).toBe("Send");
    expect(translator("es")("form.send")).toBe("Enviar");
  });

  it("falls back to French for an unknown locale rather than returning the key", () => {
    const t = translator("de" as never);
    expect(t("form.send")).toBe(CATALOGUES.fr["form.send"]);
  });
});
