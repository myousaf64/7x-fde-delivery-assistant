/**
 * Plain-English text for the reason codes that `runTool` returns.
 * Presentation only. The codes and the rules live in agent.ts and are unchanged.
 */
export const REASON_TEXT: Record<string, string> = {
  tracking_number_not_found: "No shipment with that tracking number.",
  customer_not_verified: "Identity not confirmed yet, so no change is allowed.",
  verification_failed: "The last 4 digits did not match the record.",
  too_many_verification_attempts: "Three wrong attempts, so a human takes over.",
  no_phone_on_record: "No phone number on the record, so the customer cannot be verified.",
  record_flagged_for_human: "The record failed a data check, so the agent will not touch it.",
  status_not_reschedulable: "This status cannot be rescheduled.",
  status_not_editable: "Too late in the journey to change the address.",
  slot_not_available: "That window was never offered.",
  attempt_limit_reached: "Three delivery attempts already made, so a human decides next.",
  address_incomplete: "The address needs a building or villa number, an area and an emirate.",
  cod_out_of_emirate_needs_human: "A cash-on-delivery parcel leaving its emirate needs finance approval.",
  unknown_tool: "The assistant asked for something that does not exist.",
};

export const FLAG_MEANING: Record<string, string> = {
  no_phone: "No phone on the record, so the customer cannot be verified",
  junk_address: "The address is not a real address",
  data_conflict: "Two rows share this tracking number and disagree",
  attempt_before_ship: "The attempt date is before the shipment date",
  delivered_no_attempt: "Marked delivered with 0 attempts",
  bad_weight: "Weight is zero or negative",
};

export function reasonText(code?: string): string | null {
  if (!code) return null;
  return REASON_TEXT[code] ?? code.replace(/_/g, " ");
}
