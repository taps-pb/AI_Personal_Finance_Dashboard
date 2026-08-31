import { PageHeader } from "@/components/page-header";
import { AIAssistant } from "@/components/ai-assistant";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const configured = !!process.env.GROQ_API_KEY;
  return (
    <div className="space-y-6">
      <PageHeader title="AI Assistant" subtitle="Ask questions about your finances — grounded only in your recorded data." />
      <AIAssistant configured={configured} />
    </div>
  );
}
