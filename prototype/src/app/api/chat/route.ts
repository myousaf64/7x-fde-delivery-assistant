import OpenAI from "openai";
import { NextRequest } from "next/server";
import { TOOLS, TODAY, runTool, session } from "@/lib/agent";

export const runtime = "nodejs";

const MODEL = process.env.MODEL ?? "deepseek-chat";
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";

const SYSTEM = `You are the delivery assistant of a UAE postal and logistics operator.
Today is ${TODAY}.

Scope: shipment status, redelivery booking, and address changes. Nothing else.

Rules:
1. Answer in the language of the customer. Arabic in, Arabic out. English in, English out.
2. Call lookup_shipment before you talk about any shipment. Never guess a status, a date or an address.
3. Call verify_customer before any change. Ask for the last 4 digits of the phone number on the shipment.
4. Only book a slot that get_redelivery_slots returned. Read the slots back to the customer and let them choose.
5. If a tool returns handoff true, tell the customer that a human agent takes over, then call handoff_to_human.
6. If a tool returns ok false, explain the reason in plain words. Never retry the same call with the same input.
7. Keep replies under 60 words. No emoji. Confirm what changed after a successful action.
8. The phone number is masked. Never read it out. Never ask for a full phone number, an ID or a card number.`;

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function POST(req: NextRequest) {
  const { sessionId, message } = (await req.json()) as { sessionId: string; message: string };
  if (!process.env.LLM_API_KEY) {
    return Response.json({ error: "LLM_API_KEY is missing. Put it in prototype/.env.local and restart." }, { status: 500 });
  }

  const sess = session(sessionId);
  const history = sess.history as Msg[];
  if (history.length === 0) history.push({ role: "system", content: SYSTEM });
  history.push({ role: "user", content: message });

  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: BASE_URL });
  const trace: { tool: string; args: unknown; result: unknown }[] = [];

  // Tool loop. 6 turns is enough for lookup, verify, slots and one action.
  try {
   for (let turn = 0; turn < 6; turn++) {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: history,
      tools: TOOLS,
      temperature: 0,
    });
    const msg = res.choices[0].message;
    history.push(msg as Msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      return Response.json({ reply: msg.content ?? "", trace, verified: sess.verified });
    }
    for (const c of calls) {
      if (c.type !== "function") continue;
      let args: Record<string, string> = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {
        args = {};
      }
      const result = runTool(sess, c.function.name, args);
      trace.push({ tool: c.function.name, args, result });
      history.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
    }
   }
  } catch (e) {
    const status = (e as { status?: number }).status;
    const msg =
      status === 401
        ? "The model rejected the key. Put a valid key in prototype/.env.local and restart the server."
        : status === 402
          ? "The model account has no credit."
          : `The model call failed (${status ?? "network"}). The customer sees a handoff to a human.`;
    return Response.json({ error: msg, trace }, { status: 502 });
  }
  return Response.json({
    reply: "I could not finish that. A human agent will take over.",
    trace,
    verified: sess.verified,
  });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("sessionId") ?? "";
  const sess = session(id);
  sess.history = [];
  sess.verified = null;
  sess.attempts = 0;
  return Response.json({ ok: true });
}
