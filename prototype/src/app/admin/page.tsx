"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Snapshot = {
  total: number;
  flagged: number;
  automatable: number;
  byFlag: Record<string, number>;
  byStatus: Record<string, number>;
  flaggedRows: Record<string, string | number | string[] | null>[];
  changed: { tracking_number: string; status: string; redelivery_slot: string | null; delivery_address: string }[];
  audit: { at: string; tool: string; tracking_number?: string; outcome: string; detail: string }[];
  today: string;
};

const FLAG_MEANING: Record<string, string> = {
  no_phone: "No phone on the record, so the customer cannot be verified",
  junk_address: "The address is not a real address",
  data_conflict: "Two rows share this tracking number and disagree",
  attempt_before_ship: "The attempt date is before the shipment date",
  delivered_no_attempt: "Marked delivered with 0 attempts",
  bad_weight: "Weight is zero or negative",
};

const OUTCOME_COLOR: Record<string, string> = {
  ok: "text-emerald-700",
  handoff: "text-amber-700",
  refused: "text-rose-700",
};

const COLS = ["tracking", "first name", "phone", "address", "emirate", "status", "raw status", "attempts", "COD", "kg", "flags"];

export default function Admin() {
  const [d, setD] = useState<Snapshot | null>(null);
  const [flag, setFlag] = useState<string>("all");

  async function load() {
    setD(await (await fetch("/api/admin", { cache: "no-store" })).json());
  }
  useEffect(() => {
    const t = setInterval(load, 4000);
    const first = setTimeout(load, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);

  if (!d) return <main className="p-6 text-sm text-neutral-600">loading…</main>;

  const rows = flag === "all" ? d.flaggedRows : d.flaggedRows.filter((r) => (r.flags as string[]).includes(flag));

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">Operations view</h1>
          <p className="text-sm text-neutral-600">
            Records the agent refuses to touch, and every change it made. No login in the demo.
            Frozen date {d.today}.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-100"
        >
          Back to chat
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Shipments", d.total, "after cleaning, 866 raw rows in"],
          ["Agent can act", d.automatable, "clean record, open status"],
          ["Human only", d.flagged, "blocked by a data flag"],
          ["Changed this session", d.changed.length, "reschedules and address edits"],
        ].map(([k, v, note]) => (
          <div key={String(k)} className="rounded-lg border border-neutral-200 bg-white p-3 sm:p-4">
            <div className="text-2xl font-semibold">{String(v)}</div>
            <div className="text-sm text-neutral-900">{String(k)}</div>
            <div className="text-xs text-neutral-600">{String(note)}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Why records are blocked</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFlag("all")}
            className={`max-w-full truncate rounded-full border px-3 py-1 text-xs ${
              flag === "all"
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            all {d.flagged}
          </button>
          {Object.entries(d.byFlag).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFlag(k)}
              title={FLAG_MEANING[k]}
              className={`max-w-full truncate rounded-full border px-3 py-1 text-xs ${
                flag === k
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {k} {v}
            </button>
          ))}
        </div>
        <p className="mt-2 min-h-[1.25rem] text-xs text-neutral-600">
          {flag === "all" ? `${rows.length} records shown` : FLAG_MEANING[flag]}
        </p>
      </section>

      <section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[56rem] border-collapse text-start text-xs">
          <thead className="sticky top-0 bg-neutral-100">
            <tr>
              {COLS.map((h) => (
                <th key={h} className="px-2 py-2 text-start font-semibold whitespace-nowrap text-neutral-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.tracking_number)} className="border-t border-neutral-200 align-top">
                <td className="px-2 py-1 font-mono whitespace-nowrap">{String(r.tracking_number)}</td>
                <td dir="auto" className="px-2 py-1">{String(r.customer_name)}</td>
                <td className="px-2 py-1 font-mono whitespace-nowrap">{r.phone ? String(r.phone) : "—"}</td>
                <td dir="auto" className="max-w-[18rem] px-2 py-1 break-words">{String(r.delivery_address)}</td>
                <td className="px-2 py-1 whitespace-nowrap">{String(r.emirate)}</td>
                <td className="px-2 py-1 whitespace-nowrap">{String(r.status)}</td>
                <td className="px-2 py-1 whitespace-nowrap text-neutral-600">{String(r.status_raw)}</td>
                <td className="px-2 py-1">{String(r.delivery_attempts)}</td>
                <td className="px-2 py-1 whitespace-nowrap">{String(r.cod_amount_aed)}</td>
                <td className="px-2 py-1">{String(r.weight_kg)}</td>
                <td className="px-2 py-1">
                  <span className="flex flex-wrap gap-1">
                    {(r.flags as string[]).map((f) => (
                      <span
                        key={f}
                        className="rounded bg-amber-100 px-1 text-[10px] text-amber-800 ring-1 ring-amber-200"
                      >
                        {f}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Changes made by the agent</h2>
          {d.changed.length === 0 ? (
            <p className="text-sm text-neutral-600">None yet. Book a redelivery in the chat and this fills in.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <tbody>
                  {d.changed.map((c) => (
                    <tr key={c.tracking_number} className="border-t border-neutral-200 align-top">
                      <td className="px-2 py-1 font-mono whitespace-nowrap">{c.tracking_number}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{c.status}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{c.redelivery_slot ?? "—"}</td>
                      <td dir="auto" className="px-2 py-1 break-words">{c.delivery_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Audit log</h2>
          <div className="max-h-72 space-y-1 overflow-y-auto font-mono text-[10px] leading-relaxed">
            {d.audit.length === 0 && <p className="text-sm text-neutral-600">No tool calls yet.</p>}
            {d.audit.map((a, i) => (
              <div key={i} className="flex flex-wrap gap-x-2">
                <span className="text-neutral-500">{a.at.slice(11, 19)}</span>
                <span className={OUTCOME_COLOR[a.outcome] ?? "text-neutral-700"}>{a.outcome}</span>
                <span className="text-neutral-900">{a.tool}</span>
                <span className="break-words text-neutral-600">
                  {a.tracking_number ?? ""} {a.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
