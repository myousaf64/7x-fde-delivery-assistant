"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Trace = { tool: string; args: unknown; result: { ok?: boolean; handoff?: boolean; reason?: string } };
type Turn = { role: "user" | "assistant"; text: string; trace?: Trace[] };

const SCENARIOS = [
  { label: "Failed delivery, reschedule", text: "My parcel EX400476AE was not delivered. Can you try again?", tip: "phone ends 1224" },
  { label: "Address change (Arabic)", text: "مرحبا، أريد تغيير عنوان الشحنة EX401665AE", tip: "الهاتف ينتهي 0405" },
  { label: "COD out of emirate", text: "Move EX400093AE to Villa 8, Al Majaz, Sharjah please", tip: "phone ends 5171, COD 317.93" },
  { label: "Already delivered", text: "Reschedule EX400319AE for tomorrow", tip: "phone ends 5213" },
  { label: "Dirty record, handoff", text: "Where is EX401184AE? I want to reschedule it", tip: "no phone on record" },
  { label: "Attempt limit", text: "EX400238AE failed again, book another attempt", tip: "phone ends 5467, 3 attempts" },
];

const isArabic = (s: string) => /[؀-ۿ]/.test(s);

function outcome(r: Trace["result"]) {
  if (r.handoff) return { label: "to human", chip: "bg-amber-100 text-amber-800 ring-amber-200" };
  if (r.ok) return { label: "ok", chip: "bg-emerald-100 text-emerald-800 ring-emerald-200" };
  return { label: "refused", chip: "bg-rose-100 text-rose-800 ring-rose-200" };
}

function TraceList({ items }: { items: Trace[] }) {
  if (items.length === 0) return <p className="text-sm text-neutral-600">No tool calls yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <details key={i} className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
          <summary className="cursor-pointer font-mono text-xs break-words text-neutral-800">
            {outcome(x.result).label} · {x.tool}
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto font-mono text-[10px] leading-snug whitespace-pre-wrap break-all text-neutral-700">
            {JSON.stringify(x, null, 1)}
          </pre>
        </details>
      ))}
    </div>
  );
}

export default function Chat() {
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput("");
    setError(null);
    setTurns((t) => [...t, { role: "user", text }]);
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

  async function reset() {
    await fetch(`/api/chat?sessionId=${sessionId}`, { method: "DELETE" });
    setTurns([]);
    setError(null);
  }

  const allTrace = turns.flatMap((t) => t.trace ?? []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">Delivery assistant</h1>
          <p className="text-sm text-neutral-600">
            840 cleaned shipments. Reschedule and address change. English and Arabic.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <button
            onClick={reset}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-neutral-800 hover:bg-neutral-100"
          >
            New chat
          </button>
          <Link
            href="/admin"
            className="rounded-md bg-blue-700 px-3 py-1.5 text-white hover:bg-blue-800"
          >
            Operations view
          </Link>
        </nav>
      </header>

      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            onClick={() => send(s.text)}
            title={`${s.text}  (${s.tip})`}
            className="max-w-full truncate rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-h-[55vh] min-w-0 flex-col rounded-lg border border-neutral-200 bg-white lg:min-h-[60vh]">
          <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {turns.length === 0 && (
              <p className="text-sm text-neutral-600">
                Pick a scenario above, or type a tracking number. The assistant asks for the last 4
                digits of the phone number before it changes anything.
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    dir="auto"
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap sm:max-w-[75%] ${
                      t.role === "user" ? "bg-blue-700 text-white" : "bg-neutral-100 text-neutral-900"
                    } ${isArabic(t.text) ? "text-start" : ""}`}
                  >
                    {t.text}
                  </div>
                </div>
                {t.trace && t.trace.length > 0 && (
                  <div className={`flex flex-wrap gap-1 ${t.role === "user" ? "justify-end" : ""}`}>
                    {t.trace.map((x, j) => (
                      <span
                        key={j}
                        className={`max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 ${outcome(x.result).chip}`}
                      >
                        {x.tool}
                        {x.result.reason ? `: ${x.result.reason}` : ""}
                      </span>
                    ))}
                  </div>
                )}
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
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus:border-blue-700 focus:outline-none sm:text-sm"
            />
            <button
              disabled={busy}
              className="shrink-0 rounded-md bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>

        <aside className="hidden min-w-0 rounded-lg border border-neutral-200 bg-white p-4 lg:block">
          <h2 className="font-semibold">Tool calls</h2>
          <p className="mt-1 mb-3 text-xs text-neutral-600">
            The model decides what to ask. The server decides what is allowed.
          </p>
          <div className="max-h-[60vh] overflow-y-auto">
            <TraceList items={allTrace} />
          </div>
        </aside>

        <details className="rounded-lg border border-neutral-200 bg-white p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold">
            Tool calls ({allTrace.length})
          </summary>
          <div className="mt-3">
            <TraceList items={allTrace} />
          </div>
        </details>
      </div>
    </main>
  );
}
