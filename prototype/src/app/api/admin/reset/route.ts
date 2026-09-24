import { adminSnapshot } from "@/lib/agent";

export const runtime = "nodejs";

/**
 * Demo reset. Drops the in-memory store so the next read reloads
 * shipments_clean.json from disk, which lets the same demo run twice.
 *
 * It clears the cache that agent.ts keeps on globalThis instead of changing
 * agent.ts, so no guardrail is touched.
 */
export async function POST() {
  (globalThis as { __fde?: unknown }).__fde = undefined;
  const snap = adminSnapshot();
  return Response.json({ ok: true, total: snap.total, flagged: snap.flagged });
}
