import Link from "next/link";
import { Lightbulb, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insight } from "@/lib/insights";

const dot = (tone?: string) =>
  tone === "positive" ? "bg-[var(--success)]" : tone === "negative" ? "bg-destructive" : "bg-muted-foreground";

export function AIInsights({ insights }: { insights: Insight[] }) {
  const facts = insights.filter((i) => i.kind === "fact");
  const suggestions = insights.filter((i) => i.kind === "suggestion");

  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Financial insights</CardTitle>
        <Link href="/assistant" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Sparkles className="size-3.5" /> Ask the AI assistant
        </Link>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Calculated directly from your data — these are facts, not AI guesses.</p>
        <ul className="space-y-2">
          {facts.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot(f.tone)}`} />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        {suggestions.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lightbulb className="size-3.5" /> Suggestions
            </p>
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[var(--warning)]" />
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
