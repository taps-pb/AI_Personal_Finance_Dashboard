import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/user";
import { AI_TOOLS, runTool } from "@/lib/ai-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are a personal finance assistant built into the user's own dashboard. Today is ${new Date().toISOString().slice(0, 10)}.

Rules:
- Answer ONLY from data returned by the tools. Never invent or estimate figures that a tool can provide — call the tool instead. If the data doesn't cover the question, say so plainly.
- Call whatever tools you need (you may call several). Prefer get_financial_summary for broad questions.
- All money is Indian Rupees. Format amounts with Indian digit grouping and the ₹ sign (e.g. ₹1,500, ₹1,50,000, ₹1.25 Cr).
- Be concise and specific: lead with the number, then a short explanation. Use short lists when helpful.
- Clearly label anything forward-looking (forecasts, "you'll likely…") as an estimate, not a fact.
- For "can I afford X?", compare the amount to liquid balance and upcoming payments; give a clear yes/no with the reasoning.
- You are a helpful analyst of the user's own recorded data — not a licensed advisor. General guidance is fine; avoid definitive investment/tax/legal advice.`;

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { unavailable: true, error: "AI assistant isn't configured. Add ANTHROPIC_API_KEY to your .env to enable it." },
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
    const client = new Anthropic();
    const tools = AI_TOOLS as unknown as Anthropic.Tool[];
    const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

    let response = await client.messages.create({ model: "claude-opus-5", max_tokens: 2048, system: SYSTEM, tools, messages });

    let guard = 0;
    while (response.stop_reason === "tool_use" && guard++ < 8) {
      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          let out: unknown;
          try {
            out = await runTool(block.name, block.input as Record<string, unknown>, user.id);
          } catch (e) {
            out = { error: (e as Error).message };
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }
      messages.push({ role: "user", content: toolResults });
      response = await client.messages.create({ model: "claude-opus-5", max_tokens: 2048, system: SYSTEM, tools, messages });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return Response.json({ text: text || "I couldn't produce an answer for that." });
  } catch (e) {
    return Response.json({ error: `AI request failed: ${(e as Error).message}` }, { status: 500 });
  }
}
