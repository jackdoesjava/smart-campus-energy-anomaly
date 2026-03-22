import { useState, useEffect, useCallback, useRef } from "react";

export interface Building {
  id: string;
  name: string;
  area: number; // m²
  floors: number;
}

export interface SensorReading {
  timestamp: Date;
  buildingId: string;
  kWh: number;
  temperature: number;
  co2: number;
}

export interface KPIData {
  energyIntensity: number; // kWh/m²
  outOfHoursShare: number; // percentage
  avgTemperature: number;
  avgCO2: number;
  totalKWh: number;
  anomalyCount: number;
}

export interface AnomalyEvent {
  id: string;
  timestamp: Date;
  buildingId: string;
  buildingName: string;
  type: "energy" | "temperature" | "co2";
  severity: "low" | "medium" | "high" | "critical";
  value: number;
  baseline: number;
  zScore: number;
  message: string;
  tag?: string;
  acknowledged: boolean;
}

export interface AnonymousReport {
  id: string;
  timestamp: Date;
  buildingId: string;
  message: string;
}

export const BUILDINGS: Building[] = [
  { id: "eng-block", name: "Engineering Block", area: 4200, floors: 4 },
  { id: "lib-main", name: "Main Library", area: 6800, floors: 3 },
  { id: "sci-lab", name: "Science Laboratory", area: 3100, floors: 2 },
  { id: "admin-hq", name: "Admin Building", area: 2400, floors: 3 },
  { id: "sports-ctr", name: "Sports Centre", area: 5500, floors: 2 },
];

const ANOMALY_TAGS = ["HVAC Fault", "Lighting Left On", "Equipment Malfunction", "Weather-Related", "Holiday Spike", "Untagged"];

function generateBaselineReading(buildingId: string, hour: number): { kWh: number; temp: number; co2: number } {
  const building = BUILDINGS.find((b) => b.id === buildingId)!;
  const areaFactor = building.area / 3000;
  const isWorkHours = hour >= 8 && hour <= 18;
  const occupancyFactor = isWorkHours ? 1 : 0.25;

  return {
    kWh: (45 + Math.random() * 15) * areaFactor * occupancyFactor,
    temp: 20 + Math.random() * 3 + (isWorkHours ? 2 : 0),
    co2: 400 + Math.random() * 100 * occupancyFactor + (isWorkHours ? 200 : 0),
  };
}

function computeZScore(value: number, mean: number, stdDev: number): number {
  return stdDev === 0 ? 0 : Math.abs((value - mean) / stdDev);
}

function classifySeverity(zScore: number): AnomalyEvent["severity"] {
  if (zScore >= 4) return "critical";
  if (zScore >= 3) return "high";
  if (zScore >= 2.5) return "medium";
  return "low";
}

export function useEnergyData() {
  const [selectedBuilding, setSelectedBuilding] = useState<string>("eng-block");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [events, setEvents] = useState<AnomalyEvent[]>([]);
  const [reports, setReports] = useState<AnonymousReport[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [forecast, setForecast] = useState<{ timestamp: Date; predicted: number }[]>([]);

  const readingsRef = useRef<SensorReading[]>([]);
  const baselineStats = useRef<Map<string, { means: { kWh: number; temp: number; co2: number }; stds: { kWh: number; temp: number; co2: number } }>>(new Map());

  // Initialize baseline stats
  useEffect(() => {
    BUILDINGS.forEach((b) => {
      const samples = Array.from({ length: 100 }, () => generateBaselineReading(b.id, 12));
      const mean = (arr: number[]) => arr.reduce((a, c) => a + c, 0) / arr.length;
      const std = (arr: number[], m: number) => Math.sqrt(arr.reduce((a, c) => a + (c - m) ** 2, 0) / arr.length);

      const kWhArr = samples.map((s) => s.kWh);
      const tempArr = samples.map((s) => s.temp);
      const co2Arr = samples.map((s) => s.co2);

      baselineStats.current.set(b.id, {
        means: { kWh: mean(kWhArr), temp: mean(tempArr), co2: mean(co2Arr) },
        stds: { kWh: std(kWhArr, mean(kWhArr)), temp: std(tempArr, mean(tempArr)), co2: std(co2Arr, mean(co2Arr)) },
      });
    });

    // Seed initial historical data
    const now = new Date();
    const initial: SensorReading[] = [];
    for (let i = 30; i >= 0; i--) {
      const ts = new Date(now.getTime() - i * 60000);
      BUILDINGS.forEach((b) => {
        const base = generateBaselineReading(b.id, ts.getHours());
        initial.push({ timestamp: ts, buildingId: b.id, kWh: base.kWh, temperature: base.temp, co2: base.co2 });
      });
    }
    setReadings(initial);
    readingsRef.current = initial;
  }, []);

  // Generate forecast
  useEffect(() => {
    const buildingReadings = readingsRef.current.filter((r) => r.buildingId === selectedBuilding);
    if (buildingReadings.length < 5) return;

    const recent = buildingReadings.slice(-10);
    const avgKWh = recent.reduce((a, r) => a + r.kWh, 0) / recent.length;
    const trend = recent.length > 1 ? (recent[recent.length - 1].kWh - recent[0].kWh) / recent.length : 0;

    const now = new Date();
    const fc = Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date(now.getTime() + (i + 1) * 60000),
      predicted: Math.max(0, avgKWh + trend * (i + 1) + (Math.random() - 0.5) * 8),
    }));
    setForecast(fc);
  }, [readings, selectedBuilding]);

  // Live data simulation
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const newReadings: SensorReading[] = [];
      const newEvents: AnomalyEvent[] = [];

      BUILDINGS.forEach((b) => {
        const base = generateBaselineReading(b.id, hour);
        const stats = baselineStats.current.get(b.id)!;

        // 8% chance of anomaly per building per tick
        const injectAnomaly = Math.random() < 0.08;
        let kWh = base.kWh;
        let temp = base.temp;
        let co2 = base.co2;

        if (injectAnomaly) {
          const type = ["energy", "temperature", "co2"][Math.floor(Math.random() * 3)] as AnomalyEvent["type"];
          if (type === "energy") kWh *= 2.5 + Math.random() * 2;
          if (type === "temperature") temp += 8 + Math.random() * 7;
          if (type === "co2") co2 *= 2 + Math.random() * 1.5;

          const value = type === "energy" ? kWh : type === "temperature" ? temp : co2;
          const mean = type === "energy" ? stats.means.kWh : type === "temperature" ? stats.means.temp : stats.means.co2;
          const std = type === "energy" ? stats.stds.kWh : type === "temperature" ? stats.stds.temp : stats.stds.co2;
          const zScore = computeZScore(value, mean, std);
          const severity = classifySeverity(zScore);

          const units = type === "energy" ? "kWh" : type === "temperature" ? "°C" : "ppm";

          newEvents.push({
            id: `evt-${Date.now()}-${b.id}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: now,
            buildingId: b.id,
            buildingName: b.name,
            type,
            severity,
            value: Math.round(value * 10) / 10,
            baseline: Math.round(mean * 10) / 10,
            zScore: Math.round(zScore * 100) / 100,
            message: `${b.name}: ${type} anomaly detected — ${Math.round(value)}${units} (baseline: ${Math.round(mean)}${units}, z=${zScore.toFixed(1)})`,
            tag: Math.random() > 0.5 ? ANOMALY_TAGS[Math.floor(Math.random() * ANOMALY_TAGS.length)] : undefined,
            acknowledged: false,
          });
        }

        newReadings.push({ timestamp: now, buildingId: b.id, kWh, temperature: temp, co2 });
      });

      setReadings((prev) => {
        const updated = [...prev, ...newReadings].slice(-500);
        readingsRef.current = updated;
        return updated;
      });

      if (newEvents.length > 0) {
        setEvents((prev) => [...newEvents, ...prev].slice(0, 200));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive]);

  const getKPIs = useCallback((): KPIData => {
    const buildingReadings = readingsRef.current.filter((r) => r.buildingId === selectedBuilding);
    const building = BUILDINGS.find((b) => b.id === selectedBuilding)!;
    if (buildingReadings.length === 0) {
      return { energyIntensity: 0, outOfHoursShare: 0, avgTemperature: 0, avgCO2: 0, totalKWh: 0, anomalyCount: 0 };
    }

    const totalKWh = buildingReadings.reduce((a, r) => a + r.kWh, 0);
    const outOfHours = buildingReadings.filter((r) => {
      const h = r.timestamp.getHours();
      return h < 8 || h > 18;
    });
    const outOfHoursKWh = outOfHours.reduce((a, r) => a + r.kWh, 0);

    return {
      energyIntensity: Math.round((totalKWh / building.area) * 100) / 100,
      outOfHoursShare: totalKWh > 0 ? Math.round((outOfHoursKWh / totalKWh) * 1000) / 10 : 0,
      avgTemperature: Math.round((buildingReadings.reduce((a, r) => a + r.temperature, 0) / buildingReadings.length) * 10) / 10,
      avgCO2: Math.round(buildingReadings.reduce((a, r) => a + r.co2, 0) / buildingReadings.length),
      totalKWh: Math.round(totalKWh),
      anomalyCount: events.filter((e) => e.buildingId === selectedBuilding).length,
    };
  }, [selectedBuilding, events]);

  const tagEvent = useCallback((eventId: string, tag: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, tag } : e)));
  }, []);

  const acknowledgeEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, acknowledged: true } : e)));
  }, []);

  const submitReport = useCallback((buildingId: string, message: string) => {
    setReports((prev) => [
      { id: `rpt-${Date.now()}`, timestamp: new Date(), buildingId, message },
      ...prev,
    ]);
  }, []);

  return {
    buildings: BUILDINGS,
    selectedBuilding,
    setSelectedBuilding,
    readings,
    events,
    reports,
    isLive,
    setIsLive,
    forecast,
    getKPIs,
    tagEvent,
    acknowledgeEvent,
    submitReport,
  };
}
