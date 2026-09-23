# 7X AI Lab, FDE take-home: delivery assistant

An agentic assistant for a UAE postal operator. It answers shipment questions, books a redelivery
and changes a delivery address, in English and Arabic, on the provided dataset.

The point of the build: **the model decides what to ask, the server decides what is allowed.**

## Run it

```bash
# 1. clean the dataset (stdlib Python only, no pandas)
python3 clean.py                 # 866 rows in, 840 out, 133 flagged

# 2. put your model key in place
cd prototype
cp .env.local.example .env.local
$EDITOR .env.local               # LLM_API_KEY=sk-...  (DeepSeek, OpenAI-compatible)

# 3. guardrail checks, no model call, no network
npm run check                    # 16 checks

# 4. run it
npm run dev                      # http://localhost:3000  chat
                                 # http://localhost:3000/admin  operations view
```

Swap model provider with two env vars, `LLM_BASE_URL` and `MODEL`. The code speaks the
OpenAI-compatible API, so DeepSeek, OpenAI or a UAE-hosted endpoint all work unchanged. That matters
because of PDPL cross-border rules, see the market scan.

## Files

| Path | What it is |
|---|---|
| `clean.py` | Dataset cleaning. Writes `shipments_clean.json` and `cleaning_log.md`. Every rule counted. |
| `cleaning_log.md` | Generated, not hand-written. Rule, count, examples. |
| `prototype/src/lib/agent.ts` | Store, 6 tools, all guardrails, audit log, PII masking |
| `prototype/src/app/api/chat/route.ts` | Tool-calling loop and the system prompt |
| `prototype/src/app/page.tsx` | Chat UI, RTL aware, with a live tool-call trace |
| `prototype/src/app/admin/page.tsx` | Operations view: blocked records, changes, audit log |
| `prototype/scripts/check.mjs` | 16 guardrail checks, runs offline |
| `deliverables/market_scan.md` | Market scan, every figure sourced |
| `deliverables/value_case.md` | MVP scope, cuts, value model, metrics, kill criteria |
| `deliverables/deck.html` | 5-slide deck, single file, opens in a browser, prints to PDF |

## Demo script for the 15-minute slot

The refusals matter more than the happy path. Each button on the chat page runs one case.

| # | Case | Expected |
|---|---|---|
| 1 | `EX400476AE` reschedule, phone ends **1224** | Asks for the last 4 digits, lists server slots, books one, operations view shows the change |
| 2 | Arabic address change on `EX401665AE`, phone ends **0405** | Whole conversation in Arabic, RTL, address updated |
| 3 | `EX400093AE` to Al Majaz, Sharjah, phone ends **5171** | Refused: COD parcel leaving its emirate, handed to a human |
| 4 | `EX400319AE` reschedule, phone ends **5213** | Refused: already delivered |
| 5 | `EX401184AE` anything | Handed to a human: no phone on the record, so identity cannot be verified |
| 6 | `EX400238AE` reschedule, phone ends **5467** | Handed to a human: 3 attempts already made |
| 7 | Ask to reschedule without giving digits | Refused: `customer_not_verified` |

## Known limits, stated on purpose

- Identity is the last 4 digits of the phone number. Production needs an OTP.
- State is in memory. A restart resets the dataset.
- The operations view has no login, because the brief asked for none in the MVP.
- Redelivery slots are generated, not real route capacity.
- "Today" is frozen at 2026-08-21, one day after the last shipment date in the dataset.
- The address text still reaches the model. Name and phone number do not.
