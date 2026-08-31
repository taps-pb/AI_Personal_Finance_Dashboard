// AI assistant backed by Groq (OpenAI-compatible chat completions + tool calling).
// The key stays server-side; the model may only call the deterministic read-only
// tools in lib/ai-tools.ts, so answers stay grounded in the user's real data.
import { getCurrentUser } from "@/lib/user";
import { AI_TOOLS, runTool } from "@/lib/ai-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const SYSTEM = `You are a personal finance assistant built into the user's own dashboard. Today is ${new Date().toISOString().slice(0, 10)}.

Rules:
- Answer ONLY from data returned by the tools. Never invent or estimate figures a tool can provide — call the tool instead. If the data doesn't cover the question, say so plainly.
- Call whatever tools you need (you may call several). Prefer get_financial_summary for broad questions.
- All money is Indian Rupees. Format amounts with Indian digit grouping and the ₹ sign (e.g. ₹1,500, ₹1,50,000, ₹1.25 Cr).
- Be concise and specific: lead with the number, then a short explanation. Use short lists when helpful.
- Clearly label anything forward-looking (forecasts, "you'll likely…") as an estimate, not a fact.
- For "can I afford X?", compare the amount to liquid balance and upcoming payments; give a clear yes/no with the reasoning.
- You are a helpful analyst of the user's own recorded data — not a licensed advisor. General guidance is fine; avoid definitive investment/tax/legal advice.`;

// Convert the Anthropic-shaped tool defs to OpenAI/Groq function-tool format.
const TOOLS = AI_TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}
type ChatMessage = Record<string, unknown>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function groq(messages: ChatMessage[], attempt = 0): Promise<{ choices?: { message?: { content?: string; tool_calls?: unknown } }[] }> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 1500 }),
  });
  if (res.status === 429 && attempt < 2) {
    // Respect the rate limit and retry (free tier has a low tokens-per-minute cap).
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Math.min((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 15) * 1000, 20000);
    await sleep(wait);
    return groq(messages, attempt + 1);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { unavailable: true, error: "AI assistant isn't configured. Add GROQ_API_KEY to your .env to enable it." },
      { status: 200 },
    );
  }

  let body: { messages?: ClientMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const history = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-20);
  if (history.length === 0) return Response.json({ error: "No message provided." }, { status: 400 });

  try {
    const user = await getCurrentUser();
    const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...history.map((m) => ({ role: m.role, content: m.content }))];

    let guard = 0;
    let data = await groq(messages);
    while (guard++ < 8) {
      const msg = data.choices?.[0]?.message;
      if (!msg) break;
      const calls = msg.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined;
      if (!calls || calls.length === 0) break;

      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
      for (const call of calls) {
        let input: Record<string, unknown> = {};
        try {
          input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          /* leave empty */
        }
        let out: unknown;
        try {
          out = await runTool(call.function.name, input, user.id);
        } catch (e) {
          out = { error: (e as Error).message };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
      }
      data = await groq(messages);
    }

    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    return Response.json({ text: text || "I couldn't produce an answer for that." });
  } catch (e) {
    return Response.json({ error: `AI request failed: ${(e as Error).message}` }, { status: 500 });
  }
}
