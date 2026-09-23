/**
 * Shipment store, agent tools and guardrails.
 *
 * Self-contained on purpose: only node:fs and node:path are imported, so the
 * same file runs inside Next.js and inside `node scripts/check.mjs`.
 *
 * Rule: the model never changes a record. Every state change passes the
 * guardrails in this file.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Status =
  | "Delivered"
  | "Failed"
  | "InTransit"
  | "OutForDelivery"
  | "RedeliveryScheduled"
  | "ReturnedToSender";

export type Shipment = {
  tracking_number: string;
  customer_name: string;
  phone: string | null;
  delivery_address: string;
  emirate: string;
  service_type: string;
  shipment_date: string;
  last_attempt_date: string | null;
  status: Status;
  status_raw: string;
  delivery_attempts: number;
  cod_amount_aed: number;
  weight_kg: number;
  notes: string | null;
  flags: string[];
  conflict_statuses?: string[];
  redelivery_slot?: string;
  modified?: boolean;
};

export type AuditEntry = {
  at: string;
  session: string;
  tool: string;
  tracking_number?: string;
  outcome: "ok" | "refused" | "handoff";
  detail: string;
};

export type Session = {
  id: string;
  verified: string | null;
  attempts: number;
  history: unknown[];
};

/** ASSUMED: "today" is frozen one day after the last shipment date in the dataset. */
export const TODAY = "2026-08-21";

type Db = {
  shipments: Map<string, Shipment>;
  audit: AuditEntry[];
  sessions: Map<string, Session>;
};

// Dev hot reload re-imports the module, so the store lives on globalThis.
const g = globalThis as unknown as { __fde?: Db };

function load(): Db {
  const file = join(process.cwd(), "src", "data", "shipments_clean.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as Shipment[];
  return {
    shipments: new Map(rows.map((r) => [r.tracking_number, { ...r }])),
    audit: [],
    sessions: new Map(),
  };
}

export function db(): Db {
  if (!g.__fde) g.__fde = load();
  return g.__fde;
}

export function session(id: string): Session {
  const d = db();
  let s = d.sessions.get(id);
  if (!s) {
    s = { id, verified: null, attempts: 0, history: [] };
    d.sessions.set(id, s);
  }
  return s;
}

function audit(e: AuditEntry) {
  db().audit.push(e);
}

export function auditLog(): AuditEntry[] {
  return db().audit;
}

/* ------------------------------ PII masking ------------------------------ */

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.slice(0, 5) + "*".repeat(Math.max(0, phone.length - 9)) + phone.slice(-4);
}

/** The model sees a masked record. The full record never leaves the server. */
function publicView(s: Shipment) {
  return {
    tracking_number: s.tracking_number,
    first_name: s.customer_name.split(" ")[0],
    phone_masked: maskPhone(s.phone),
    delivery_address: s.delivery_address,
    emirate: s.emirate,
    service_type: s.service_type,
    status: s.status,
    delivery_attempts: s.delivery_attempts,
    last_attempt_date: s.last_attempt_date,
    cod_amount_aed: s.cod_amount_aed,
    redelivery_slot: s.redelivery_slot ?? null,
    needs_human: s.flags.length > 0,
  };
}

/* ------------------------------ Guardrails ------------------------------- */

const RESCHEDULE_OK: Status[] = ["Failed", "RedeliveryScheduled", "InTransit", "OutForDelivery"];
const ADDRESS_OK: Status[] = ["Failed", "RedeliveryScheduled", "InTransit"];
const MAX_ATTEMPTS = 3;

type Result = { ok: boolean; handoff?: boolean; [k: string]: unknown };

function refuse(detail: string, extra: Record<string, unknown> = {}): Result {
  return { ok: false, reason: detail, ...extra };
}

function handoff(reason: string, extra: Record<string, unknown> = {}): Result {
  return { ok: false, handoff: true, reason, ...extra };
}

/** Every action runs this gate first. */
function gate(sess: Session, tracking: string, tool: string): { s?: Shipment; error?: Result } {
  const s = db().shipments.get(tracking);
  if (!s) {
    audit({ at: new Date().toISOString(), session: sess.id, tool, outcome: "refused", detail: `unknown tracking ${tracking}` });
    return { error: refuse("tracking_number_not_found") };
  }
  if (sess.verified !== tracking) {
    audit({ at: new Date().toISOString(), session: sess.id, tool, tracking_number: tracking, outcome: "refused", detail: "identity not verified" });
    return { error: refuse("customer_not_verified") };
  }
  if (s.flags.length > 0) {
    audit({ at: new Date().toISOString(), session: sess.id, tool, tracking_number: tracking, outcome: "handoff", detail: `data flags: ${s.flags.join(",")}` });
    return { error: handoff("record_flagged_for_human", { flags: s.flags }) };
  }
  return { s };
}

/* -------------------------------- Slots ---------------------------------- */

const WINDOWS = ["09:00-12:00", "12:00-15:00", "18:00-21:00"];

export function slots(from: string = TODAY): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  while (out.length < 9) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() === 5) continue; // ASSUMED: no Friday delivery round
    const day = d.toISOString().slice(0, 10);
    for (const w of WINDOWS) out.push(`${day} ${w}`);
  }
  return out;
}

/* -------------------------------- Tools ---------------------------------- */

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "lookup_shipment",
      description: "Get the status of one shipment by tracking number. Read only. Call this first.",
      parameters: {
        type: "object",
        properties: { tracking_number: { type: "string", description: "For example EX401452AE" } },
        required: ["tracking_number"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "verify_customer",
      description: "Verify the customer with the last 4 digits of the phone number on the shipment. Required before any change.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: { type: "string" },
          phone_last4: { type: "string", description: "4 digits" },
        },
        required: ["tracking_number", "phone_last4"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_redelivery_slots",
      description: "List the free redelivery windows for a shipment.",
      parameters: {
        type: "object",
        properties: { tracking_number: { type: "string" } },
        required: ["tracking_number"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reschedule_delivery",
      description: "Book a redelivery window. Use a slot returned by get_redelivery_slots.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: { type: "string" },
          slot: { type: "string", description: "Exactly as returned, for example 2026-08-22 09:00-12:00" },
        },
        required: ["tracking_number", "slot"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_address",
      description: "Change the delivery address of a shipment.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: { type: "string" },
          new_address: { type: "string" },
        },
        required: ["tracking_number", "new_address"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "handoff_to_human",
      description: "Send the case to a human agent. Use it when a tool asks for a handoff or the request is out of scope.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: { type: "string" },
          reason: { type: "string" },
        },
        required: ["reason"],
      },
    },
  },
];

export function runTool(sess: Session, name: string, args: Record<string, string>): Result {
  const now = () => new Date().toISOString();
  const tracking = (args.tracking_number ?? "").trim().toUpperCase();

  if (name === "lookup_shipment") {
    const s = db().shipments.get(tracking);
    if (!s) {
      audit({ at: now(), session: sess.id, tool: name, outcome: "refused", detail: `unknown tracking ${tracking}` });
      return refuse("tracking_number_not_found");
    }
    audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "ok", detail: `status ${s.status}` });
    if (s.flags.length > 0) {
      return {
        ok: true,
        shipment: publicView(s),
        handoff: true,
        reason: "record_flagged_for_human",
        flags: s.flags,
      };
    }
    return { ok: true, shipment: publicView(s), verified: sess.verified === tracking };
  }

  if (name === "verify_customer") {
    const s = db().shipments.get(tracking);
    if (!s) return refuse("tracking_number_not_found");
    if (!s.phone) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "handoff", detail: "no phone on record" });
      return handoff("no_phone_on_record", { flags: s.flags });
    }
    sess.attempts += 1;
    if (sess.attempts > MAX_ATTEMPTS) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "handoff", detail: "too many verify attempts" });
      return handoff("too_many_verification_attempts");
    }
    const given = (args.phone_last4 ?? "").replace(/\D/g, "");
    if (given.length !== 4 || given !== s.phone.slice(-4)) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "refused", detail: `verify failed (attempt ${sess.attempts})` });
      return refuse("verification_failed", { attempts_left: MAX_ATTEMPTS - sess.attempts });
    }
    sess.verified = tracking;
    sess.attempts = 0;
    audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "ok", detail: "verified" });
    return { ok: true, verified: true, shipment: publicView(s) };
  }

  if (name === "get_redelivery_slots") {
    const { s, error } = gate(sess, tracking, name);
    if (error) return error;
    if (!RESCHEDULE_OK.includes(s!.status)) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "refused", detail: `status ${s!.status} not reschedulable` });
      return refuse("status_not_reschedulable", { status: s!.status });
    }
    audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "ok", detail: "slots listed" });
    return { ok: true, slots: slots().slice(0, 6) };
  }

  if (name === "reschedule_delivery") {
    const { s, error } = gate(sess, tracking, name);
    if (error) return error;
    if (!RESCHEDULE_OK.includes(s!.status)) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "refused", detail: `status ${s!.status} not reschedulable` });
      return refuse("status_not_reschedulable", { status: s!.status });
    }
    const slot = (args.slot ?? "").trim();
    if (!slots().includes(slot)) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "refused", detail: `slot ${slot} not offered` });
      return refuse("slot_not_available", { slots: slots().slice(0, 6) });
    }
    if (s!.delivery_attempts >= MAX_ATTEMPTS) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "handoff", detail: `${s!.delivery_attempts} attempts already made` });
      return handoff("attempt_limit_reached", { delivery_attempts: s!.delivery_attempts });
    }
    s!.status = "RedeliveryScheduled";
    s!.redelivery_slot = slot;
    s!.modified = true;
    audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "ok", detail: `booked ${slot}` });
    return { ok: true, booked: slot, shipment: publicView(s!) };
  }

  if (name === "update_address") {
    const { s, error } = gate(sess, tracking, name);
    if (error) return error;
    if (!ADDRESS_OK.includes(s!.status)) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "refused", detail: `status ${s!.status} too late for address change` });
      return refuse("status_not_editable", { status: s!.status });
    }
    const addr = (args.new_address ?? "").trim();
    if (addr.length < 12 || !/\d/.test(addr)) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "refused", detail: "address too vague" });
      return refuse("address_incomplete", { need: "building or villa number, area, emirate" });
    }
    // A COD parcel that moves to another emirate needs finance and route approval.
    const sameEmirate = addr.toLowerCase().includes(s!.emirate.toLowerCase());
    if (s!.cod_amount_aed > 0 && !sameEmirate) {
      audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "handoff", detail: "COD parcel moving out of emirate" });
      return handoff("cod_out_of_emirate_needs_human", { cod_amount_aed: s!.cod_amount_aed, emirate: s!.emirate });
    }
    const old = s!.delivery_address;
    s!.delivery_address = addr;
    s!.modified = true;
    audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking, outcome: "ok", detail: `address ${old} -> ${addr}` });
    return { ok: true, old_address: old, new_address: addr, shipment: publicView(s!) };
  }

  if (name === "handoff_to_human") {
    audit({ at: now(), session: sess.id, tool: name, tracking_number: tracking || undefined, outcome: "handoff", detail: args.reason ?? "" });
    return { ok: true, handoff: true, ticket: `TCK-${String(auditLog().length).padStart(4, "0")}`, sla_hours: 4 };
  }

  return refuse("unknown_tool");
}

/* ------------------------------ Admin view ------------------------------- */

export function adminSnapshot() {
  const rows = [...db().shipments.values()];
  const byFlag: Record<string, number> = {};
  for (const r of rows) for (const f of r.flags) byFlag[f] = (byFlag[f] ?? 0) + 1;
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    total: rows.length,
    flagged: rows.filter((r) => r.flags.length > 0).length,
    automatable: rows.filter((r) => r.flags.length === 0 && RESCHEDULE_OK.includes(r.status)).length,
    byFlag,
    byStatus,
    flaggedRows: rows
      .filter((r) => r.flags.length > 0)
      .map((r) => ({
        ...r,
        customer_name: r.customer_name.split(" ")[0],
        phone: maskPhone(r.phone),
      })),
    changed: rows
      .filter((r) => r.modified)
      .map((r) => ({ tracking_number: r.tracking_number, status: r.status, redelivery_slot: r.redelivery_slot ?? null, delivery_address: r.delivery_address })),
    audit: auditLog().slice(-60).reverse(),
    today: TODAY,
  };
}
