# Value case and MVP scope

Every input is either **MEASURED** from the provided dataset or **ASSUMED** and labeled. No number
here comes from an unnamed industry report. The model is expressed per 100,000 parcels a month, so
the operator can scale it to its own volume without me guessing that volume.

---

## 1. MVP scope

**In scope**

| Item | Why it is in |
|---|---|
| One channel: web chat, English and Arabic | The regional precedent is conversational text. One channel keeps the eligibility rules honest. |
| Two actions: reschedule a redelivery, change a delivery address | These are 2 of the 3 call drivers named in the brief. |
| Status lookup | Needed before any action, and it is the cheapest deflection. |
| Identity check: tracking number plus the last 4 digits of the phone number on the record | Without it, the agent is an open door to other people's parcels. |
| Eligibility rules in server code, not in the prompt | The prompt is advice. Code is a control. |
| Data cleaning with a generated audit log | 866 raw rows are not usable as they stand. |
| Flag and hand off: every record the cleaning step distrusts | An agent that acts on a record it cannot identify is worse than no agent. |
| Operations view: which records are blocked, why, and every change the agent made | This is what an operations manager needs before signing off on automation. |

**Deliberately cut**

| Cut | Why |
|---|---|
| Voice | Voice adds ASR error on Arabic dialects and UAE address names. It doubles the failure surface and proves nothing new about the agent. |
| WhatsApp | Correct channel for production, but it needs a Meta business account and template approval. It is procurement work, not engineering risk. |
| Authentication, accounts, OTP | An OTP is the right identity check in production. The demo has no SMS gateway, so I state the substitute instead of faking it. |
| Persistent database | In-memory state shows the same guardrails. SQLite would add migration work and hide nothing. |
| Refunds, claims, COD collection, parcel redirect to another emirate | Money movement needs a human and a finance rule set. |
| Proactive outbound notifications | Higher value than inbound chat, but it needs a consent and quiet-hours regime first. |
| Fine-tuning any model | Nothing here is a model-capability problem. |

## 2. What the data says about the ceiling

| Measure | Value | Source |
|---|---|---|
| Raw rows | 866 | MEASURED |
| Usable records after cleaning | 840 | MEASURED, `cleaning_log.md` |
| Records the agent will never touch, because a flag says the data is unsafe | 133, which is 15.8 percent | MEASURED |
| Records with a clean record and an open status the agent can act on | 707 clean, of which 279 sit in a reschedulable status | MEASURED, operations view |
| Share of records with a failed delivery | 17.0 percent (143 of 840) | MEASURED |
| Failed records already at the 3-attempt limit, so a human must decide | 29 | MEASURED |
| Failed records carrying COD, where an address change out of emirate needs a human | 20.3 percent of failures | MEASURED |

The honest headline is that **the data, not the model, sets the ceiling. 15.8 percent of records
cannot be automated at all until the source systems are fixed.** That is the first slide I would
show the operator, because cleaning the source systems is cheaper than any AI licence.

## 3. Contact volume model

| Input | Value | Basis |
|---|---|---|
| Parcels per month | 100,000 | Unit of the model, not a claim |
| Share of parcels with a failed delivery | 17.0 percent | MEASURED from the dataset |
| Calls per failed delivery | 0.6 | **ASSUMED.** Some customers wait for the SMS, some call twice. |
| "Where is my parcel" calls on non-failed parcels | 3 percent of all parcels | **ASSUMED** |
| **Inbound contacts per month** | **~13,200** | Derived |
| Share of contacts on records the agent may touch | 84.2 percent | MEASURED, the inverse of the flag rate |
| Cost of one voice contact | AED 9 | **ASSUMED.** Agent minutes plus telephony. Replace with the operator's real cost per contact on day one. |
| Cost of one automated resolution, own stack | AED 0.55 | **ASSUMED.** Model tokens plus hosting, at current DeepSeek-class pricing. |
| Cost of one automated resolution, bought platform | AED 3.64 | Fin's public $0.99 per outcome, converted at 3.6725 AED per USD |

## 4. Savings, as a range not a point

Containment means the customer's problem is finished in chat with no human. I refuse to pick one
number, because the published range is wide: Aramex reported 50 percent of shipment enquiries on
WhatsApp, DHL reports 93 percent on a mostly informational queue, and Salesforce claims 76 percent
for Fin across all industries.

| Containment | Contacts resolved per month | Saving, own stack | Saving, bought platform |
|---|---|---|---|
| 35 percent (pessimistic) | 3,893 | AED 32,900 | AED 20,900 |
| 45 percent | 5,005 | AED 42,300 | AED 26,800 |
| **55 percent (base case)** | **6,117** | **AED 51,700** | **AED 32,800** |
| 65 percent (optimistic) | 7,229 | AED 61,100 | AED 38,700 |

Per 100,000 parcels a month, at the base case, the range is roughly **AED 0.39 to 0.62 million a
year**. A second effect is larger and slower to measure: every redelivery booked into a window the
customer chose is a delivery attempt that does not fail twice. I deliberately do not put a number on
it, because I have no attempt-cost data from the operator.

## 5. How I would measure it, from week one

| Metric | Definition | Why this one |
|---|---|---|
| Containment | Conversations closed with the action completed and no handoff, over all conversations | The only number that pays for the project |
| Action success | Successful `reschedule_delivery` and `update_address` calls over attempts | Separates "the model talked nicely" from "the record changed" |
| Handoff reason mix | Count by reason code, already emitted by the audit log | Tells you whether to fix the agent or fix the source data |
| Repeat contact in 72 hours | Same tracking number, second conversation | Catches fake resolutions, the failure mode Klarna hit |
| Failed second attempt after a customer-chosen slot | Parcel failed again after a self-service reschedule | The real operational win, or the proof it is not there |
| Cost per resolution | Model and platform cost over resolutions | Keeps the vendor invoice auditable |

**Kill criteria, stated up front.** If containment stays under 25 percent after two weeks of tuning,
or repeat contacts inside 72 hours exceed 15 percent, the pilot stops and the money goes to fixing
the source data instead. `ASSUMED:` both thresholds are mine, not the operator's.

## 6. Risks I would raise before the operator asks

| Risk | Control already in the prototype | Still open |
|---|---|---|
| The model states a slot the operator cannot serve | The model can only book a slot the server offered, and the server rejects anything else | Real capacity per route is not modeled |
| Wrong person reschedules a parcel | Identity check before every change, 3 attempts then handoff | Last 4 digits of a phone number is weak. Production needs an OTP. |
| The operator is liable for what the assistant promises | No free-text commitments; every confirmation echoes a server result | Needs legal review of the wording |
| Personal data leaves the UAE through the model API | The model receives a masked record: first name only, phone masked to the last 4 digits | Address text still goes to the model. A regional endpoint or an on-premises model closes this. |
| Dirty data drives a wrong action | 6 flag types block automation, with a generated log | The source systems still produce the dirt |
| Silent regression after a platform update, the DPD failure mode | 16 guardrail checks run offline with no model call | No load or adversarial test yet |
