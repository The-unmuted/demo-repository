/**
 * Geo-fencing alert system — anonymous zone clustering
 *
 * Zones: 0.1° grid ≈ 11 km × 11 km
 * Zone identity: first 16 hex chars of SHA256(zoneKey) — never stores real coords
 *
 * Alert thresholds: 2+ reports → medium, 4+ → high, 7+ → critical (within 7 days)
 */

const ZONE_REPORTS_KEY = "unmuted_zone_reports";
const MAP_ALERTS_KEY   = "unmuted_map_alerts_v1";
export const MAP_ALERTS_CHANGED_EVENT = "unmuted-map-alerts-changed";
const ALERT_WINDOW_MS  = 7 * 24 * 60 * 60 * 1000;
const EMERGENCY_ALERT_WINDOW_MS = 60 * 60 * 1000;
const COMMUNITY_ALERT_WINDOW_MS = 2 * 60 * 60 * 1000;

const FALLBACK_DEMO_COORDS = { lat: 31.2304, lng: 121.4737 };

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
  kind?: MapAlertKind;
}

export type MapAlertKind = "emergency" | "community";
export type MapAlertSource = "demo" | "local";
export type RiskLevel = "medium" | "high" | "critical";

export interface AlertZone {
  zoneHash: string;
  count: number;
  latestAt: number;
  riskLevel: RiskLevel;
  isSameZone: boolean;
  kind: MapAlertKind;
}

export interface MapAlertRecord {
  id: string;
  kind: MapAlertKind;
  lat: number;
  lng: number;
  locationLabel: string;
  createdAt: number;
  expiresAt: number;
  source: MapAlertSource;
  helpType?: string;
  supportTypes?: string[];
  noteEn?: string;
  noteZh?: string;
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

function loadMapAlerts(): MapAlertRecord[] {
  try { return JSON.parse(localStorage.getItem(MAP_ALERTS_KEY) || "[]"); }
  catch { return []; }
}

function saveMapAlerts(alerts: MapAlertRecord[]) {
  const now = Date.now();
  localStorage.setItem(
    MAP_ALERTS_KEY,
    JSON.stringify(alerts.filter(alert => alert.expiresAt > now).slice(0, 80))
  );
}

function notifyMapAlertsChanged() {
  window.dispatchEvent(new Event(MAP_ALERTS_CHANGED_EVENT));
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getBrowserCoords(enableHighAccuracy = false): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy, timeout: 5000 }
    );
  });
}

function getDemoMapAlerts(lat: number, lng: number): MapAlertRecord[] {
  const now = Date.now();
  const fuzzyLabel = `Nearby area (${Math.abs(Math.round(lat * 10) / 10).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(Math.round(lng * 10) / 10).toFixed(1)}°${lng >= 0 ? "E" : "W"})`;

  return [
    {
      id: "demo-emergency-live-location",
      kind: "emergency",
      lat: lat + 0.0048,
      lng: lng - 0.0038,
      locationLabel: "Live location shared",
      createdAt: now - 4 * 60 * 1000,
      expiresAt: now + 52 * 60 * 1000,
      source: "demo",
      noteEn: "SOS button pressed. Exact live location stays visible until the alert is resolved.",
      noteZh: "用户触发 SOS。精确实时位置会在警报解除前持续显示。",
    },
    {
      id: "demo-community-stalking",
      kind: "community",
      lat: Math.round((lat + 0.018) * 100) / 100,
      lng: Math.round((lng + 0.012) * 100) / 100,
      locationLabel: fuzzyLabel,
      createdAt: now - 18 * 60 * 1000,
      expiresAt: now + 102 * 60 * 1000,
      source: "demo",
      helpType: "stalking",
      supportTypes: ["emotional", "physical"],
      noteEn: "Community Help request for accompaniment and emotional support.",
      noteZh: "社区陪伴支持请求：需要陪同接应与情绪支持。",
    },
    {
      id: "demo-community-safe-space",
      kind: "community",
      lat: Math.round((lat - 0.026) * 100) / 100,
      lng: Math.round((lng + 0.021) * 100) / 100,
      locationLabel: fuzzyLabel,
      createdAt: now - 31 * 60 * 1000,
      expiresAt: now + 89 * 60 * 1000,
      source: "demo",
      helpType: "shelter",
      supportTypes: ["info"],
      noteEn: "Non-emergency request looking for a temporary safe space.",
      noteZh: "非紧急请求：正在寻找临时安全空间。",
    },
  ];
}

/** Called when a new evidence/SOS/community request is submitted — anonymously logs the zone. */
export async function reportZone(lat: number, lng: number, kind: MapAlertKind = "emergency"): Promise<void> {
  const hash = await zoneHash(lat, lng);
  const reports = loadReports();
  reports.push({ zoneHash: hash, timestamp: Date.now(), kind });
  saveReports(reports);
}

/** Stores a precise, active emergency alert for demo/live response UI. */
export function recordEmergencyMapAlert(lat: number, lng: number): MapAlertRecord | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;

  const now = Date.now();
  const alert: MapAlertRecord = {
    id: makeId("sos"),
    kind: "emergency",
    lat,
    lng,
    locationLabel: "Live location shared",
    createdAt: now,
    expiresAt: now + EMERGENCY_ALERT_WINDOW_MS,
    source: "local",
    noteEn: "SOS button pressed from this device. Exact live location is visible for emergency response.",
    noteZh: "本设备触发 SOS。精确实时位置会用于紧急响应。",
  };

  saveMapAlerts([alert, ...loadMapAlerts()]);
  notifyMapAlertsChanged();
  return alert;
}

export async function recordCommunityHelpMapAlert({
  helpType,
  supportTypes,
  locationHint,
}: {
  helpType: string;
  supportTypes: string[];
  locationHint: string;
}): Promise<MapAlertRecord> {
  const coords = await getBrowserCoords(false);
  const base = coords ?? FALLBACK_DEMO_COORDS;
  const now = Date.now();
  const alert: MapAlertRecord = {
    id: makeId("community"),
    kind: "community",
    lat: Math.round(base.lat * 100) / 100,
    lng: Math.round(base.lng * 100) / 100,
    locationLabel: locationHint,
    createdAt: now,
    expiresAt: now + COMMUNITY_ALERT_WINDOW_MS,
    source: "local",
    helpType,
    supportTypes,
    noteEn: "Community Help request. Only a fuzzy area is shown to nearby supporters.",
    noteZh: "社区陪伴支持请求。地图仅显示模糊区域给附近支援者。",
  };

  saveMapAlerts([alert, ...loadMapAlerts()]);
  if (coords) void reportZone(coords.lat, coords.lng, "community");
  notifyMapAlertsChanged();
  return alert;
}

export function getMapAlertRecords(lat = FALLBACK_DEMO_COORDS.lat, lng = FALLBACK_DEMO_COORDS.lng, includeDemo = true): MapAlertRecord[] {
  const now = Date.now();
  const liveAlerts = loadMapAlerts().filter(alert => alert.expiresAt > now);
  return [
    ...liveAlerts,
    ...(includeDemo ? getDemoMapAlerts(lat, lng) : []),
  ].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "emergency" ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

/** Seed demo alerts around a given location (for hackathon demo). */
export async function seedDemoAlerts(lat: number, lng: number): Promise<void> {
  const reports = loadReports();
  const now = Date.now();
  const offsets: [number, number, MapAlertKind][] = [
    [0, 0, "emergency"], [0, 0, "emergency"], [0, 0, "emergency"],
    [0.1, 0, "community"], [0.1, 0, "community"], [0.1, 0, "community"], [0.1, 0, "community"],
    [-0.1, 0.1, "community"], [-0.1, 0.1, "community"],
  ];
  for (const [dLat, dLng, kind] of offsets) {
    const hash = await zoneHash(lat + dLat, lng + dLng);
    reports.push({ zoneHash: hash, timestamp: now - Math.random() * 3 * 24 * 60 * 60 * 1000, kind });
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
    const kind = r.kind ?? "emergency";
    const key = `${kind}:${r.zoneHash}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    latest.set(key, Math.max(latest.get(key) ?? 0, r.timestamp));
  }

  const alerts: AlertZone[] = [];
  for (const [key, count] of counts) {
    if (count < 2) continue;
    const [kind, hash] = key.split(":") as [MapAlertKind, string];
    const riskLevel: RiskLevel = count >= 7 ? "critical" : count >= 4 ? "high" : "medium";
    alerts.push({ zoneHash: hash, count, latestAt: latest.get(key)!, riskLevel, isSameZone: hash === myHash, kind });
  }

  return alerts.sort((a, b) => {
    if (a.isSameZone !== b.isSameZone) return a.isSameZone ? -1 : 1;
    return b.count - a.count;
  });
}

export function alertKindLabel(kind: MapAlertKind, language: "en" | "zh" = "zh"): string {
  if (language === "en") {
    return kind === "emergency" ? "Emergency SOS" : "Community Help";
  }
  return kind === "emergency" ? "紧急 SOS" : "社区陪伴支持";
}

export function riskLabel(level: RiskLevel, language: "en" | "zh" = "zh"): string {
  if (language === "en") {
    return { medium: "⚠️ Medium risk", high: "🔴 High risk", critical: "🚨 Critical risk" }[level];
  }
  return { medium: "⚠️ 中风险", high: "🔴 高风险", critical: "🚨 极高风险" }[level];
}

export function riskColor(level: RiskLevel): string {
  return { medium: "text-sos-offline", high: "text-primary", critical: "text-primary" }[level];
}

export function riskBg(level: RiskLevel): string {
  return { medium: "bg-sos-offline/10 border-sos-offline/30", high: "bg-primary/10 border-primary/30", critical: "bg-primary/15 border-primary/50" }[level];
}

export function timeAgo(ts: number, language: "en" | "zh" = "zh"): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  if (language === "en") {
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
  if (h < 1) return "刚刚";
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}
