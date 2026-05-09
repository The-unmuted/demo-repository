/**
 * Geo-fencing alert system — anonymous zone clustering
 *
 * Zones: 0.1° grid ≈ 11 km × 11 km
 * Zone identity: first 16 hex chars of SHA256(zoneKey) — never stores real coords
 *
 * Alert thresholds: 2+ reports → medium, 4+ → high, 7+ → critical (within 7 days)
 */

const ZONE_REPORTS_KEY = "unmuted_zone_reports";
const ALERT_WINDOW_MS  = 7 * 24 * 60 * 60 * 1000;

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function quantize(coord: number, step = 0.1): number {
  return Math.floor(coord / step);
}

async function zoneHash(lat: number, lng: number): Promise<string> {
  const key = `${quantize(lat)},${quantize(lng)}`;
  return (await sha256hex(key)).slice(0, 16);
}

export interface ZoneReport {
  zoneHash: string;
  timestamp: number;
}

export type RiskLevel = "medium" | "high" | "critical";

export interface AlertZone {
  zoneHash: string;
  count: number;
  latestAt: number;
  riskLevel: RiskLevel;
  isSameZone: boolean;
}

function loadReports(): ZoneReport[] {
  try { return JSON.parse(localStorage.getItem(ZONE_REPORTS_KEY) || "[]"); }
  catch { return []; }
}

function saveReports(reports: ZoneReport[]) {
  const cutoff = Date.now() - ALERT_WINDOW_MS;
  localStorage.setItem(
    ZONE_REPORTS_KEY,
    JSON.stringify(reports.filter(r => r.timestamp > cutoff).slice(0, 1000))
  );
}

/** Called when a new evidence/SOS is submitted — anonymously logs the zone. */
export async function reportZone(lat: number, lng: number): Promise<void> {
  const hash = await zoneHash(lat, lng);
  const reports = loadReports();
  reports.push({ zoneHash: hash, timestamp: Date.now() });
  saveReports(reports);
}

/** Seed demo alerts around a given location (for hackathon demo). */
export async function seedDemoAlerts(lat: number, lng: number): Promise<void> {
  const reports = loadReports();
  const now = Date.now();
  const offsets = [
    [0, 0], [0, 0], [0, 0],           // 3 reports same zone
    [0.1, 0], [0.1, 0], [0.1, 0], [0.1, 0], // 4 reports adjacent zone
    [-0.1, 0.1], [-0.1, 0.1],         // 2 reports another zone
  ];
  for (const [dLat, dLng] of offsets) {
    const hash = await zoneHash(lat + dLat, lng + dLng);
    reports.push({ zoneHash: hash, timestamp: now - Math.random() * 3 * 24 * 60 * 60 * 1000 });
  }
  saveReports(reports);
}

/** Get all active alert zones, annotating which one the user is currently in. */
export async function getNearbyAlerts(lat: number, lng: number): Promise<AlertZone[]> {
  const cutoff  = Date.now() - ALERT_WINDOW_MS;
  const reports = loadReports().filter(r => r.timestamp > cutoff);
  const myHash  = await zoneHash(lat, lng);

  const counts  = new Map<string, number>();
  const latest  = new Map<string, number>();
  for (const r of reports) {
    counts.set(r.zoneHash, (counts.get(r.zoneHash) ?? 0) + 1);
    latest.set(r.zoneHash, Math.max(latest.get(r.zoneHash) ?? 0, r.timestamp));
  }

  const alerts: AlertZone[] = [];
  for (const [hash, count] of counts) {
    if (count < 2) continue;
    const riskLevel: RiskLevel = count >= 7 ? "critical" : count >= 4 ? "high" : "medium";
    alerts.push({ zoneHash: hash, count, latestAt: latest.get(hash)!, riskLevel, isSameZone: hash === myHash });
  }

  return alerts.sort((a, b) => {
    if (a.isSameZone !== b.isSameZone) return a.isSameZone ? -1 : 1;
    return b.count - a.count;
  });
}

export function riskLabel(level: RiskLevel): string {
  return { medium: "⚠️ 中风险", high: "🔴 高风险", critical: "🚨 极高风险" }[level];
}

export function riskColor(level: RiskLevel): string {
  return { medium: "text-sos-offline", high: "text-primary", critical: "text-primary" }[level];
}

export function riskBg(level: RiskLevel): string {
  return { medium: "bg-sos-offline/10 border-sos-offline/30", high: "bg-primary/10 border-primary/30", critical: "bg-primary/15 border-primary/50" }[level];
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "刚刚";
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}
