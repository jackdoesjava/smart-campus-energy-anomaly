import { useState } from "react";
import { Activity, Pause, Play } from "lucide-react";
import { useEnergyData } from "@/hooks/useEnergyData";
import KPICards from "./KPICards";
import EnergyChart from "./EnergyChart";
import EventLog from "./EventLog";
import BuildingSelector from "./BuildingSelector";
import AnonymousReportForm from "./AnonymousReportForm";

export default function Dashboard() {
  const {
    buildings,
    selectedBuilding,
    setSelectedBuilding,
    readings,
    events,
    isLive,
    setIsLive,
    forecast,
    getKPIs,
    tagEvent,
    acknowledgeEvent,
    submitReport,
  } = useEnergyData();

  const [chartMetric, setChartMetric] = useState<"kWh" | "temperature" | "co2">("kWh");
  const kpis = getKPIs();
  const building = buildings.find((b) => b.id === selectedBuilding)!;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">EnergyPulse</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Campus Energy Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isLive ? "bg-success animate-pulse-dot" : "bg-muted-foreground"}`} />
              <span className="font-mono-data text-xs text-muted-foreground">{isLive ? "LIVE" : "PAUSED"}</span>
            </div>
            <button
              onClick={() => setIsLive(!isLive)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors active:scale-[0.97]"
            >
              {isLive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isLive ? "Pause" : "Resume"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Building Selector */}
        <BuildingSelector buildings={buildings} selected={selectedBuilding} onSelect={setSelectedBuilding} />

        {/* KPIs */}
        <KPICards kpis={kpis} buildingName={building.name} />

        {/* Charts + Event Log */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {/* Metric Tabs */}
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit">
              {(["kWh", "temperature", "co2"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-all active:scale-[0.97] ${
                    chartMetric === m
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "kWh" ? "Energy" : m === "temperature" ? "Temperature" : "CO₂"}
                </button>
              ))}
            </div>

            <EnergyChart readings={readings} forecast={forecast} selectedBuilding={selectedBuilding} metric={chartMetric} />

            {/* Anonymous Report */}
            <AnonymousReportForm buildings={buildings} onSubmit={submitReport} />
          </div>

          {/* Event Log */}
          <div className="xl:col-span-1 min-h-[500px]">
            <EventLog events={events} onTag={tagEvent} onAcknowledge={acknowledgeEvent} selectedBuilding={selectedBuilding} />
          </div>
        </div>
      </main>
    </div>
  );
}
