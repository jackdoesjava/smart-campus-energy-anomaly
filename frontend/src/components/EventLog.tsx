import { useState } from "react";
import { AlertTriangle, Check, Tag, Filter, Download, Search } from "lucide-react";
import type { AnomalyEvent } from "@/hooks/useEnergyData";

interface EventLogProps {
  events: AnomalyEvent[];
  onTag: (eventId: string, tag: string) => void;
  onAcknowledge: (eventId: string) => void;
  selectedBuilding: string;
}

const TAGS = ["HVAC Fault", "Lighting Left On", "Equipment Malfunction", "Weather-Related", "Holiday Spike", "False Positive"];

const severityStyles: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive/80 border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-primary/10 text-primary border-primary/20",
};

const severityDot: Record<string, string> = {
  critical: "bg-destructive animate-pulse-dot",
  high: "bg-destructive/70",
  medium: "bg-warning",
  low: "bg-primary",
};

export default function EventLog({ events, onTag, onAcknowledge, selectedBuilding }: EventLogProps) {
  const [filter, setFilter] = useState<"all" | "building">("building");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagDropdown, setTagDropdown] = useState<string | null>(null);

  const filteredEvents = events
    .filter((e) => (filter === "building" ? e.buildingId === selectedBuilding : true))
    .filter((e) => searchQuery === "" || e.message.toLowerCase().includes(searchQuery.toLowerCase()) || (e.tag && e.tag.toLowerCase().includes(searchQuery.toLowerCase())));

  const exportCSV = () => {
    const header = "Timestamp,Building,Type,Severity,Value,Baseline,Z-Score,Tag,Message\n";
    const rows = filteredEvents
      .map((e) => `"${e.timestamp.toISOString()}","${e.buildingName}","${e.type}","${e.severity}",${e.value},${e.baseline},${e.zScore},"${e.tag || ""}","${e.message}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anomaly-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-semibold">Event Log</h3>
          <span className="font-mono-data text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredEvents.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter(filter === "all" ? "building" : "all")}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors active:scale-[0.97]"
          >
            <Filter className="w-3 h-3" />
            {filter === "all" ? "All" : "Building"}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors active:scale-[0.97]"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted border-none rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No anomalies detected</p>
            <p className="text-xs mt-1">Events will appear here in real-time</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`px-4 py-3 hover:bg-muted/50 transition-colors ${event.acknowledged ? "opacity-50" : ""}`}
              style={{ animation: "slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) forwards" }}
            >
              <div className="flex items-start gap-2.5">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot[event.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${severityStyles[event.severity]}`}>
                      {event.severity}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{event.type}</span>
                    <span className="font-mono-data text-[10px] text-muted-foreground ml-auto shrink-0">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed break-words">{event.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {event.tag && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{event.tag}</span>
                    )}
                    <div className="relative ml-auto flex items-center gap-1">
                      <button
                        onClick={() => setTagDropdown(tagDropdown === event.id ? null : event.id)}
                        className="p-1 rounded hover:bg-muted transition-colors active:scale-95"
                        title="Tag event"
                      >
                        <Tag className="w-3 h-3 text-muted-foreground" />
                      </button>
                      {!event.acknowledged && (
                        <button
                          onClick={() => onAcknowledge(event.id)}
                          className="p-1 rounded hover:bg-muted transition-colors active:scale-95"
                          title="Acknowledge"
                        >
                          <Check className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                      {tagDropdown === event.id && (
                        <div className="absolute right-0 top-6 z-10 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]">
                          {TAGS.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => {
                                onTag(event.id, tag);
                                setTagDropdown(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors text-foreground"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
