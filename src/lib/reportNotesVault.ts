type StoredKeyRow = {
  id: string;
  key: CryptoKey;
};

export type EncryptedReportNoteRecord = {
  id: string;
  situationId: string;
  encryptedPayload: string;
  iv: string;
  encryptedHash: string;
  noteCount: number;
  createdAt: number;
};

const DB_NAME = "the_unmuted_report_notes_keys";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const KEY_ID = "report-notes-aes-gcm-v1";
const NOTES_KEY = "the_unmuted_encrypted_report_notes";

function bufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function toHex(buffer: ArrayBuffer | ArrayBufferLike) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readEncryptedNotes(): EncryptedReportNoteRecord[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeEncryptedNotes(records: EncryptedReportNoteRecord[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(records.slice(0, 50)));
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredNotesKey(): Promise<CryptoKey | null> {
  const db = await openKeyDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, "readonly");
    const request = transaction.objectStore(KEY_STORE).get(KEY_ID);

    request.onsuccess = () => {
      const row = request.result as StoredKeyRow | undefined;
      resolve(row?.key ?? null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function storeNotesKey(key: CryptoKey) {
  const db = await openKeyDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, "readwrite");
    transaction.objectStore(KEY_STORE).put({ id: KEY_ID, key });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getOrCreateNotesKey() {
  const existing = await getStoredNotesKey();
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await storeNotesKey(key);
  return key;
}

export function hasReportNotes(notes: Record<string, string | undefined>) {
  return Object.values(notes).some((value) => (value ?? "").trim().length > 0);
}

export async function saveEncryptedReportNotes(
  situationId: string,
  notes: Record<string, string | undefined>
) {
  const trimmedNotes = Object.fromEntries(
    Object.entries(notes)
      .map(([key, value]) => [key, (value ?? "").trim()])
      .filter(([, value]) => value.length > 0)
  );

  const noteCount = Object.keys(trimmedNotes).length;
  if (noteCount === 0) {
    throw new Error("EMPTY_NOTES");
  }

  const createdAt = Date.now();
  const payload = JSON.stringify({
    version: 1,
    situationId,
    notes: trimmedNotes,
    createdAt,
  });

  const key = await getOrCreateNotesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(payload)
  );
  const encryptedHash = await crypto.subtle.digest("SHA-256", encrypted);

  const record: EncryptedReportNoteRecord = {
    id: crypto.randomUUID(),
    situationId,
    encryptedPayload: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
    encryptedHash: toHex(encryptedHash),
    noteCount,
    createdAt,
  };

  writeEncryptedNotes([record, ...readEncryptedNotes()]);
  return record;
}

export function loadEncryptedReportNotes() {
  return readEncryptedNotes();
}
