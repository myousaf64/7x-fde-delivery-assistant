"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./_components/AppShell";
import { reasonText } from "@/lib/reasons";

type Trace = { tool: string; args: unknown; result: { ok?: boolean; handoff?: boolean; reason?: string } };
type Turn = { role: "user" | "assistant"; text: string; trace?: Trace[] };

/** The 7 demo cases. `met` is decided by scanning the session trace for `pass`. */
const SCENARIOS: {
  label: string;
  text: string;
  tip: string;
  expect: string;
  pass: (t: Trace[]) => boolean;
}[] = [
  {
    label: "Failed delivery, reschedule",
    text: "My parcel EX400476AE was not delivered. Can you try again?",
    tip: "phone ends 1224",
    expect: "asks for the last 4 digits, then books a slot",
    pass: (t) => t.some((x) => x.tool === "reschedule_delivery" && x.result.ok === true),
  },
  {
    label: "Address change, Arabic",
    text: "مرحبا، أريد تغيير عنوان الشحنة EX401665AE",
    tip: "الهاتف ينتهي 0405",
    expect: "replies in Arabic and updates the address",
    pass: (t) => t.some((x) => x.tool === "update_address" && x.result.ok === true),
  },
  {
    label: "COD out of emirate",
    text: "Move EX400093AE to Villa 8, Al Majaz, Sharjah please",
    tip: "phone ends 5171, COD 317.93",
    expect: "refuses, needs finance approval",
    pass: (t) => t.some((x) => x.result.reason === "cod_out_of_emirate_needs_human"),
  },
  {
    label: "Already delivered",
    text: "Reschedule EX400319AE for tomorrow",
    tip: "phone ends 5213",
    expect: "refuses, the parcel is delivered",
    pass: (t) => t.some((x) => x.result.reason === "status_not_reschedulable"),
  },
  {
    label: "Dirty record",
    text: "Where is EX401184AE? I want to reschedule it",
    tip: "no phone on the record",
    expect: "hands the case to a human",
    pass: (t) =>
      t.some((x) => x.result.reason === "no_phone_on_record" || x.result.reason === "record_flagged_for_human"),
  },
  {
    label: "Attempt limit",
    text: "EX400238AE failed again, book another attempt",
    tip: "phone ends 5467, 3 attempts",
    expect: "hands over, 3 attempts already made",
    pass: (t) => t.some((x) => x.result.reason === "attempt_limit_reached"),
  },
  {
    label: "No verification",
    text: "Change the address on EX400476AE to Villa 2, Al Barsha, Dubai. I will not give any digits.",
    tip: "refuses without the digits",
    expect: "refuses, identity not confirmed",
    pass: (t) => t.some((x) => x.result.reason === "customer_not_verified"),
  },
];

const isArabic = (s: string) => /[؀-ۿ]/.test(s);

function outcome(r: Trace["result"]) {
  if (r.handoff) return { label: "to human", chip: "bg-amber-50 text-amber-800 ring-amber-200" };
  if (r.ok) return { label: "ok", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  return { label: "refused", chip: "bg-rose-50 text-rose-800 ring-rose-200" };
}

function TraceList({ items }: { items: Trace[] }) {
  if (items.length === 0) return <p className="text-sm text-neutral-600">No tool calls yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <details key={i} className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
          <summary className="cursor-pointer text-xs break-words text-neutral-800">
            <span className={`me-1 rounded px-1 font-mono ring-1 ${outcome(x.result).chip}`}>
              {outcome(x.result).label}
            </span>
            <span className="font-mono">{x.tool}</span>
          </summary>
          {x.result.reason && (
            <p className="mt-1 text-[11px] text-neutral-700">{reasonText(x.result.reason)}</p>
          )}
          <pre className="mt-1 max-h-60 overflow-auto font-mono text-[10px] leading-snug break-all whitespace-pre-wrap text-neutral-600">
            {JSON.stringify(x, null, 1)}
          </pre>
        </details>
      ))}
    </div>
  );
}

export default function Chat() {
  const [sessionId, setSessionId] = useState(() => Math.random().toString(36).slice(2));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);

  const allTrace = useMemo(() => turns.flatMap((t) => t.trace ?? []), [turns]);
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  const arabicMode = !!lastUser && isArabic(lastUser.text);

  useEffect(() => {
    if (!nearBottomRef.current && !forceScrollRef.current) return;
    endRef.current?.scrollIntoView({ behavior: forceScrollRef.current ? "auto" : "smooth", block: "end" });
    forceScrollRef.current = false;
  }, [turns, busy]);

  function onLogScroll() {
    const log = logRef.current;
    if (!log) return;
    nearBottomRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput("");
    setError(null);
    setTurns((t) => [...t, { role: "user", text }]);
    nearBottomRef.current = true;
    forceScrollRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Request failed");
      else setTurns((t) => [...t, { role: "assistant", text: data.reply, trace: data.trace }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function newChat() {
    await fetch(`/api/chat?sessionId=${sessionId}`, { method: "DELETE" });
    setTurns([]);
    setError(null);
    setNotice(null);
  }

  /** Restores the dataset so the same demo can be run again. */
  async function resetDemo() {
    const res = await fetch("/api/admin/reset", { method: "POST" });
    await newChat();
    setSessionId(Math.random().toString(36).slice(2));
    setNotice(res.ok ? "Dataset restored. Every shipment is back to its cleaned state." : "Reset failed.");
  }

  const runner = (
    <div className="space-y-2">
      {SCENARIOS.map((s) => {
        const met = s.pass(allTrace);
        return (
          <button
            key={s.label}
            onClick={() => send(s.text)}
            disabled={busy}
            title={s.tip}
            className="w-full rounded-md border border-neutral-200 bg-white p-2 text-start hover:border-brand disabled:opacity-60"
          >
            <span className="flex items-start gap-2">
              <span
                aria-hidden
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${met ? "bg-emerald-600" : "bg-neutral-300"}`}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-neutral-900">{s.label}</span>
                <span className="block text-[11px] leading-snug text-neutral-600">{s.expect}</span>
                <span className="block text-[10px] text-neutral-500">{s.tip}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <AppShell
      section="chat"
      arabic={arabicMode}
      today="2026-08-21"
      right={
        <div className="flex gap-2">
          <button
            onClick={newChat}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-100"
          >
            New chat
          </button>
          <button
            onClick={resetDemo}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-100"
          >
            Reset demo
          </button>
        </div>
      }
    >
      <div className="grid h-full min-h-0 gap-4 overflow-hidden p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="hidden min-h-0 flex-col overflow-y-auto lg:flex">
          <h2 className="mb-1 text-sm font-semibold">Demo cases</h2>
          <p className="mb-2 text-[11px] text-neutral-600">
            Click to send. The dot turns green when the expected outcome appears in the tool trace.
          </p>
          {runner}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col rounded-lg border border-neutral-200 bg-white">
          <div ref={logRef} onScroll={onLogScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {turns.length === 0 && (
              <p className="text-sm text-neutral-600">
                Type a tracking number, or pick a demo case. The assistant asks for the last 4 digits of the
                phone number on the record before it changes anything.
              </p>
            )}
            {notice && (
              <p className="rounded-md border border-brand/20 bg-brand-tint p-2 text-xs text-brand">{notice}</p>
            )}
            {turns.map((t, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    dir="auto"
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap sm:max-w-[75%] ${
                      t.role === "user" ? "bg-brand text-white" : "bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
                {t.trace && t.trace.length > 0 && (
                  <div className={`flex flex-wrap gap-1 ${t.role === "user" ? "justify-end" : ""}`}>
                    {t.trace.map((x, j) => (
                      <span
                        key={j}
                        title={reasonText(x.result.reason) ?? undefined}
                        className={`max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 ${outcome(x.result).chip}`}
                      >
                        {x.tool}
                        {x.result.reason ? `: ${x.result.reason}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {t.role === "assistant" &&
                  t.trace
                    ?.filter((x) => x.result.reason)
                    .slice(0, 1)
                    .map((x, j) => (
                      <p key={j} className="text-[11px] text-neutral-600">
                        Why: {reasonText(x.result.reason)}
                      </p>
                    ))}
              </div>
            ))}
            {busy && <p className="text-sm text-neutral-600">working…</p>}
            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">{error}</p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-neutral-200 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              dir="auto"
              placeholder="Type here / اكتب هنا"
              aria-label="Message"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-brand focus:outline-none sm:text-sm"
            />
            <button
              disabled={busy}
              className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <details className="border-t border-neutral-200 p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold">Demo cases and tool calls</summary>
            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
              {runner}
              <TraceList items={allTrace} />
            </div>
          </details>
        </section>

        <aside className="hidden min-h-0 flex-col overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4 lg:flex">
          <h2 className="text-sm font-semibold">Tool calls</h2>
          <p className="mt-1 mb-3 text-[11px] text-neutral-600">
            The model decides what to ask. The server decides what is allowed.
          </p>
          <TraceList items={allTrace} />
        </aside>
      </div>
    </AppShell>
  );
}
