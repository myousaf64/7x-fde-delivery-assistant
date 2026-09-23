# Defense prep: the 15 minutes of challenge

The rule for the room: answer the question, name the number, say which part is an assumption. If I do
not know, say the test I would run.

| Likely challenge | Answer |
|---|---|
| "Why did you not use a database?" | Nothing in the brief needs durability to prove the guardrails. In-memory state shows the same refusals. SQLite would add a migration and hide nothing. I would add Postgres the day this touches a real route plan. |
| "Your containment number is made up." | Correct, and it is labeled. 55 percent is a base case inside a published range: Aramex reported 50 percent on WhatsApp shipment enquiries, DHL reports 93 percent on a mostly informational queue, Salesforce claims 76 percent for Fin across industries. The measured inputs are the 17 percent failure rate and the 15.8 percent flag rate. The kill criterion is under 25 percent. |
| "Why DeepSeek? That data leaves the UAE." | It is a demo key, and it is the reason I masked personal data before the model call. The model receives a first name and a phone masked to 4 digits. PDPL restricts cross-border transfer, so production needs an adequate jurisdiction, contractual clauses or a regional endpoint. Two env vars swap the provider. |
| "Why is the address still sent to the model?" | The customer has to confirm and dictate an address, so the text must reach the model. That is a real, named tradeoff, not an oversight. A regional or on-premises endpoint closes it. |
| "What stops the model inventing a slot?" | The server rejects any slot it did not offer. `reschedule_delivery` validates against the generated list. Check 8 in `npm run check` proves it. |
| "What if the model ignores your prompt?" | The prompt is not the control. Identity, eligibility, flags, attempt limits and slot validity live in `agent.ts` and run regardless of what the model says. The model cannot write to a record. |
| "The last 4 digits of a phone number is weak identity." | Agreed. It is a demo substitute for an OTP, stated as a cut. It also locks after 3 tries. In production an OTP through the same number on the record, plus rate limiting per tracking number. |
| "Why block 15.8 percent of records instead of doing your best?" | Because the alternative is confirming a slot on a record whose true status is unknown. 18 tracking numbers appear twice with conflicting statuses. *Moffatt v. Air Canada* makes the operator liable for what the assistant promises. A refusal with a reason code is cheaper than a wrong promise. |
| "Your date parsing could be wrong." | Two ambiguous formats exist. I derived the order from rows where one part exceeds 12: 28 rows prove `dd/mm/yyyy`, 11 prove `mm-dd-yy`, and 0 rows contradict either. 25 rows stay ambiguous under both rules, and that count is in the log. |
| "Why 6 tools and not one big one?" | Each tool maps to one permission decision. One tool would put the decision back in the prompt. |
| "How would you roll this out?" | One channel, one action, staff-shadow mode first: the agent drafts, a human presses send, and I measure agreement. Then automate the action with the handoff always visible. Klarna's reversal is the argument for keeping the human exit permanently. |
| "What would you build next, with a week?" | In order: WhatsApp channel, OTP identity, real slot capacity from the route planner, then proactive notification before the customer calls. The last one is the largest saving and the one I refused to size without attempt-cost data. |
| "What did the AI write, and what did you decide?" | The model wrote most of the code. I chose the architecture line (rules in code, not in the prompt), the flag policy, the masking boundary, and every number that is labeled measured. The 16 checks exist so that claim is testable rather than a promise. |
| "What is weakest in your build?" | Three things: no load or adversarial testing, identity is not an OTP, and the slot list is synthetic. In that order. |
