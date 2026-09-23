/**
 * Guardrail self-check. No framework, no network, no LLM.
 * Run: npm run check   (from the prototype folder)
 */
import assert from "node:assert/strict";
import { runTool, session, slots, adminSnapshot, maskPhone, db } from "../src/lib/agent.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("ok  " + name);
};

const fresh = (id) => session(id + Math.random().toString(36).slice(2));

t("dataset loads with no duplicate tracking numbers", () => {
  const snap = adminSnapshot();
  assert.equal(snap.total, db().shipments.size);
  assert.ok(snap.total > 800);
  assert.ok(snap.flagged > 0 && snap.flagged < snap.total);
});

t("phone masking keeps only the last 4 digits", () => {
  assert.equal(maskPhone("+971584631224"), "+9715****1224");
  assert.equal(maskPhone(null), null);
});

t("lookup works without verification and masks the phone", () => {
  const s = fresh("look");
  const r = runTool(s, "lookup_shipment", { tracking_number: "ex400476ae" }); // lower case on purpose
  assert.equal(r.ok, true);
  assert.equal(r.shipment.status, "Failed");
  assert.equal(r.shipment.phone_masked, "+9715****1224");
  assert.ok(!("phone" in r.shipment));
});

t("unknown tracking number is refused", () => {
  const r = runTool(fresh("unk"), "lookup_shipment", { tracking_number: "EX999999AE" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "tracking_number_not_found");
});

t("no action before verification", () => {
  const s = fresh("nover");
  const r = runTool(s, "reschedule_delivery", { tracking_number: "EX400476AE", slot: slots()[0] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "customer_not_verified");
});

t("wrong last 4 digits fails, and 3 tries send the case to a human", () => {
  const s = fresh("verify");
  const bad = runTool(s, "verify_customer", { tracking_number: "EX400476AE", phone_last4: "0000" });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "verification_failed");
  runTool(s, "verify_customer", { tracking_number: "EX400476AE", phone_last4: "0000" });
  runTool(s, "verify_customer", { tracking_number: "EX400476AE", phone_last4: "0000" });
  const out = runTool(s, "verify_customer", { tracking_number: "EX400476AE", phone_last4: "0000" });
  assert.equal(out.handoff, true);
  assert.equal(out.reason, "too_many_verification_attempts");
});

t("happy path: verify then book an offered slot", () => {
  const s = fresh("happy");
  assert.equal(runTool(s, "verify_customer", { tracking_number: "EX400476AE", phone_last4: "1224" }).ok, true);
  const offered = runTool(s, "get_redelivery_slots", { tracking_number: "EX400476AE" });
  assert.equal(offered.ok, true);
  const r = runTool(s, "reschedule_delivery", { tracking_number: "EX400476AE", slot: offered.slots[0] });
  assert.equal(r.ok, true);
  assert.equal(r.shipment.status, "RedeliveryScheduled");
  assert.equal(r.booked, offered.slots[0]);
});

t("a slot that was never offered is refused", () => {
  const s = fresh("slot");
  runTool(s, "verify_customer", { tracking_number: "EX400219AE", phone_last4: "6685" });
  const r = runTool(s, "reschedule_delivery", { tracking_number: "EX400219AE", slot: "2026-08-22 03:00-04:00" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "slot_not_available");
});

t("no Friday slots are offered", () => {
  for (const s of slots()) {
    assert.notEqual(new Date(s.slice(0, 10) + "T00:00:00Z").getUTCDay(), 5);
  }
});

t("a delivered shipment cannot be rescheduled", () => {
  const s = fresh("done");
  runTool(s, "verify_customer", { tracking_number: "EX400319AE", phone_last4: "5213" });
  const r = runTool(s, "get_redelivery_slots", { tracking_number: "EX400319AE" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "status_not_reschedulable");
});

t("3 attempts already made sends the case to a human", () => {
  const s = fresh("limit");
  runTool(s, "verify_customer", { tracking_number: "EX400238AE", phone_last4: "5467" });
  const r = runTool(s, "reschedule_delivery", { tracking_number: "EX400238AE", slot: slots()[0] });
  assert.equal(r.handoff, true);
  assert.equal(r.reason, "attempt_limit_reached");
});

t("a flagged record is never changed by the agent", () => {
  const s = fresh("flag");
  const look = runTool(s, "lookup_shipment", { tracking_number: "EX401184AE" });
  assert.equal(look.handoff, true);
  const v = runTool(s, "verify_customer", { tracking_number: "EX401184AE", phone_last4: "1234" });
  assert.equal(v.handoff, true);
  assert.equal(v.reason, "no_phone_on_record");
});

t("a conflicting duplicate record also goes to a human", () => {
  const s = fresh("conflict");
  runTool(s, "verify_customer", { tracking_number: "EX400879AE", phone_last4: "1567" });
  const r = runTool(s, "reschedule_delivery", { tracking_number: "EX400879AE", slot: slots()[0] });
  assert.equal(r.handoff, true);
  assert.equal(r.reason, "record_flagged_for_human");
});

t("address change works and a vague address is refused", () => {
  const s = fresh("addr");
  runTool(s, "verify_customer", { tracking_number: "EX400181AE", phone_last4: "8414" });
  const vague = runTool(s, "update_address", { tracking_number: "EX400181AE", new_address: "my office" });
  assert.equal(vague.ok, false);
  assert.equal(vague.reason, "address_incomplete");
  const ok = runTool(s, "update_address", {
    tracking_number: "EX400181AE",
    new_address: "Office 12, Tower 3, Al Reem Island, Abu Dhabi",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.shipment.delivery_address, "Office 12, Tower 3, Al Reem Island, Abu Dhabi");
});

t("a COD parcel moving to another emirate goes to a human", () => {
  const s = fresh("cod");
  runTool(s, "verify_customer", { tracking_number: "EX400093AE", phone_last4: "5171" });
  const r = runTool(s, "update_address", {
    tracking_number: "EX400093AE",
    new_address: "Villa 8, Al Majaz, Sharjah",
  });
  assert.equal(r.handoff, true);
  assert.equal(r.reason, "cod_out_of_emirate_needs_human");
});

t("every tool call lands in the audit log", () => {
  const before = adminSnapshot().audit.length;
  runTool(fresh("audit"), "lookup_shipment", { tracking_number: "EX400476AE" });
  assert.ok(adminSnapshot().audit.length > before);
});

console.log(`\n${n} checks passed`);
