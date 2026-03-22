import { useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import type { Building } from "@/hooks/useEnergyData";

interface AnonymousReportFormProps {
  buildings: Building[];
  onSubmit: (buildingId: string, message: string) => void;
}

export default function AnonymousReportForm({ buildings, onSubmit }: AnonymousReportFormProps) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSubmit(buildingId, message.trim());
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-success" />
        <h3 className="text-sm font-semibold">Anonymous Issue Report</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Report observed issues anonymously. No personal data is collected or stored.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue (e.g., 'Lights left on overnight in 3rd floor lab')..."
          maxLength={500}
          rows={3}
          className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{message.length}/500</span>
          <button
            type="submit"
            disabled={!message.trim()}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
          >
            <Send className="w-3 h-3" />
            Submit
          </button>
        </div>
        {submitted && (
          <p className="text-xs text-success animate-fade-up">Report submitted anonymously. Thank you.</p>
        )}
      </form>
    </div>
  );
}
