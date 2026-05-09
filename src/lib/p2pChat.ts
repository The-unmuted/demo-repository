/**
 * P2P encrypted chat via Gun.js
 *
 * Transport:  Gun.js (decentralised, free public relay nodes)
 * Encryption: AES-256-GCM derived from room code (PBKDF2, 100k iterations)
 *             — all messages and aliases are encrypted before touching Gun
 *
 * Production upgrade: switch Gun relay to self-hosted or XMTP protocol.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — gun has no bundled TS declarations
import Gun from "gun";

// Public relay peers (Gun community nodes)
const PEERS = [
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wallie.io/gun",
];

// Lazily initialised singleton
let _gun: any = null;
function getGun() {
  if (!_gun) _gun = Gun({ peers: PEERS, localStorage: false });
  return _gun;
}

// ── Crypto helpers ─────────────────────────────────────────────────────────────

async function deriveRoomKey(roomCode: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(roomCode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("unmuted-chat-salt-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(key: CryptoKey, ciphertext: string): Promise<string> {
  const bytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv    = bytes.slice(0, 12);
  const data  = bytes.slice(12);
  const dec   = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}

// ── Room key cache ─────────────────────────────────────────────────────────────

const keyCache = new Map<string, CryptoKey>();

export async function getRoomKey(roomCode: string): Promise<CryptoKey> {
  if (!keyCache.has(roomCode)) {
    keyCache.set(roomCode, await deriveRoomKey(roomCode));
  }
  return keyCache.get(roomCode)!;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  alias: string;
  text: string;
  timestamp: number;
  isMine?: boolean;
}

const GUN_NAMESPACE = "unmuted-chat-v1";

/** Send an encrypted message to a room. */
export async function sendMessage(
  roomCode: string,
  alias: string,
  text: string
): Promise<void> {
  const key           = await getRoomKey(roomCode);
  const [encAlias, encText] = await Promise.all([encrypt(key, alias), encrypt(key, text)]);
  const id            = crypto.randomUUID();

  getGun()
    .get(GUN_NAMESPACE)
    .get(roomCode)
    .get("msgs")
    .get(id)
    .put({ id, alias: encAlias, text: encText, ts: Date.now() });
}

/** Subscribe to incoming messages for a room. Returns an unsubscribe fn. */
export function subscribeRoom(
  roomCode: string,
  myAlias: string,
  onMessage: (msg: ChatMessage) => void
): () => void {
  let active = true;
  const seen = new Set<string>();

  getRoomKey(roomCode).then(key => {
    getGun()
      .get(GUN_NAMESPACE)
      .get(roomCode)
      .get("msgs")
      .map()
      .on(async (data: any) => {
        if (!active || !data?.id || seen.has(data.id)) return;
        seen.add(data.id);

        try {
          const [alias, text] = await Promise.all([
            decrypt(key, data.alias),
            decrypt(key, data.text),
          ]);
          onMessage({
            id:        data.id,
            alias,
            text,
            timestamp: data.ts ?? Date.now(),
            isMine:    alias === myAlias,
          });
        } catch {
          // Decryption failure = message from different room key — ignore
        }
      });
  });

  return () => { active = false; };
}

/** Generate a random 6-char room code. */
export function generateRoomCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => chars[b % chars.length])
    .join("");
}

// ── Persisted room list ────────────────────────────────────────────────────────

const ROOMS_KEY = "unmuted_chat_rooms";

export interface SavedRoom { code: string; alias: string; joinedAt: number }

export function loadSavedRooms(): SavedRoom[] {
  try { return JSON.parse(localStorage.getItem(ROOMS_KEY) || "[]"); }
  catch { return []; }
}

export function saveRoom(room: SavedRoom) {
  const rooms = loadSavedRooms().filter(r => r.code !== room.code);
  rooms.unshift(room);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms.slice(0, 20)));
}

export function leaveRoom(code: string) {
  const rooms = loadSavedRooms().filter(r => r.code !== code);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}
