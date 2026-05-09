/**
 * 3.3 Support DAO — governance UI
 *
 * Tabs: 提案 (Proposals) · 专家委员会 (Expert Committee)
 * Treasury header always visible.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ThumbsUp, ThumbsDown, ShieldCheck, Loader2,
  CheckCircle2, Clock, Coins, ArrowLeft, ChevronRight,
  BadgeCheck, X,
} from "lucide-react";
import { toast } from "sonner";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import {
  PROPOSAL_TYPE_CONFIG, SBT_TYPE_CONFIG, TREASURY,
  type Proposal, type ProposalType, type VoteRecord, type SBTHolder, type SBTType,
  seedDemoDataIfEmpty,
  loadLocalProposals, createProposal, subscribeProposals,
  loadLocalVotes, castVote, subscribeProposalVotes,
  loadLocalSBTs, claimSBT, subscribeSBTs,
  computeVoteStats, hasVoted, hashNullifier,
  timeAgo, daysLeft,
} from "@/lib/daoGovernance";

// ── Types ──────────────────────────────────────────────────────────────────────

type InnerTab = "proposals" | "experts";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DAOPage() {
  const [tab, setTab] = useState<InnerTab>("proposals");
  const zkp = useZKPIdentity();

  // Seed demo data on first mount
  useEffect(() => { seedDemoDataIfEmpty(); }, []);

  return (
    <div className="flex flex-1 flex-col">
      {/* Treasury header */}
      <TreasuryCard />

      {/* Inner tabs */}
      <div className="flex shrink-0 border-b border-border">
        {(
          [
            { id: "proposals" as const, label: "提案投票" },
            { id: "experts"   as const, label: "专家委员会" },
          ] as const
        ).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center py-3 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "proposals" && (
            <Pane key="proposals">
              <ProposalsTab zkp={zkp} />
            </Pane>
          )}
          {tab === "experts" && (
            <Pane key="experts">
              <ExpertsTab zkp={zkp} />
            </Pane>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

// ── Treasury card ──────────────────────────────────────────────────────────────

function TreasuryCard() {
  const used  = TREASURY.total - TREASURY.legal - TREASURY.psych - TREASURY.ops + 300; // seed-001 funded
  const pct   = Math.round((used / TREASURY.total) * 100);

  return (
    <div className="mx-4 mt-4 mb-1 rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-semibold text-muted-foreground">社区金库</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Solana · 透明可查</span>
      </div>

      <div>
        <span className="text-2xl font-black text-foreground">
          {TREASURY.total.toLocaleString()}
        </span>
        <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{TREASURY.symbol}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>已使用 {pct}%</span>
          <span>剩余 {(TREASURY.total - used).toLocaleString()} {TREASURY.symbol}</span>
        </div>
      </div>

      {/* Allocation breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "法律援助", amount: TREASURY.legal,  color: "bg-blue-400/20 text-blue-400" },
          { label: "心理援助", amount: TREASURY.psych,  color: "bg-purple-400/20 text-purple-400" },
          { label: "运营储备", amount: TREASURY.ops,    color: "bg-emerald-400/20 text-emerald-400" },
        ].map(item => (
          <div key={item.label} className="rounded-xl bg-card/50 border border-border px-2.5 py-2 text-center">
            <p className={`text-xs font-bold ${item.color.split(" ")[1]}`}>{item.amount}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Proposals Tab ──────────────────────────────────────────────────────────────

type Filter = "active" | "passed" | "funded";

function ProposalsTab({ zkp }: { zkp: ReturnType<typeof useZKPIdentity> }) {
  const [proposals,  setProposals]  = useState<Proposal[]>(() => loadLocalProposals());
  const [filter,     setFilter]     = useState<Filter>("active");
  const [detail,     setDetail]     = useState<Proposal | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Merge in Gun.js proposals without duplicates
  useEffect(() => {
    return subscribeProposals((p: Proposal) => {
      setProposals(prev => {
        if (prev.some(x => x.id === p.id)) return prev;
        return [p, ...prev];
      });
    });
  }, []);

  const filtered = proposals.filter(p => {
    if (filter === "active") return p.status === "active";
    if (filter === "passed") return p.status === "passed";
    if (filter === "funded") return p.status === "funded";
    return true;
  });

  if (detail) {
    return (
      <ProposalDetail
        proposal={detail}
        zkp={zkp}
        onBack={() => setDetail(null)}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-3 space-y-3">
      {/* Filter chips */}
      <div className="flex gap-2">
        {(
          [
            { id: "active" as Filter, label: "进行中" },
            { id: "passed" as Filter, label: "已通过" },
            { id: "funded" as Filter, label: "已拨付" },
          ]
        ).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {f.label}
            {f.id === "active" && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                {proposals.filter(p => p.status === "active").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Proposal list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <p className="text-sm">暂无{filter === "active" ? "进行中的" : filter === "passed" ? "已通过的" : "已拨付的"}提案</p>
          </div>
        )}
        {filtered.map(p => (
          <ProposalCard
            key={p.id}
            proposal={p}
            onTap={() => setDetail(p)}
          />
        ))}
      </div>

      {/* Create button */}
      <button
        onClick={() => setShowCreate(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-3.5 text-sm font-semibold text-primary active:scale-[0.98] transition-transform"
      >
        <Plus className="h-4 w-4" />
        发起新提案
      </button>

      {/* Create sheet */}
      <AnimatePresence>
        {showCreate && (
          <CreateProposalSheet
            zkp={zkp}
            onClose={() => setShowCreate(false)}
            onCreate={(p) => {
              setProposals(prev => [p, ...prev]);
              setShowCreate(false);
              toast.success("提案已提交，等待社区投票");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Proposal card ──────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onTap }: { proposal: Proposal; onTap: () => void }) {
  const [votes, setVotes] = useState<VoteRecord[]>(() => loadLocalVotes(proposal.id));
  const typeConfig = PROPOSAL_TYPE_CONFIG.find(c => c.id === proposal.type)!;
  const stats      = computeVoteStats(votes);

  useEffect(() => {
    return subscribeProposalVotes(proposal.id, (v) => {
      setVotes(prev => {
        const map = new Map(prev.map(x => [x.voterHash, x]));
        map.set(v.voterHash, v);
        return Array.from(map.values());
      });
    });
  }, [proposal.id]);

  const statusBadge: Record<string, { label: string; cls: string }> = {
    active:  { label: "进行中",   cls: "bg-primary/15 text-primary" },
    passed:  { label: "已通过",   cls: "bg-emerald-500/15 text-emerald-400" },
    rejected:{ label: "未通过",   cls: "bg-muted/50 text-muted-foreground" },
    funded:  { label: "已拨付 ✓", cls: "bg-yellow-400/15 text-yellow-400" },
  };
  const badge = statusBadge[proposal.status] ?? statusBadge.active;

  return (
    <button
      onClick={onTap}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left space-y-3 active:scale-[0.98] transition-transform"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold ${typeConfig.color}`}>{typeConfig.label}</span>
            {proposal.amountRequested > 0 && (
              <span className="text-xs text-muted-foreground">· {proposal.amountRequested} {TREASURY.symbol}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-bold text-foreground leading-snug">{proposal.title}</p>
          <p className="text-[11px] text-muted-foreground">{proposal.proposerAlias} · {timeAgo(proposal.createdAt)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Vote bar */}
      <div className="space-y-1.5">
        {stats.total > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((stats.yes / stats.total) * 100)}%` }}
            />
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-emerald-400">
            <ThumbsUp className="h-3 w-3" />{stats.yes}
          </span>
          <span className="flex items-center gap-1 text-primary">
            <ThumbsDown className="h-3 w-3" />{stats.no}
          </span>
          {stats.expertYes > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <BadgeCheck className="h-3 w-3" />{stats.expertYes} 专家背书
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {proposal.status === "active" ? `${daysLeft(proposal.expiresAt)} 天剩余` : "已结束"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {proposal.evidenceHash && (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            证据哈希: {proposal.evidenceHash.slice(0, 14)}…
          </span>
        )}
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

// ── Proposal detail + voting ───────────────────────────────────────────────────

function ProposalDetail({
  proposal, zkp, onBack,
}: {
  proposal: Proposal;
  zkp: ReturnType<typeof useZKPIdentity>;
  onBack: () => void;
}) {
  const [votes,      setVotes]      = useState<VoteRecord[]>(() => loadLocalVotes(proposal.id));
  const [voting,     setVoting]     = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const typeConfig = PROPOSAL_TYPE_CONFIG.find(c => c.id === proposal.type)!;
  const stats      = computeVoteStats(votes);

  // Subscribe to live votes
  useEffect(() => {
    return subscribeProposalVotes(proposal.id, (v) => {
      setVotes(prev => {
        const map = new Map(prev.map(x => [x.voterHash, x]));
        map.set(v.voterHash, v);
        return Array.from(map.values());
      });
    });
  }, [proposal.id]);

  // Check if user already voted
  useEffect(() => {
    if (!zkp.identity) return;
    hashNullifier(zkp.identity.nullifier).then(h => {
      setAlreadyVoted(hasVoted(proposal.id, h));
    });
  }, [zkp.identity, proposal.id]);

  const handleVote = async (choice: "yes" | "no") => {
    if (!zkp.identity) {
      toast("请先在「互助」标签生成匿名身份");
      return;
    }
    setVoting(true);
    try {
      const voterHash = await hashNullifier(zkp.identity.nullifier);
      if (hasVoted(proposal.id, voterHash)) {
        toast("你已投过票");
        return;
      }
      // Check if user holds SBT
      const sbts     = loadLocalSBTs();
      const myHash   = await hashNullifier(zkp.identity.nullifier);
      const mySBT    = sbts.find(s => s.nullifierHash === myHash);
      const vote: VoteRecord = {
        proposalId: proposal.id,
        voterHash,
        choice,
        isExpert:  Boolean(mySBT),
        sbtType:   mySBT?.sbtType,
        timestamp: Date.now(),
      };
      castVote(vote);
      setVotes(prev => {
        const map = new Map(prev.map(x => [x.voterHash, x]));
        map.set(voterHash, vote);
        return Array.from(map.values());
      });
      setAlreadyVoted(true);
      toast.success(choice === "yes" ? "✅ 已投支持票" : "已投反对票");
    } finally { setVoting(false); }
  };

  const yPct  = stats.total > 0 ? Math.round((stats.yes / stats.total) * 100) : 0;

  return (
    <div className="flex flex-1 flex-col">
      {/* Back header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-lg">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{proposal.title}</p>
          <p className="text-[11px] text-muted-foreground">{typeConfig.label}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Status + meta */}
        <div className="flex flex-wrap gap-2">
          {proposal.status === "active" && (
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              <Clock className="h-3 w-3" /> {daysLeft(proposal.expiresAt)} 天剩余
            </span>
          )}
          {proposal.status === "passed" && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
              ✓ 已通过
            </span>
          )}
          {proposal.status === "funded" && (
            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-400">
              ✓ 已拨付 {proposal.amountRequested} {TREASURY.symbol}
            </span>
          )}
          {proposal.amountRequested > 0 && proposal.status === "active" && (
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              请求 {proposal.amountRequested} {TREASURY.symbol}
            </span>
          )}
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            {proposal.proposerAlias}
          </span>
        </div>

        {/* Description */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">提案详情</p>
          <p className="text-sm text-foreground leading-relaxed">{proposal.description}</p>
        </div>

        {/* Evidence hash */}
        {proposal.evidenceHash && (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">关联证据哈希</p>
            <p className="font-mono text-xs text-foreground break-all">{proposal.evidenceHash}</p>
            <p className="text-[10px] text-muted-foreground">证据已加密存储于 Arweave + Solana 链上存证</p>
          </div>
        )}

        {/* Vote stats */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">当前票数</p>

          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">尚无投票</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-right text-xs font-bold text-emerald-400">支持 {stats.yes}</span>
                  <div className="flex-1 h-3 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${yPct}%` }} />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">{yPct}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-right text-xs font-bold text-primary">反对 {stats.no}</span>
                  <div className="flex-1 h-3 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${100 - yPct}%` }} />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">{100 - yPct}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                {stats.expertYes > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <BadgeCheck className="h-3.5 w-3.5" />{stats.expertYes} 位专家背书
                  </span>
                )}
                <span className="ml-auto">共 {stats.total} 票</span>
              </div>

              {/* Pass threshold hint */}
              <div className={`rounded-xl px-3 py-2 text-[11px] ${
                stats.isPassed
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-border/50 text-muted-foreground"
              }`}>
                {stats.isPassed
                  ? "✓ 已达通过门槛（≥60% 支持 + ≥1 专家背书）"
                  : `通过条件：≥60% 支持票（当前 ${yPct}%）且 ≥1 专家背书（当前 ${stats.expertYes}）`}
              </div>
            </>
          )}
        </div>

        {/* Voting buttons */}
        {proposal.status === "active" && (
          <div className="space-y-2">
            {alreadyVoted ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />你已参与投票
              </div>
            ) : !zkp.identity ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                请先前往「互助 → 身份」标签生成匿名身份，才能参与投票
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote("yes")}
                  disabled={voting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 py-3.5 text-sm font-bold text-emerald-400 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  支持
                </button>
                <button
                  onClick={() => handleVote("no")}
                  disabled={voting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-card border border-border py-3.5 text-sm font-bold text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
                >
                  {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                  反对
                </button>
              </div>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              🔒 投票通过 ZKP 匿名凭证，身份不会被公开
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create proposal sheet ──────────────────────────────────────────────────────

function CreateProposalSheet({
  zkp, onClose, onCreate,
}: {
  zkp: ReturnType<typeof useZKPIdentity>;
  onClose: () => void;
  onCreate: (p: Proposal) => void;
}) {
  const [type,     setType]     = useState<ProposalType>("legal");
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [amount,   setAmount]   = useState("");
  const [evHash,   setEvHash]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !desc.trim()) { toast("请填写标题和描述"); return; }
    if (!zkp.identity) { toast("请先生成匿名身份（互助 → 身份）"); return; }
    setSubmitting(true);
    try {
      const p = createProposal(
        type,
        title.trim(),
        desc.trim(),
        zkp.alias ?? "匿名用户",
        Number(amount) || 0,
        evHash.trim() || undefined
      );
      onCreate(p);
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="rounded-t-3xl bg-background border-t border-border px-4 pb-8 pt-4 space-y-4"
        style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}
      >
        {/* Handle */}
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />

        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">发起提案</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {/* Type picker */}
        <div className="grid grid-cols-3 gap-2">
          {PROPOSAL_TYPE_CONFIG.map(c => (
            <button
              key={c.id}
              onClick={() => setType(c.id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-xs font-semibold transition-all active:scale-95 ${
                type === c.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className="text-xl">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="提案标题"
          maxLength={60}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />

        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="详细描述你的需求和背景（50字以上）"
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
        />

        {type !== "community" && (
          <div className="flex gap-3">
            <input
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="请求金额（USDC）"
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>
        )}

        <input
          value={evHash}
          onChange={e => setEvHash(e.target.value)}
          placeholder="关联证据哈希（可选，来自证据库）"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />

        {!zkp.identity && (
          <p className="text-center text-xs text-primary">
            ⚠️ 需要匿名身份才能提交。请先前往「互助 → 身份」标签。
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !desc.trim() || !zkp.identity}
          className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "提交提案"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Experts Tab ────────────────────────────────────────────────────────────────

function ExpertsTab({ zkp }: { zkp: ReturnType<typeof useZKPIdentity> }) {
  const [holders,      setHolders]      = useState<SBTHolder[]>(() => loadLocalSBTs());
  const [claiming,     setClaiming]     = useState(false);
  const [sbtType,      setSbtType]      = useState<SBTType>("lawyer");
  const [myNullHash,   setMyNullHash]   = useState<string | null>(null);

  useEffect(() => {
    return subscribeSBTs((h) => {
      setHolders(prev => {
        if (prev.some(x => x.nullifierHash === h.nullifierHash)) return prev;
        return [...prev, h];
      });
    });
  }, []);

  useEffect(() => {
    if (!zkp.identity) return;
    hashNullifier(zkp.identity.nullifier).then(setMyNullHash);
  }, [zkp.identity]);

  const alreadyHolding = myNullHash
    ? holders.some(h => h.nullifierHash === myNullHash)
    : false;

  const handleClaim = async () => {
    if (!zkp.identity || !myNullHash) {
      toast("请先生成匿名身份"); return;
    }
    setClaiming(true);
    try {
      const holder: SBTHolder = {
        alias:         zkp.alias ?? "匿名专家",
        nullifierHash: myNullHash,
        sbtType,
        claimedAt:     Date.now(),
      };
      claimSBT(holder);
      setHolders(prev => [...prev.filter(h => h.nullifierHash !== myNullHash), holder]);
      toast.success(`✅ ${SBT_TYPE_CONFIG.find(s => s.id === sbtType)?.label} SBT 已认领`);
    } finally { setClaiming(false); }
  };

  return (
    <div className="flex flex-1 flex-col px-4 py-3 space-y-4">
      {/* Info card */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-bold text-foreground">SBT 专业认证</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          专业人士认领灵魂绑定代币（SBT）后，其投票具有「专家背书」效力。
          SBT 不可转让，与匿名身份绑定，确保真实性。
        </p>
      </div>

      {/* Expert list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">当前委员会成员 ({holders.length})</p>
        {holders.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无专家成员</p>
        )}
        {holders.map((h) => {
          const config = SBT_TYPE_CONFIG.find(s => s.id === h.sbtType)!;
          const isMe   = h.nullifierHash === myNullHash;
          return (
            <div
              key={h.nullifierHash}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="text-2xl">{config?.icon ?? "🎖️"}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">
                  {h.alias}
                  {isMe && (
                    <span className="ml-2 text-[10px] font-semibold text-primary">（你）</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{config?.label ?? h.sbtType}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-0.5">
                  <ShieldCheck className="h-3 w-3 text-yellow-400" />
                  <span className="text-[10px] font-bold text-yellow-400">已认证</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{timeAgo(h.claimedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claim section */}
      {!alreadyHolding && (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">认领你的专业 SBT</p>
          <p className="text-xs text-muted-foreground">
            持有律师执照、心理咨询证书或在相关领域有丰富经验的成员均可申请。
            SBT 与你的匿名承诺绑定，不泄露真实身份。
          </p>

          <div className="grid gap-2">
            {SBT_TYPE_CONFIG.map(c => (
              <button
                key={c.id}
                onClick={() => setSbtType(c.id)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
                  sbtType === c.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span className="text-xl">{c.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${sbtType === c.id ? "text-primary" : "text-foreground"}`}>
                    {c.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
                {sbtType === c.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>

          {!zkp.identity ? (
            <p className="text-center text-xs text-primary">
              需要先生成匿名身份（互助 → 身份）
            </p>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-95 transition-transform"
            >
              {claiming
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <BadgeCheck className="h-4 w-4" />}
              认领 SBT
            </button>
          )}
        </div>
      )}

      {alreadyHolding && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/8 p-4 text-center space-y-1">
          <BadgeCheck className="mx-auto h-6 w-6 text-yellow-400" />
          <p className="text-sm font-bold text-foreground">你已持有专业 SBT</p>
          <p className="text-xs text-muted-foreground">你的投票将被标记为专家背书</p>
        </div>
      )}
    </div>
  );
}
