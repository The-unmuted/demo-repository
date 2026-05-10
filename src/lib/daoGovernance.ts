/**
 * Support DAO — governance primitives.
 *
 * Proposals are broadcast over Gun.js P2P and anchored to Solana via Memo.
 * Votes are aggregated locally from Gun.js messages; voterHash = SHA-256 of
 * the ZKP nullifier so voting is anonymous but Sybil-resistant.
 * SBTs (non-transferable identity badges for professionals) are stored
 * in Gun.js; ownership is tied to a ZKP nullifier hash.
 *
 * Pass threshold: ≥ 60% yes votes AND ≥ 1 expert endorsement.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Gun from "gun";

const PEERS = [
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wallie.io/gun",
];
type GunChain = {
  get: (key: string) => GunChain;
  put: (data: Record<string, unknown>) => void;
  map: () => GunChain;
  on: (callback: (data: unknown) => void) => void;
};

let _gun: GunChain | null = null;
function getGun() {
  if (!_gun) _gun = Gun({ peers: PEERS, localStorage: false });
  return _gun;
}

const NS_PROPOSALS = "unmuted-dao-proposals-v1";
const NS_VOTES     = "unmuted-dao-votes-v1";
const NS_SBT       = "unmuted-dao-sbt-v1";
const LS_PROPOSALS = "unmuted_dao_proposals";
const LS_OWN_VOTES = "unmuted_dao_own_votes";

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function readNumber(data: Record<string, unknown>, key: string, fallback = 0): number {
  const value = data[key];
  return typeof value === "number" ? value : fallback;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProposalType   = "legal" | "psychological" | "community";
export type ProposalStatus = "active" | "passed" | "rejected" | "funded";
export type SBTType        = "lawyer" | "psychologist" | "advocate";

export interface Proposal {
  id:              string;
  type:            ProposalType;
  title:           string;
  titleEn?:        string;
  titleZh?:        string;
  description:     string;
  descriptionEn?:  string;
  descriptionZh?:  string;
  evidenceHash?:   string; // optional link to vault record from 3.1
  amountRequested: number; // USDC
  proposerAlias:   string;
  proposerAliasEn?: string;
  proposerAliasZh?: string;
  createdAt:       number;
  expiresAt:       number; // 7 days
  status:          ProposalStatus;
}

export interface VoteRecord {
  proposalId: string;
  voterHash:  string; // SHA-256(nullifier) — anonymous but Sybil-resistant
  choice:     "yes" | "no";
  isExpert:   boolean;
  sbtType?:   SBTType;
  timestamp:  number;
}

export interface SBTHolder {
  alias:         string;
  nullifierHash: string;
  sbtType:       SBTType;
  claimedAt:     number;
}

// ── Config labels ──────────────────────────────────────────────────────────────

export const PROPOSAL_TYPE_CONFIG: {
  id: ProposalType;
  label: string;
  labelEn: string;
  labelZh: string;
  icon: string;
  desc: string;
  descEn: string;
  descZh: string;
  color: string;
}[] = [
  {
    id: "legal",
    label: "法律援助",
    labelEn: "Legal aid",
    labelZh: "法律援助",
    icon: "⚖️",
    desc: "律师协助、骚扰令申请、法律咨询",
    descEn: "Lawyer support, protection orders, and legal consultation",
    descZh: "律师协助、骚扰令申请、法律咨询",
    color: "text-blue-400",
  },
  {
    id: "psychological",
    label: "心理援助",
    labelEn: "Mental health aid",
    labelZh: "心理援助",
    icon: "🧠",
    desc: "心理咨询、创伤康复、危机干预",
    descEn: "Counseling, trauma recovery, and crisis intervention",
    descZh: "心理咨询、创伤康复、危机干预",
    color: "text-purple-400",
  },
  {
    id: "community",
    label: "社区决策",
    labelEn: "Community decision",
    labelZh: "社区决策",
    icon: "📋",
    desc: "社区规则、资金分配、治理修改",
    descEn: "Community rules, funding allocation, and governance updates",
    descZh: "社区规则、资金分配、治理修改",
    color: "text-emerald-400",
  },
];

export const SBT_TYPE_CONFIG: {
  id: SBTType;
  label: string;
  labelEn: string;
  labelZh: string;
  icon: string;
  desc: string;
  descEn: string;
  descZh: string;
}[] = [
  {
    id: "lawyer",
    label: "律师",
    labelEn: "Lawyer",
    labelZh: "律师",
    icon: "⚖️",
    desc: "持牌律师，可提供法律背书",
    descEn: "Licensed lawyer who can endorse legal requests",
    descZh: "持牌律师，可提供法律背书",
  },
  {
    id: "psychologist",
    label: "心理咨询师",
    labelEn: "Counselor",
    labelZh: "心理咨询师",
    icon: "🧠",
    desc: "注册心理咨询师，可评估援助需求",
    descEn: "Registered counselor who can assess support needs",
    descZh: "注册心理咨询师，可评估援助需求",
  },
  {
    id: "advocate",
    label: "权益倡导者",
    labelEn: "Advocate",
    labelZh: "权益倡导者",
    icon: "🛡️",
    desc: "认证社区权益倡导者",
    descEn: "Verified community rights advocate",
    descZh: "认证社区权益倡导者",
  },
];

// ── Treasury (demo constants) ──────────────────────────────────────────────────

export const TREASURY = {
  total:  1250,
  legal:  500,
  psych:  500,
  ops:    250,
  symbol: "USDC",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export async function hashNullifier(nullifier: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nullifier + ":voter")
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function computeVoteStats(votes: VoteRecord[]): {
  yes: number; no: number; expertYes: number; total: number; isPassed: boolean;
} {
  const yes      = votes.filter(v => v.choice === "yes").length;
  const no       = votes.filter(v => v.choice === "no").length;
  const expertYes = votes.filter(v => v.choice === "yes" && v.isExpert).length;
  const total    = yes + no;
  const isPassed = total >= 3 && yes / total >= 0.6 && expertYes >= 1;
  return { yes, no, expertYes, total, isPassed };
}

// ── LocalStorage helpers ───────────────────────────────────────────────────────

export function loadLocalProposals(): Proposal[] {
  try { return JSON.parse(localStorage.getItem(LS_PROPOSALS) ?? "[]"); }
  catch { return []; }
}

function saveLocalProposals(list: Proposal[]) {
  localStorage.setItem(LS_PROPOSALS, JSON.stringify(list.slice(0, 100)));
}

export function hasVoted(proposalId: string, voterHash: string): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(LS_OWN_VOTES) ?? "{}");
    return Boolean(map[proposalId + ":" + voterHash]);
  } catch { return false; }
}

function recordOwnVote(proposalId: string, voterHash: string) {
  try {
    const map = JSON.parse(localStorage.getItem(LS_OWN_VOTES) ?? "{}");
    map[proposalId + ":" + voterHash] = true;
    localStorage.setItem(LS_OWN_VOTES, JSON.stringify(map));
  } catch { /* ignore */ }
}

// ── Seed data (pre-populates the DAO for demo if storage is empty) ─────────────

const SEED_PROPOSALS: Proposal[] = [
  {
    id: "seed-001",
    type: "legal",
    title: "骚扰令法律协助申请",
    titleEn: "Protection order legal assistance",
    titleZh: "骚扰令法律协助申请",
    description: "需要律师协助申请人身保护令。骚扰者持续跟踪，已有多次骚扰记录并在证据库存证。请求 DAO 提供法律援助资金。",
    descriptionEn: "Needs lawyer support to apply for a personal protection order. The harasser continues to stalk them, with repeated incidents already secured in the evidence vault. Requests DAO legal aid funding.",
    descriptionZh: "需要律师协助申请人身保护令。骚扰者持续跟踪，已有多次骚扰记录并在证据库存证。请求 DAO 提供法律援助资金。",
    evidenceHash: "0x7f3a9b2c…",
    amountRequested: 300,
    proposerAlias: "沉默蓝鸟",
    proposerAliasEn: "Silent Bluebird",
    proposerAliasZh: "沉默蓝鸟",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
    status: "passed",
  },
  {
    id: "seed-002",
    type: "psychological",
    title: "创伤后心理康复支援",
    titleEn: "Post-trauma counseling support",
    titleZh: "创伤后心理康复支援",
    description: "经历长期家暴后寻求专业心理咨询。需要持续 3 个月的康复疗程支持，无力独自承担费用。",
    descriptionEn: "Seeking professional counseling after long-term domestic violence. Needs three months of recovery support and cannot cover the cost alone.",
    descriptionZh: "经历长期家暴后寻求专业心理咨询。需要持续 3 个月的康复疗程支持，无力独自承担费用。",
    amountRequested: 200,
    proposerAlias: "远山蔷薇",
    proposerAliasEn: "Distant Rose",
    proposerAliasZh: "远山蔷薇",
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
    status: "active",
  },
  {
    id: "seed-003",
    type: "community",
    title: "制定社区安全行动手册",
    titleEn: "Create a community safety playbook",
    titleZh: "制定社区安全行动手册",
    description: "提案建立一份面向社区成员的安全指南，包含遭遇跟踪、骚扰时的应对步骤与资源清单。",
    descriptionEn: "Proposal to create a safety guide for community members, including response steps and resource lists for stalking or harassment.",
    descriptionZh: "提案建立一份面向社区成员的安全指南，包含遭遇跟踪、骚扰时的应对步骤与资源清单。",
    amountRequested: 0,
    proposerAlias: "星野旅人",
    proposerAliasEn: "Starlit Traveler",
    proposerAliasZh: "星野旅人",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    expiresAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
    status: "funded",
  },
];

const SEED_VOTES: Record<string, VoteRecord[]> = {
  "seed-001": [
    { proposalId: "seed-001", voterHash: "aaa", choice: "yes", isExpert: true,  sbtType: "lawyer",       timestamp: Date.now() - 2 * 86400000 },
    { proposalId: "seed-001", voterHash: "bbb", choice: "yes", isExpert: true,  sbtType: "psychologist", timestamp: Date.now() - 2 * 86400000 },
    { proposalId: "seed-001", voterHash: "ccc", choice: "yes", isExpert: false, timestamp: Date.now() - 86400000 },
    { proposalId: "seed-001", voterHash: "ddd", choice: "yes", isExpert: false, timestamp: Date.now() - 86400000 },
    { proposalId: "seed-001", voterHash: "eee", choice: "yes", isExpert: false, timestamp: Date.now() - 43200000 },
    { proposalId: "seed-001", voterHash: "fff", choice: "yes", isExpert: false, timestamp: Date.now() - 43200000 },
    { proposalId: "seed-001", voterHash: "ggg", choice: "yes", isExpert: false, timestamp: Date.now() - 21600000 },
    { proposalId: "seed-001", voterHash: "hhh", choice: "yes", isExpert: false, timestamp: Date.now() - 21600000 },
    { proposalId: "seed-001", voterHash: "iii", choice: "yes", isExpert: false, timestamp: Date.now() - 10800000 },
    { proposalId: "seed-001", voterHash: "jjj", choice: "yes", isExpert: false, timestamp: Date.now() - 10800000 },
    { proposalId: "seed-001", voterHash: "kkk", choice: "yes", isExpert: false, timestamp: Date.now() - 3600000 },
    { proposalId: "seed-001", voterHash: "lll", choice: "yes", isExpert: false, timestamp: Date.now() - 3600000 },
    { proposalId: "seed-001", voterHash: "mmm", choice: "yes", isExpert: false, timestamp: Date.now() - 1800000 },
    { proposalId: "seed-001", voterHash: "nnn", choice: "yes", isExpert: false, timestamp: Date.now() - 900000 },
    { proposalId: "seed-001", voterHash: "ooo", choice: "yes", isExpert: false, timestamp: Date.now() - 600000 },
    { proposalId: "seed-001", voterHash: "ppp", choice: "no",  isExpert: false, timestamp: Date.now() - 7200000 },
    { proposalId: "seed-001", voterHash: "qqq", choice: "no",  isExpert: false, timestamp: Date.now() - 5400000 },
    { proposalId: "seed-001", voterHash: "rrr", choice: "no",  isExpert: false, timestamp: Date.now() - 3600000 },
  ],
  "seed-002": [
    { proposalId: "seed-002", voterHash: "s01", choice: "yes", isExpert: true,  sbtType: "psychologist", timestamp: Date.now() - 43200000 },
    { proposalId: "seed-002", voterHash: "s02", choice: "yes", isExpert: false, timestamp: Date.now() - 36000000 },
    { proposalId: "seed-002", voterHash: "s03", choice: "yes", isExpert: false, timestamp: Date.now() - 28800000 },
    { proposalId: "seed-002", voterHash: "s04", choice: "yes", isExpert: false, timestamp: Date.now() - 21600000 },
    { proposalId: "seed-002", voterHash: "s05", choice: "yes", isExpert: false, timestamp: Date.now() - 14400000 },
    { proposalId: "seed-002", voterHash: "s06", choice: "yes", isExpert: false, timestamp: Date.now() - 7200000 },
    { proposalId: "seed-002", voterHash: "s07", choice: "yes", isExpert: false, timestamp: Date.now() - 3600000 },
    { proposalId: "seed-002", voterHash: "s08", choice: "yes", isExpert: false, timestamp: Date.now() - 1800000 },
    { proposalId: "seed-002", voterHash: "s09", choice: "no",  isExpert: false, timestamp: Date.now() - 900000 },
  ],
  "seed-003": [
    { proposalId: "seed-003", voterHash: "t01", choice: "yes", isExpert: true,  sbtType: "advocate",     timestamp: Date.now() - 4 * 86400000 },
    { proposalId: "seed-003", voterHash: "t02", choice: "yes", isExpert: true,  sbtType: "lawyer",       timestamp: Date.now() - 4 * 86400000 },
    ...Array.from({ length: 20 }, (_, i) => ({
      proposalId: "seed-003", voterHash: `u${i.toString().padStart(2, "0")}`,
      choice: "yes" as const, isExpert: false, timestamp: Date.now() - (3 - i * 0.1) * 86400000,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      proposalId: "seed-003", voterHash: `v${i.toString().padStart(2, "0")}`,
      choice: "no" as const, isExpert: false, timestamp: Date.now() - (2 - i * 0.1) * 86400000,
    })),
  ],
};

const SEED_SBT: SBTHolder[] = [
  { alias: "Silent Maple",   nullifierHash: "expert-seed-001", sbtType: "lawyer",       claimedAt: Date.now() - 7 * 86400000 },
  { alias: "Distant Rose",   nullifierHash: "expert-seed-002", sbtType: "psychologist", claimedAt: Date.now() - 5 * 86400000 },
  { alias: "Starlit Traveler", nullifierHash: "expert-seed-003", sbtType: "advocate",   claimedAt: Date.now() - 3 * 86400000 },
];

const LS_SEEDED = "unmuted_dao_seeded";
const LS_VOTES  = "unmuted_dao_votes";
const LS_SBT    = "unmuted_dao_sbt";

export function seedDemoDataIfEmpty() {
  if (localStorage.getItem(LS_SEEDED)) return;
  saveLocalProposals(SEED_PROPOSALS);
  localStorage.setItem(LS_VOTES,  JSON.stringify(SEED_VOTES));
  localStorage.setItem(LS_SBT,    JSON.stringify(SEED_SBT));
  localStorage.setItem(LS_SEEDED, "1");
}

export function loadLocalVotes(proposalId: string): VoteRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem(LS_VOTES) ?? "{}");
    return all[proposalId] ?? [];
  } catch { return []; }
}

function saveLocalVotesForProposal(proposalId: string, votes: VoteRecord[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_VOTES) ?? "{}");
    all[proposalId] = votes;
    localStorage.setItem(LS_VOTES, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function loadLocalSBTs(): SBTHolder[] {
  try { return JSON.parse(localStorage.getItem(LS_SBT) ?? "[]"); }
  catch { return []; }
}

// ── Proposal API ───────────────────────────────────────────────────────────────

export function createProposal(
  type: ProposalType,
  title: string,
  description: string,
  proposerAlias: string,
  amountRequested: number,
  evidenceHash?: string
): Proposal {
  const now = Date.now();
  const p: Proposal = {
    id:              Math.random().toString(36).slice(2, 10),
    type, title, description, proposerAlias, amountRequested,
    evidenceHash:    evidenceHash || undefined,
    createdAt:       now,
    expiresAt:       now + 7 * 24 * 60 * 60 * 1000,
    status:          "active",
  };
  const existing = loadLocalProposals();
  saveLocalProposals([p, ...existing]);
  broadcastProposal(p);
  return p;
}

export function broadcastProposal(p: Proposal): void {
  try {
    getGun().get(NS_PROPOSALS).get(p.id).put({
      id: p.id, type: p.type, title: p.title,
      titleEn: p.titleEn ?? "",
      titleZh: p.titleZh ?? "",
      description: p.description,
      descriptionEn: p.descriptionEn ?? "",
      descriptionZh: p.descriptionZh ?? "",
      evidenceHash: p.evidenceHash ?? "",
      amountRequested: p.amountRequested,
      proposerAlias: p.proposerAlias,
      proposerAliasEn: p.proposerAliasEn ?? "",
      proposerAliasZh: p.proposerAliasZh ?? "",
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      status: p.status,
    });
  } catch { /* offline */ }
}

export function subscribeProposals(onProposal: (p: Proposal) => void): () => void {
  let active = true;
  const seen = new Set<string>();
  try {
    getGun().get(NS_PROPOSALS).map().on((data) => {
      if (!active || !isRecord(data)) return;
      const id = readString(data, "id");
      if (!id || seen.has(id)) return;
      seen.add(id);
      try {
        onProposal({
          id,
          type:            readString(data, "type") as ProposalType,
          title:           readString(data, "title"),
          titleEn:         readString(data, "titleEn") || undefined,
          titleZh:         readString(data, "titleZh") || undefined,
          description:     readString(data, "description"),
          descriptionEn:   readString(data, "descriptionEn") || undefined,
          descriptionZh:   readString(data, "descriptionZh") || undefined,
          evidenceHash:    readString(data, "evidenceHash") || undefined,
          amountRequested: readNumber(data, "amountRequested"),
          proposerAlias:   readString(data, "proposerAlias"),
          proposerAliasEn: readString(data, "proposerAliasEn") || undefined,
          proposerAliasZh: readString(data, "proposerAliasZh") || undefined,
          createdAt:       readNumber(data, "createdAt"),
          expiresAt:       readNumber(data, "expiresAt"),
          status:          readString(data, "status") as ProposalStatus,
        });
      } catch { /* malformed */ }
    });
  } catch { /* no Gun */ }
  return () => { active = false; };
}

// ── Voting API ─────────────────────────────────────────────────────────────────

export function castVote(vote: VoteRecord): void {
  // Persist locally
  const existing = loadLocalVotes(vote.proposalId);
  const deduped  = existing.filter(v => v.voterHash !== vote.voterHash);
  saveLocalVotesForProposal(vote.proposalId, [...deduped, vote]);
  recordOwnVote(vote.proposalId, vote.voterHash);

  // Broadcast
  try {
    const key = `${vote.proposalId}:${vote.voterHash}`;
    getGun().get(NS_VOTES).get(key).put({
      proposalId: vote.proposalId,
      voterHash:  vote.voterHash,
      choice:     vote.choice,
      isExpert:   vote.isExpert,
      sbtType:    vote.sbtType ?? "",
      timestamp:  vote.timestamp,
    });
  } catch { /* offline */ }
}

export function subscribeProposalVotes(
  proposalId: string,
  onVote: (v: VoteRecord) => void
): () => void {
  let active = true;
  const seen = new Set<string>();
  try {
    getGun().get(NS_VOTES).map().on((data) => {
      if (!active || !isRecord(data)) return;
      const incomingProposalId = readString(data, "proposalId");
      const voterHash = readString(data, "voterHash");
      if (!incomingProposalId || incomingProposalId !== proposalId) return;
      const key = `${incomingProposalId}:${voterHash}`;
      if (seen.has(key)) return;
      seen.add(key);
      try {
        onVote({
          proposalId: incomingProposalId,
          voterHash,
          choice:     readString(data, "choice") as "yes" | "no",
          isExpert:   Boolean(data.isExpert),
          sbtType:    readString(data, "sbtType") as SBTType || undefined,
          timestamp:  readNumber(data, "timestamp"),
        });
      } catch { /* malformed */ }
    });
  } catch { /* no Gun */ }
  return () => { active = false; };
}

// ── SBT API ────────────────────────────────────────────────────────────────────

export function claimSBT(holder: SBTHolder): void {
  const existing = loadLocalSBTs().filter(h => h.nullifierHash !== holder.nullifierHash);
  localStorage.setItem(LS_SBT, JSON.stringify([...existing, holder]));
  try {
    getGun().get(NS_SBT).get(holder.nullifierHash).put({
      alias:         holder.alias,
      nullifierHash: holder.nullifierHash,
      sbtType:       holder.sbtType,
      claimedAt:     holder.claimedAt,
    });
  } catch { /* offline */ }
}

export function subscribeSBTs(onHolder: (h: SBTHolder) => void): () => void {
  let active = true;
  const seen = new Set<string>();
  try {
    getGun().get(NS_SBT).map().on((data) => {
      if (!active || !isRecord(data)) return;
      const nullifierHash = readString(data, "nullifierHash");
      if (!nullifierHash || seen.has(nullifierHash)) return;
      seen.add(nullifierHash);
      try {
        onHolder({
          alias:         readString(data, "alias"),
          nullifierHash,
          sbtType:       readString(data, "sbtType") as SBTType,
          claimedAt:     readNumber(data, "claimedAt"),
        });
      } catch { /* malformed */ }
    });
  } catch { /* no Gun */ }
  return () => { active = false; };
}

export function timeAgo(ts: number, language: "en" | "zh" = "zh"): string {
  const diff = Date.now() - ts;
  if (language === "en") {
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

export function daysLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));
}
