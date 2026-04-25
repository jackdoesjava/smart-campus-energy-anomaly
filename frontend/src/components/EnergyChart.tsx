import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { SensorReading } from "@/hooks/useEnergyData";

interface EnergyChartProps {
  readings: SensorReading[];
  forecast: { timestamp: Date; predicted: number }[];
  selectedBuilding: string;
  metric: "kWh" | "temperature" | "co2";
}

const metricConfig = {
  kWh: { label: "Energy (kWh)", color: "hsl(172, 66%, 50%)", gradient: "chartEnergy" },
  temperature: { label: "Temperature (°C)", color: "hsl(38, 92%, 55%)", gradient: "chartTemp" },
  co2: { label: "CO₂ (ppm)", color: "hsl(280, 60%, 60%)", gradient: "chartCO2" },
};

export default function EnergyChart({ readings, forecast, selectedBuilding, metric }: EnergyChartProps) {
  const config = metricConfig[metric];
  
  if (!readings || readings.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 h-[260px] flex items-center justify-center">
        <p className="text-muted-foreground text-xs animate-pulse">Syncing sensors...</p>
      </div>
    );
  }

  const data = useMemo(() => {
    const buildingReadings = readings.filter((r) => r.buildingId === selectedBuilding);
    const historical = buildingReadings.slice(-30).map((r) => ({
      time: r.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: Math.round((metric === "kWh" ? r.kWh : metric === "temperature" ? r.temperature : r.co2) * 10) / 10,
      forecast: undefined as number | undefined,
    }));

    if (metric === "kWh") {
      const forecastData = forecast.map((f) => ({
        time: f.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: undefined as number | undefined,
        forecast: Math.round(f.predicted * 10) / 10,
      }));
      return [...historical, ...forecastData];
    }

    return historical;
  }, [readings, forecast, selectedBuilding, metric]);

  const avg = useMemo(() => {
    const vals = data.filter((d) => d.value !== undefined).map((d) => d.value!);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  }, [data]);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{config.label}</h3>
        <span className="font-mono-data text-xs text-muted-foreground">avg: {avg}</span>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={config.gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(215, 12%, 55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(215, 12%, 55%)" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 15%)",
                border: "1px solid hsl(220, 14%, 20%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(210, 20%, 92%)",
              }}
            />
            <ReferenceLine y={avg} stroke="hsl(215, 12%, 35%)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              fill={`url(#${config.gradient})`}
              dot={false}
              isAnimationActive={false}
            />
            {metric === "kWh" && (
              <Area
                type="monotone"
                dataKey="forecast"
                stroke={config.color}
                strokeWidth={2}
                strokeDasharray="6 3"
                fill="none"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {metric === "kWh" && (
        <p className="text-[10px] text-muted-foreground mt-2">
          <span className="inline-block w-4 border-t-2 border-dashed mr-1 align-middle" style={{ borderColor: config.color }} />
          ML Forecast (time-series regression)
        </p>
      )}
    </div>
  );
}
