import { describe, expect, it } from "vitest";
import {
  clientCountry,
  clientIp,
  deviceFromUserAgent,
  sourceFromReferrer,
  visitorHash,
} from "../visitor";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

describe("visitorHash", () => {
  const base = { ip: "203.0.113.7", userAgent: UA.desktop, pageId: "page_1" };

  it("is stable for the same visitor on the same day", () => {
    const day = new Date("2026-05-01T10:00:00Z");
    const later = new Date("2026-05-01T23:59:00Z");
    expect(visitorHash({ ...base, date: day })).toBe(visitorHash({ ...base, date: later }));
  });

  it("rotates the next day, so a visitor is not trackable over time", () => {
    const monday = visitorHash({ ...base, date: new Date("2026-05-01T10:00:00Z") });
    const tuesday = visitorHash({ ...base, date: new Date("2026-05-02T10:00:00Z") });
    expect(monday).not.toBe(tuesday);
  });

  it("differs between visitors, pages and user agents", () => {
    const date = new Date("2026-05-01T10:00:00Z");
    const reference = visitorHash({ ...base, date });

    expect(visitorHash({ ...base, ip: "198.51.100.4", date })).not.toBe(reference);
    expect(visitorHash({ ...base, pageId: "page_2", date })).not.toBe(reference);
    expect(visitorHash({ ...base, userAgent: UA.iphone, date })).not.toBe(reference);
  });

  it("never contains the raw IP address", () => {
    const hash = visitorHash({ ...base, date: new Date("2026-05-01T10:00:00Z") });
    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("handles a missing IP and user agent without throwing", () => {
    expect(() => visitorHash({ ip: null, userAgent: null, pageId: "p" })).not.toThrow();
  });
});

describe("deviceFromUserAgent", () => {
  it("classifies phones as mobile", () => {
    expect(deviceFromUserAgent(UA.iphone)).toBe("mobile");
    expect(deviceFromUserAgent(UA.androidPhone)).toBe("mobile");
  });

  it("classifies tablets as tablet, including Android tablets that omit 'Mobile'", () => {
    expect(deviceFromUserAgent(UA.ipad)).toBe("tablet");
    expect(deviceFromUserAgent(UA.androidTablet)).toBe("tablet");
  });

  it("defaults to desktop, including when the header is absent", () => {
    expect(deviceFromUserAgent(UA.desktop)).toBe("desktop");
    expect(deviceFromUserAgent(null)).toBe("desktop");
  });
});

describe("sourceFromReferrer", () => {
  it("reduces a referrer to its host and drops the www prefix", () => {
    expect(sourceFromReferrer("https://www.instagram.com/p/xyz")).toBe("instagram.com");
  });

  it("keeps only the host, never the path — which could be personal", () => {
    const source = sourceFromReferrer("https://mail.google.com/mail/u/0/#inbox/secret");
    expect(source).toBe("mail.google.com");
  });

  it("treats self-referrals as direct", () => {
    expect(sourceFromReferrer("https://sesa.me/camille", "sesa.me")).toBeNull();
    expect(sourceFromReferrer("https://www.sesa.me/camille", "sesa.me")).toBeNull();
  });

  it("returns null for missing or malformed referrers", () => {
    expect(sourceFromReferrer(null)).toBeNull();
    expect(sourceFromReferrer("")).toBeNull();
    expect(sourceFromReferrer("not a url")).toBeNull();
  });
});

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back through the other proxy headers", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "cf-connecting-ip": "203.0.113.10" }))).toBe("203.0.113.10");
  });

  it("returns null when no proxy header is present", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("clientCountry", () => {
  it("reads the CDN geo header and normalises case", () => {
    expect(clientCountry(new Headers({ "cf-ipcountry": "fr" }))).toBe("FR");
    expect(clientCountry(new Headers({ "x-vercel-ip-country": "ES" }))).toBe("ES");
  });

  it("rejects anything that is not a two-letter code", () => {
    expect(clientCountry(new Headers({ "cf-ipcountry": "XX1" }))).toBeNull();
    expect(clientCountry(new Headers({ "cf-ipcountry": "" }))).toBeNull();
    expect(clientCountry(new Headers())).toBeNull();
  });
});
