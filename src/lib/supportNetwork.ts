/**
 * Emergency Support Network — anonymous help request broadcast / receive.
 *
 * Help seekers broadcast a minimal, anonymised request over Gun.js P2P.
 * Supporters subscribe and accept requests, opening a shared E2E chat room.
 * Location is fuzzy (≈11 km grid); no user identity is ever transmitted.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Gun from "gun";
import { generateRoomCode } from "./p2pChat";

const PEERS = [
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wallie.io/gun",
];
let _gun: any = null;
function getGun() {
  if (!_gun) _gun = Gun({ peers: PEERS, localStorage: false });
  return _gun;
}

const REQUESTS_NS  = "unmuted-requests-v1";
const SUPPORTER_KEY = "unmuted_supporter_mode";

// ── Types ──────────────────────────────────────────────────────────────────────

export type HelpType    = "stalking" | "address-leak" | "harassment" | "unsafe" | "shelter";
export type SupportType = "emotional" | "physical" | "info";

export interface HelpRequest {
  id:           string;
  helpType:     HelpType;
  supportTypes: SupportType[];
  locationHint: string; // city-level only
  roomCode:     string;
  createdAt:    number;
  expiresAt:    number;
}

// ── Config ────────────────────────────────────────────────────────────────────

export const HELP_TYPE_CONFIG: {
  id: HelpType; label: string; icon: string; desc: string;
}[] = [
  { id: "stalking",      label: "跟踪骚扰",   icon: "👣", desc: "被人跟踪或监视" },
  { id: "address-leak",  label: "信息泄露",   icon: "🔓", desc: "个人信息被暴露或泄露" },
  { id: "harassment",    label: "骚扰威胁",   icon: "⚠️", desc: "受到骚扰、威胁或恐吓" },
  { id: "unsafe",        label: "感到不安全", icon: "😰", desc: "当前环境令我感到不安" },
  { id: "shelter",       label: "需要安全空间", icon: "🏠", desc: "需要临时安全的去处" },
];

export const SUPPORT_TYPE_CONFIG: {
  id: SupportType; label: string; icon: string; desc: string;
}[] = [
  { id: "emotional", label: "情绪支持", icon: "💙", desc: "倾听、陪伴与安慰" },
  { id: "physical",  label: "陪同接应", icon: "🤝", desc: "线下陪同或安全接应" },
  { id: "info",      label: "信息建议", icon: "💡", desc: "法律、安全或翻译建议" },
];

// ── Supporter mode ─────────────────────────────────────────────────────────────

export function isSupporterMode(): boolean {
  return localStorage.getItem(SUPPORTER_KEY) === "true";
}

export function setSupporterMode(val: boolean) {
  localStorage.setItem(SUPPORTER_KEY, String(val));
}

// ── Request lifecycle ──────────────────────────────────────────────────────────

/** Create a help request object synchronously (room code generated locally). */
export function createHelpRequest(
  helpType: HelpType,
  supportTypes: SupportType[],
  locationHint: string
): HelpRequest {
  const now = Date.now();
  return {
    id:           Math.random().toString(36).slice(2, 10),
    helpType,
    supportTypes,
    locationHint,
    roomCode:     generateRoomCode(),
    createdAt:    now,
    expiresAt:    now + 2 * 60 * 60 * 1000, // 2 hours
  };
}

/** Broadcast an already-created request to Gun.js (fire-and-forget). */
export function broadcastHelpRequest(req: HelpRequest): void {
  try {
    getGun()
      .get(REQUESTS_NS)
      .get(req.id)
      .put({
        id:           req.id,
        helpType:     req.helpType,
        supportTypes: JSON.stringify(req.supportTypes),
        locationHint: req.locationHint,
        roomCode:     req.roomCode,
        createdAt:    req.createdAt,
        expiresAt:    req.expiresAt,
      });
  } catch {
    // offline: seeker can still use the room code
  }
}

/** Subscribe to incoming help requests (for supporters). */
export function subscribeHelpRequests(
  onRequest: (req: HelpRequest) => void
): () => void {
  let active = true;
  const seen = new Set<string>();

  try {
    getGun()
      .get(REQUESTS_NS)
      .map()
      .on((data: any) => {
        if (!active || !data?.id || seen.has(data.id)) return;
        if ((data.expiresAt ?? 0) < Date.now()) return;
        seen.add(data.id);
        try {
          onRequest({
            id:           data.id,
            helpType:     data.helpType as HelpType,
            supportTypes: JSON.parse(data.supportTypes ?? "[]") as SupportType[],
            locationHint: data.locationHint ?? "未知区域",
            roomCode:     data.roomCode,
            createdAt:    data.createdAt,
            expiresAt:    data.expiresAt,
          });
        } catch {
          // malformed entry
        }
      });
  } catch {
    // Gun unavailable
  }

  return () => { active = false; };
}

/** Get a fuzzy location string (city-level, ~11 km grid). */
export async function getFuzzyLocation(): Promise<string> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve("当前区域"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude  * 10) / 10;
        const lng = Math.round(pos.coords.longitude * 10) / 10;
        const ns  = lat >= 0 ? "N" : "S";
        const ew  = lng >= 0 ? "E" : "W";
        resolve(`附近区域 (${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lng).toFixed(1)}°${ew})`);
      },
      () => resolve("当前区域"),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  });
}
