"use client";

import { useEffect, useState } from "react";
import AppShell, { type Section } from "../_components/AppShell";
import { FLAG_MEANING, reasonText } from "@/lib/reasons";

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

const OUTCOME_COLOR: Record<string, string> = {
  ok: "text-emerald-700",
  handoff: "text-amber-700",
  refused: "text-rose-700",
};

const COLS = ["tracking", "first name", "phone", "address", "emirate", "status", "raw status", "attempts", "COD", "kg", "flags"];

const RAW_ROWS = 866;
const TEST_ROWS = 8;
const DUPLICATE_ROWS = 18;

type Tab = "overview" | "blocked" | "activity";

function FlagChips({
  byFlag,
  total,
  active,
  onPick,
}: {
  byFlag: Record<string, number>;
  total: number;
  active?: string;
  onPick: (flag: string) => void;
}) {
  const chip = (selected: boolean) =>
    `max-w-full truncate rounded-full border px-3 py-1 text-xs ${
      selected ? "border-brand bg-brand text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
    }`;
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onPick("all")} className={chip(active === "all")}>
        all {total}
      </button>
      {Object.entries(byFlag).map(([k, v]) => (
        <button key={k} onClick={() => onPick(k)} title={FLAG_MEANING[k]} className={chip(active === k)}>
          {k} {v}
        </button>
      ))}
    </div>
  );
}

export default function Admin() {
  const [d, setD] = useState<Snapshot | null>(null);
  const [flag, setFlag] = useState<string>("all");
  const [tab, setTab] = useState<Tab>("overview");
  const [resetting, setResetting] = useState(false);

  async function load() {
    setD(await (await fetch("/api/admin", { cache: "no-store" })).json());
  }

  useEffect(() => {
    // Deferred, so the tab from the URL is applied after hydration rather than during it.
    const fromUrl = setTimeout(() => {
      const wanted = new URLSearchParams(window.location.search).get("tab");
      if (wanted === "overview" || wanted === "blocked" || wanted === "activity") setTab(wanted);
    }, 0);
    const t = setInterval(load, 4000);
    const first = setTimeout(load, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
      clearTimeout(fromUrl);
    };
  }, []);

  function pickTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  async function resetDemo() {
    setResetting(true);
    await fetch("/api/admin/reset", { method: "POST" });
    await load();
    setResetting(false);
  }

  const section: Section = tab === "activity" ? "activity" : tab === "blocked" ? "blocked" : "overview";

  if (!d) {
    return (
      <AppShell section="overview">
        <p className="p-6 text-sm text-neutral-600">loading…</p>
      </AppShell>
    );
  }

  const rows = flag === "all" ? d.flaggedRows : d.flaggedRows.filter((r) => (r.flags as string[]).includes(flag));
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "blocked", label: "Blocked records", count: d.flagged },
    { id: "activity", label: "Activity", count: d.changed.length + d.audit.length },
  ];
  const usable = d.total;
  const actionable = d.automatable;
  const pct = (n: number) => `${Math.round((n / RAW_ROWS) * 100)}%`;

  return (
    <AppShell
      section={section}
      today={d.today}
      right={
        <button
          onClick={resetDemo}
          disabled={resetting}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
        >
          {resetting ? "resetting…" : "Reset demo"}
        </button>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 sm:px-6">
          <nav role="tablist" aria-label="Operations sections" className="flex flex-wrap gap-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => pickTab(item.id)}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === item.id
                    ? "border-brand text-brand"
                    : "border-transparent text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {item.label}
                {item.count !== undefined && <span className="ms-1 text-xs text-neutral-500">{item.count}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {tab === "overview" && (
            <>
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Shipments", usable, `after cleaning, ${RAW_ROWS} raw rows in`],
                  ["Agent can act", actionable, "clean record, open status"],
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

              <section className="rounded-lg border border-neutral-200 bg-white p-4">
                <h2 className="font-semibold">Data quality</h2>
                <p className="mt-1 text-xs text-neutral-600">
                  What the operational export cost before any model was involved.
                </p>

                <div className="mt-3 space-y-2 text-xs">
                  {[
                    ["Raw rows exported", RAW_ROWS, "bg-neutral-300"],
                    ["Usable after cleaning", usable, "bg-brand"],
                    ["Agent may act", actionable, "bg-emerald-600"],
                    ["Held for a human", d.flagged, "bg-amber-500"],
                  ].map(([label, value, colour]) => (
                    <div key={String(label)} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-neutral-700">{String(label)}</span>
                      <span className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-neutral-100">
                        <span
                          className={`block h-full ${String(colour)}`}
                          style={{ width: pct(Number(value)) }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-end font-mono text-neutral-900">
                        {String(value)}
                        <span className="ms-1 text-neutral-500">{pct(Number(value))}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  {[
                    ["22", "spellings of 6 statuses"],
                    [String(TEST_ROWS), "test or QA rows dropped"],
                    [String(DUPLICATE_ROWS), "duplicates that disagree"],
                    ["7", "date formats parsed"],
                  ].map(([n, label]) => (
                    <div key={label} className="rounded-md bg-neutral-50 p-2">
                      <dt className="text-base font-semibold text-neutral-900">{n}</dt>
                      <dd className="text-neutral-600">{label}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section>
                <h2 className="mb-2 font-semibold">Why records are blocked</h2>
                <FlagChips
                  byFlag={d.byFlag}
                  total={d.flagged}
                  onPick={(next) => {
                    setFlag(next);
                    pickTab("blocked");
                  }}
                />
              </section>
            </>
          )}

          {tab === "blocked" && (
            <>
              <section>
                <h2 className="mb-2 font-semibold">Blocked records</h2>
                <FlagChips byFlag={d.byFlag} total={d.flagged} active={flag} onPick={setFlag} />
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
                                title={FLAG_MEANING[f]}
                                className="rounded bg-amber-50 px-1 text-[10px] text-amber-800 ring-1 ring-amber-200"
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
            </>
          )}

          {tab === "activity" && (
            <section className="grid gap-4">
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
                <p className="mb-2 text-xs text-neutral-600">Every tool call, with the reason in plain words.</p>
                <div className="space-y-1">
                  {d.audit.length === 0 && <p className="text-sm text-neutral-600">No tool calls yet.</p>}
                  {d.audit.map((a, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-mono text-neutral-500">{a.at.slice(11, 19)}</span>
                      <span className={`font-mono ${OUTCOME_COLOR[a.outcome] ?? "text-neutral-700"}`}>
                        {a.outcome}
                      </span>
                      <span className="font-mono text-neutral-900">{a.tool}</span>
                      {a.tracking_number && <span className="font-mono text-neutral-600">{a.tracking_number}</span>}
                      <span dir="auto" className="break-words text-neutral-600">
                        {a.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-600">
                Reason codes read as: {reasonText("cod_out_of_emirate_needs_human")}
              </p>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
