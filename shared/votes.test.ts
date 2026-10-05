import { describe, expect, it } from "vitest";
import {
  buildAuditGroups,
  checkTicketClaims,
  computeVoteShares,
  decodeTicket,
  encodeTicketBody,
  normalizeIpForGrouping,
  pickTrustedClientIp,
  resolveMatchPollWindow,
  resolveTopChoiceIds,
  voterTagOf,
  votesToVoidKeepingOnePerBrowser,
} from "./votes";

const HOUR = 60 * 60 * 1000;

describe("poll window", () => {
  it("open while live and for N hours after the end", () => {
    const finishedAt = new Date(0).toISOString();
    expect(resolveMatchPollWindow({ status: "live", startedAt: finishedAt, finishedAt: null }, "auto", 48, 10).isOpen).toBe(true);
    expect(resolveMatchPollWindow({ status: "finished", startedAt: finishedAt, finishedAt }, "auto", 48, 47 * HOUR).isOpen).toBe(true);
    expect(resolveMatchPollWindow({ status: "finished", startedAt: finishedAt, finishedAt }, "auto", 48, 49 * HOUR)).toMatchObject({ isOpen: false, closedForGood: true });
  });

  it("legacy finished match without dates is closed, never open forever", () => {
    expect(resolveMatchPollWindow({ status: "finished", startedAt: null, finishedAt: null }, "auto", 48, 0)).toMatchObject({ isOpen: false, closedForGood: true });
  });

  it("admin override wins", () => {
    expect(resolveMatchPollWindow({ status: "scheduled", startedAt: null, finishedAt: null }, "open", 48, 0).isOpen).toBe(true);
    expect(resolveMatchPollWindow({ status: "live", startedAt: null, finishedAt: null }, "closed", 48, 0).isOpen).toBe(false);
  });
});

describe("network", () => {
  it("groups ipv6 by /64", () => {
    expect(normalizeIpForGrouping("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(normalizeIpForGrouping("::ffff:10.0.0.1")).toBe("10.0.0.1");
  });

  it("never trusts x-forwarded-for outside vercel without configured header", () => {
    const headers: Record<string, string> = { "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6" };
    const get = (name: string) => headers[name] ?? null;
    expect(pickTrustedClientIp(get, { onVercel: false, trustedHeader: null })).toBeNull();
    expect(pickTrustedClientIp(get, { onVercel: false, trustedHeader: "x-real-ip" })).toBe("6.6.6.6");
    expect(pickTrustedClientIp((name) => (name === "x-vercel-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null), { onVercel: true, trustedHeader: null })).toBe("1.2.3.4");
  });
});

describe("ticket", () => {
  const payload = { pollId: "p1", voterTag: voterTagOf("abcdef0123456789abcdef"), ipHash: "deadbeef", issuedAt: 1000, validAfter: 6000, nonce: "AAAAAAAAAAAAAAAA" };

  it("roundtrips", () => {
    const ticket = `${encodeTicketBody(payload)}.sig`;
    expect(decodeTicket(ticket)?.payload).toEqual(payload);
    expect(decodeTicket("v1.x")).toBeNull();
  });

  it("is bound to poll, device and network, and waits until its slot", () => {
    const expected = { pollId: "p1", voterKey: "abcdef0123456789abcdef", ipHash: "deadbeef" };
    expect(checkTicketClaims(payload, expected, 3000)).toEqual({ ok: false, reason: "wait", retryAfterSeconds: 3 });
    expect(checkTicketClaims(payload, expected, 6000).ok).toBe(true);
    expect(checkTicketClaims(payload, { ...expected, ipHash: "other" }, 6000)).toMatchObject({ reason: "wrong_network" });
    expect(checkTicketClaims(payload, { ...expected, voterKey: "zzz" }, 6000)).toMatchObject({ reason: "wrong_voter" });
    expect(checkTicketClaims(payload, { ...expected, pollId: "p2" }, 6000)).toMatchObject({ reason: "wrong_poll" });
    expect(checkTicketClaims(payload, expected, 1000 + 21 * 60 * 1000)).toMatchObject({ reason: "expired" });
  });
});

describe("tallies and audit", () => {
  it("shares sum to 100 and ties all win", () => {
    const shares = computeVoteShares({ a: 1, b: 1, c: 1 });
    expect(shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
    expect(resolveTopChoiceIds({ a: 3, b: 3, c: 1 }).sort()).toEqual(["a", "b"]);
    expect(resolveTopChoiceIds({})).toEqual([]);
  });

  it("flags many votes per browser and keeps the oldest per browser", () => {
    const votes = Array.from({ length: 6 }, (_, i) => ({ id: `v${i}`, ipHash: "net", uaHash: i < 5 ? "chrome" : "safari", voided: false, createdAt: `2026-10-0${i + 1}` }));
    expect(buildAuditGroups(votes)[0]).toMatchObject({ level: "suspect", browsers: 2, total: 6 });
    expect(votesToVoidKeepingOnePerBrowser(votes)).toEqual(["v1", "v2", "v3", "v4"]);
  });
});
