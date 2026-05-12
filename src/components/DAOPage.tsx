/**
 * 3.3 Support DAO — governance UI
 *
 * Tabs: 提案 (Proposals) · 专家委员会 (Expert Committee)
 * Treasury header always visible.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ThumbsUp, ThumbsDown, ShieldCheck, Loader2,
  CheckCircle2, Clock, Coins, ArrowLeft, ChevronRight,
  BadgeCheck, X, UploadCloud, FileCheck2, ChevronDown,
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
import { AppLanguage, copyFor } from "@/lib/locale";
import {
  THE_UNMUTED_DEPLOY_SIGNATURE,
  THE_UNMUTED_PROGRAM_AUTHORITY,
  THE_UNMUTED_PROGRAM_ID,
} from "@/lib/solanaProgram";
import {
  connectMagicBlockPrivateSession,
  MAGICBLOCK_TEE_RPC_URL,
  MAGICBLOCK_TEE_VALIDATOR_ID,
  type MagicBlockPrivateSession,
  type MagicBlockStep,
} from "@/lib/magicBlock";

// ── Types ──────────────────────────────────────────────────────────────────────

type InnerTab = "proposals" | "experts";
type Filter = "active" | "passed" | "funded";

const TABS = [
  { id: "proposals" as const, english: "Proposals", chinese: "提案投票" },
  { id: "experts" as const, english: "Experts", chinese: "专家委员会" },
] as const;

const SEED_PROPOSAL_COPY: Record<string, {
  titleEn: string;
  titleZh: string;
  descriptionEn: string;
  descriptionZh: string;
  aliasEn: string;
  aliasZh: string;
}> = {
  "seed-001": {
    titleEn: "Protection order legal assistance",
    titleZh: "骚扰令法律协助申请",
    descriptionEn: "Needs lawyer support to apply for a personal protection order. The harasser continues to stalk them, with repeated incidents already secured in the evidence vault. Requests DAO legal aid funding.",
    descriptionZh: "需要律师协助申请人身保护令。骚扰者持续跟踪，已有多次骚扰记录并在证据库存证。请求 DAO 提供法律援助资金。",
    aliasEn: "Silent Bluebird",
    aliasZh: "沉默蓝鸟",
  },
  "seed-002": {
    titleEn: "Post-trauma counseling support",
    titleZh: "创伤后心理康复支援",
    descriptionEn: "Seeking professional counseling after long-term domestic violence. Needs three months of recovery support and cannot cover the cost alone.",
    descriptionZh: "经历长期家暴后寻求专业心理咨询。需要持续 3 个月的康复疗程支持，无力独自承担费用。",
    aliasEn: "Distant Rose",
    aliasZh: "远山蔷薇",
  },
  "seed-003": {
    titleEn: "Create a community safety playbook",
    titleZh: "制定社区安全行动手册",
    descriptionEn: "Proposal to create a safety guide for community members, including response steps and resource lists for stalking or harassment.",
    descriptionZh: "提案建立一份面向社区成员的安全指南，包含遭遇跟踪、骚扰时的应对步骤与资源清单。",
    aliasEn: "Starlit Traveler",
    aliasZh: "星野旅人",
  },
};

const ALIAS_COPY: Record<string, { en: string; zh: string }> = {
  "沉默红枫": { en: "Silent Maple", zh: "沉默红枫" },
  "Silent Maple": { en: "Silent Maple", zh: "沉默红枫" },
  "远山蔷薇": { en: "Distant Rose", zh: "远山蔷薇" },
  "Distant Rose": { en: "Distant Rose", zh: "远山蔷薇" },
  "星野旅人": { en: "Starlit Traveler", zh: "星野旅人" },
  "Starlit Traveler": { en: "Starlit Traveler", zh: "星野旅人" },
};

function proposalTypeLabel(type: ProposalType | undefined, language: AppLanguage) {
  const config = PROPOSAL_TYPE_CONFIG.find(c => c.id === type);
  return config ? copyFor(language, config.labelEn, config.labelZh) : "";
}

function sbtLabel(type: SBTType | undefined, language: AppLanguage) {
  const config = SBT_TYPE_CONFIG.find(c => c.id === type);
  return config ? copyFor(language, config.labelEn, config.labelZh) : "";
}

function sbtDesc(type: SBTType | undefined, language: AppLanguage) {
  const config = SBT_TYPE_CONFIG.find(c => c.id === type);
  return config ? copyFor(language, config.descEn, config.descZh) : "";
}

function statusLabel(status: Proposal["status"], language: AppLanguage) {
  const labels = {
    active: copyFor(language, "Active", "进行中"),
    passed: copyFor(language, "Passed", "已通过"),
    rejected: copyFor(language, "Rejected", "未通过"),
    funded: copyFor(language, "Funded", "已拨付"),
  };
  return labels[status];
}

function daysLeftLabel(expiresAt: number, language: AppLanguage) {
  const days = daysLeft(expiresAt);
  return copyFor(language, `${days}d left`, `${days} 天剩余`);
}

function emptyProposalLabel(filter: Filter, language: AppLanguage) {
  if (filter === "active") return copyFor(language, "No active proposals", "暂无进行中的提案");
  if (filter === "passed") return copyFor(language, "No passed proposals", "暂无已通过的提案");
  return copyFor(language, "No funded proposals", "暂无已拨付的提案");
}

function proposalTitle(proposal: Proposal, language: AppLanguage) {
  const seedCopy = SEED_PROPOSAL_COPY[proposal.id];
  return language === "zh"
    ? proposal.titleZh ?? seedCopy?.titleZh ?? proposal.title
    : proposal.titleEn ?? seedCopy?.titleEn ?? proposal.title;
}

function proposalDescription(proposal: Proposal, language: AppLanguage) {
  const seedCopy = SEED_PROPOSAL_COPY[proposal.id];
  return language === "zh"
    ? proposal.descriptionZh ?? seedCopy?.descriptionZh ?? proposal.description
    : proposal.descriptionEn ?? seedCopy?.descriptionEn ?? proposal.description;
}

function proposalAlias(proposal: Proposal, language: AppLanguage) {
  const seedCopy = SEED_PROPOSAL_COPY[proposal.id];
  return language === "zh"
    ? proposal.proposerAliasZh ?? seedCopy?.aliasZh ?? ALIAS_COPY[proposal.proposerAlias]?.zh ?? proposal.proposerAlias
    : proposal.proposerAliasEn ?? seedCopy?.aliasEn ?? ALIAS_COPY[proposal.proposerAlias]?.en ?? proposal.proposerAlias;
}

function displayAlias(alias: string, language: AppLanguage) {
  const copy = ALIAS_COPY[alias];
  return copy ? copyFor(language, copy.en, copy.zh) : alias;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DAOPage({ language }: { language: AppLanguage }) {
  const [tab, setTab] = useState<InnerTab>("proposals");
  const zkp = useZKPIdentity();

  // Seed demo data on first mount
  useEffect(() => { seedDemoDataIfEmpty(); }, []);

  return (
    <div className="flex flex-1 flex-col">
      {/* Treasury header */}
      <TreasuryCard language={language} />
      <MagicBlockPrivacyCard language={language} />

      {/* Inner tabs */}
      <div className="flex shrink-0 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center py-3 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            <span>{copyFor(language, t.english, t.chinese)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "proposals" && (
            <Pane key="proposals">
              <ProposalsTab zkp={zkp} language={language} />
            </Pane>
          )}
          {tab === "experts" && (
            <Pane key="experts">
              <ExpertsTab zkp={zkp} language={language} />
            </Pane>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MagicBlockPrivacyCard({ language }: { language: AppLanguage }) {
  const [openNotice, setOpenNotice] = useState<"magicblock" | "solana" | null>(null);
  const [openMagicBlockDetail, setOpenMagicBlockDetail] = useState<"how" | "session" | null>(null);
  const [magicBlockStep, setMagicBlockStep] = useState<MagicBlockStep>("idle");
  const [magicBlockSession, setMagicBlockSession] = useState<MagicBlockPrivateSession | null>(null);
  const [magicBlockError, setMagicBlockError] = useState("");
  const pipeline = [
    {
      labelEn: "Delegate private review state",
      labelZh: "委托私密审核状态",
      valueEn: "PER session",
      valueZh: "PER 会话",
    },
    {
      labelEn: "TEE-gated expert access",
      labelZh: "TEE 限权专家访问",
      valueEn: "SBT reviewers",
      valueZh: "SBT 审核者",
    },
    {
      labelEn: "Commit public result only",
      labelZh: "仅提交公开结果",
      valueEn: "Solana settlement",
      valueZh: "Solana 结算",
    },
  ];
  const magicBlockBusy =
    magicBlockStep === "verifying" ||
    magicBlockStep === "signing" ||
    magicBlockStep === "connecting";
  const magicBlockStepLabel = {
    idle: copyFor(language, "Ready to connect", "可连接"),
    verifying: copyFor(language, "Verifying TEE RPC", "正在验证 TEE RPC"),
    signing: copyFor(language, "Waiting for Phantom signature", "等待 Phantom 签名"),
    connecting: copyFor(language, "Opening private session", "正在打开私密会话"),
    ready: copyFor(language, "Private session ready", "私密会话已就绪"),
    error: copyFor(language, "Connection failed", "连接失败"),
  }[magicBlockStep];

  const handleMagicBlockConnect = async () => {
    setMagicBlockError("");
    setOpenNotice("magicblock");
    try {
      const session = await connectMagicBlockPrivateSession(setMagicBlockStep);
      setMagicBlockSession(session);
      setMagicBlockStep("ready");
      toast.success(copyFor(
        language,
        "MagicBlock PER auth session is ready.",
        "MagicBlock PER 授权会话已就绪。"
      ));
    } catch (error) {
      setMagicBlockStep("error");
      setMagicBlockError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="mx-4 mb-3 grid gap-2">
      <TechNoticeButton
        icon={<ShieldCheck className="h-4 w-4" />}
        title={copyFor(language, "Private DAO review", "私密 DAO 审核")}
        label={copyFor(language, "Tap for MagicBlock privacy details", "点击查看 MagicBlock 隐私细节")}
        badge={magicBlockSession ? "TEE Ready" : "PER"}
        open={openNotice === "magicblock"}
        onClick={() => setOpenNotice(openNotice === "magicblock" ? null : "magicblock")}
      >
        <div className="rounded-2xl border border-primary/20 bg-primary/8 p-3">
          <div className="flex items-center gap-2">
            {magicBlockBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : magicBlockSession ? (
              <CheckCircle2 className="h-4 w-4 text-sos-success" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-foreground">{magicBlockStepLabel}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground">
                {copyFor(
                  language,
                  "Private review connection for sensitive DAO cases.",
                  "用于敏感 DAO 个案的私密审核连接。"
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMagicBlockConnect}
            disabled={magicBlockBusy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-55"
          >
            {magicBlockBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {magicBlockSession
              ? copyFor(language, "Refresh PER auth session", "刷新 PER 授权会话")
              : copyFor(language, "Connect MagicBlock PER", "连接 MagicBlock PER")}
          </button>
          {magicBlockError && (
            <p className="mt-2 rounded-xl border border-destructive/25 bg-destructive/8 px-3 py-2 text-[11px] leading-5 text-destructive">
              {magicBlockError}
            </p>
          )}
        </div>

        {magicBlockSession && (
          <MiniDisclosure
            title={copyFor(language, "PER session proof", "PER 会话证明")}
            open={openMagicBlockDetail === "session"}
            onToggle={() => setOpenMagicBlockDetail(openMagicBlockDetail === "session" ? null : "session")}
          >
            <div className="rounded-xl border border-sos-success/20 bg-sos-success/8 px-3 py-2 text-[11px] leading-5">
              <p className="font-bold text-sos-success">
                {copyFor(language, "Authenticated private endpoint is ready.", "已授权的私密端点已就绪。")}
              </p>
              <p className="mt-1 break-all text-muted-foreground">
                {copyFor(language, "Wallet", "钱包")}
                {": "}
                <span className="font-mono">{magicBlockSession.walletAddress}</span>
              </p>
              <p className="break-all text-muted-foreground">
                {copyFor(language, "TEE token", "TEE 令牌")}
                {": "}
                <span className="font-mono">{magicBlockSession.tokenPreview}</span>
              </p>
              <p className="text-muted-foreground">
                {copyFor(language, "Expires", "过期时间")}
                {": "}
                {new Date(magicBlockSession.expiresAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}
              </p>
              <p className="break-all text-muted-foreground">
                {copyFor(language, "TEE validator", "TEE 验证节点")}
                {": "}
                <span className="font-mono">{magicBlockSession.teeValidatorId}</span>
              </p>
            </div>
          </MiniDisclosure>
        )}

        <MiniDisclosure
          title={copyFor(language, "How privacy review works", "隐私审核如何运作")}
          open={openMagicBlockDetail === "how"}
          onToggle={() => setOpenMagicBlockDetail(openMagicBlockDetail === "how" ? null : "how")}
        >
          <p className="text-[11px] leading-5 text-muted-foreground">
            {copyFor(
              language,
              "Sensitive review can happen in a private temporary room. The public chain only needs the final proof, not every private detail.",
              "敏感审核可以先在临时私密空间中完成。公开链上只需要最终证明，不需要暴露每个隐私细节。"
            )}
          </p>
          <div className="grid gap-2">
            {pipeline.map((item, index) => (
              <div key={item.labelEn} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/55 px-3 py-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-black text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-foreground">{copyFor(language, item.labelEn, item.labelZh)}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{copyFor(language, item.valueEn, item.valueZh)}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-sos-success" />
              </div>
            ))}
          </div>
        </MiniDisclosure>
      </TechNoticeButton>

      <TechNoticeButton
        icon={<Coins className="h-4 w-4" />}
        title={copyFor(language, "Solana proof", "Solana 链上证明")}
        label={copyFor(language, "Tap to view program address", "点击查看程序地址")}
        badge="Devnet"
        open={openNotice === "solana"}
        onClick={() => setOpenNotice(openNotice === "solana" ? null : "solana")}
      >
        <div className="text-[11px] leading-5">
          <a
            href={`https://explorer.solana.com/address/${THE_UNMUTED_PROGRAM_ID}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="block break-all font-mono text-primary underline-offset-4 hover:underline"
          >
            {THE_UNMUTED_PROGRAM_ID}
          </a>
          <p className="mt-1 break-all text-muted-foreground">
            {copyFor(language, "Upgrade authority", "升级权限")}
            {": "}
            <span className="font-mono">{THE_UNMUTED_PROGRAM_AUTHORITY}</span>
          </p>
          <a
            href={`https://explorer.solana.com/tx/${THE_UNMUTED_DEPLOY_SIGNATURE}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {copyFor(language, "Deploy tx", "部署交易")}
            {": "}
            {THE_UNMUTED_DEPLOY_SIGNATURE}
          </a>
        </div>
      </TechNoticeButton>
    </div>
  );
}

function TechNoticeButton({
  icon,
  title,
  label,
  badge,
  open,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  label: string;
  badge?: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-card/80 shadow-[0_10px_28px_hsl(240_70%_4%/0.08)]">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-3 text-left active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-black text-foreground">{title}</span>
            {badge && (
              <span className="rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-primary">
                {badge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">{label}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border/70 px-3 pb-3 pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniDisclosure({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-muted-foreground"
      >
        <span>{title}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function TreasuryCard({ language }: { language: AppLanguage }) {
  const used  = TREASURY.total - TREASURY.legal - TREASURY.psych - TREASURY.ops + 300; // seed-001 funded
  const pct   = Math.round((used / TREASURY.total) * 100);

  return (
    <div className="mx-4 mt-4 mb-1 rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-semibold text-muted-foreground">
            {copyFor(language, "Community Treasury", "社区金库")}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {copyFor(language, "Solana · Transparent", "Solana · 透明可查")}
        </span>
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
          <span>{copyFor(language, `${pct}% used`, `已使用 ${pct}%`)}</span>
          <span>
            {copyFor(
              language,
              `${(TREASURY.total - used).toLocaleString()} ${TREASURY.symbol} left`,
              `剩余 ${(TREASURY.total - used).toLocaleString()} ${TREASURY.symbol}`
            )}
          </span>
        </div>
      </div>

      {/* Allocation breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: copyFor(language, "Legal aid", "法律援助"), amount: TREASURY.legal,  color: "bg-blue-400/20 text-blue-400" },
          { label: copyFor(language, "Mental health", "心理援助"), amount: TREASURY.psych,  color: "bg-purple-400/20 text-purple-400" },
          { label: copyFor(language, "Operations", "运营储备"), amount: TREASURY.ops,    color: "bg-emerald-400/20 text-emerald-400" },
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

function ProposalsTab({
  zkp,
  language,
}: {
  zkp: ReturnType<typeof useZKPIdentity>;
  language: AppLanguage;
}) {
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
        language={language}
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
            { id: "active" as Filter },
            { id: "passed" as Filter },
            { id: "funded" as Filter },
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
            {statusLabel(f.id, language)}
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
            <p className="text-sm">{emptyProposalLabel(filter, language)}</p>
          </div>
        )}
        {filtered.map(p => (
          <ProposalCard
            key={p.id}
            proposal={p}
            language={language}
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
        {copyFor(language, "Create proposal", "发起新提案")}
      </button>

      {/* Create sheet */}
      <AnimatePresence>
        {showCreate && (
          <CreateProposalSheet
            zkp={zkp}
            language={language}
            onClose={() => setShowCreate(false)}
            onCreate={(p) => {
              setProposals(prev => [p, ...prev]);
              setShowCreate(false);
              toast.success(copyFor(language, "Proposal submitted. Waiting for community vote.", "提案已提交，等待社区投票"));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Proposal card ──────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  language,
  onTap,
}: {
  proposal: Proposal;
  language: AppLanguage;
  onTap: () => void;
}) {
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
    active:  { label: statusLabel("active", language), cls: "bg-primary/15 text-primary" },
    passed:  { label: statusLabel("passed", language), cls: "bg-emerald-500/15 text-emerald-400" },
    rejected:{ label: statusLabel("rejected", language), cls: "bg-muted/50 text-muted-foreground" },
    funded:  { label: copyFor(language, "Funded ✓", "已拨付 ✓"), cls: "bg-yellow-400/15 text-yellow-400" },
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
            <span className={`text-xs font-semibold ${typeConfig.color}`}>{proposalTypeLabel(proposal.type, language)}</span>
            {proposal.amountRequested > 0 && (
              <span className="text-xs text-muted-foreground">· {proposal.amountRequested} {TREASURY.symbol}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-bold text-foreground leading-snug">{proposalTitle(proposal, language)}</p>
          <p className="text-[11px] text-muted-foreground">{proposalAlias(proposal, language)} · {timeAgo(proposal.createdAt, language)}</p>
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
              <BadgeCheck className="h-3 w-3" />
              {copyFor(language, `${stats.expertYes} expert endorsements`, `${stats.expertYes} 专家背书`)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {proposal.status === "active" ? daysLeftLabel(proposal.expiresAt, language) : copyFor(language, "Ended", "已结束")}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {proposal.evidenceHash && (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {copyFor(language, "Evidence hash", "证据哈希")}: {proposal.evidenceHash.slice(0, 14)}…
          </span>
        )}
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

// ── Proposal detail + voting ───────────────────────────────────────────────────

function ProposalDetail({
  proposal, zkp, language, onBack,
}: {
  proposal: Proposal;
  zkp: ReturnType<typeof useZKPIdentity>;
  language: AppLanguage;
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
      toast(copyFor(language, "Create an anonymous identity in Circle first.", "请先在「互助」标签生成匿名身份"));
      return;
    }
    setVoting(true);
    try {
      const voterHash = await hashNullifier(zkp.identity.nullifier);
      if (hasVoted(proposal.id, voterHash)) {
        toast(copyFor(language, "You already voted.", "你已投过票"));
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
      toast.success(choice === "yes"
        ? copyFor(language, "✅ Support vote submitted", "✅ 已投支持票")
        : copyFor(language, "Oppose vote submitted", "已投反对票"));
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
          <p className="truncate text-sm font-bold text-foreground">{proposalTitle(proposal, language)}</p>
          <p className="text-[11px] text-muted-foreground">{proposalTypeLabel(proposal.type, language)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Status + meta */}
        <div className="flex flex-wrap gap-2">
          {proposal.status === "active" && (
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              <Clock className="h-3 w-3" /> {daysLeftLabel(proposal.expiresAt, language)}
            </span>
          )}
          {proposal.status === "passed" && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
              {copyFor(language, "✓ Passed", "✓ 已通过")}
            </span>
          )}
          {proposal.status === "funded" && (
            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-400">
              {copyFor(
                language,
                `✓ Funded ${proposal.amountRequested} ${TREASURY.symbol}`,
                `✓ 已拨付 ${proposal.amountRequested} ${TREASURY.symbol}`
              )}
            </span>
          )}
          {proposal.amountRequested > 0 && proposal.status === "active" && (
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              {copyFor(
                language,
                `Requesting ${proposal.amountRequested} ${TREASURY.symbol}`,
                `请求 ${proposal.amountRequested} ${TREASURY.symbol}`
              )}
            </span>
          )}
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            {proposalAlias(proposal, language)}
          </span>
        </div>

        {/* Description */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {copyFor(language, "Proposal Details", "提案详情")}
          </p>
          <p className="text-sm text-foreground leading-relaxed">{proposalDescription(proposal, language)}</p>
        </div>

        {/* Evidence hash */}
        {proposal.evidenceHash && (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {copyFor(language, "Linked evidence hash", "关联证据哈希")}
            </p>
            <p className="font-mono text-xs text-foreground break-all">{proposal.evidenceHash}</p>
            <p className="text-[10px] text-muted-foreground">
              {copyFor(
                language,
                "Evidence is encrypted on Arweave and timestamped on Solana.",
                "证据已加密存储于 Arweave + Solana 链上存证"
              )}
            </p>
          </div>
        )}

        {/* Vote stats */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {copyFor(language, "Current votes", "当前票数")}
          </p>

          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              {copyFor(language, "No votes yet", "尚无投票")}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-right text-xs font-bold text-emerald-400">
                    {copyFor(language, `Yes ${stats.yes}`, `支持 ${stats.yes}`)}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${yPct}%` }} />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">{yPct}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-right text-xs font-bold text-primary">
                    {copyFor(language, `No ${stats.no}`, `反对 ${stats.no}`)}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${100 - yPct}%` }} />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">{100 - yPct}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                {stats.expertYes > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {copyFor(language, `${stats.expertYes} expert endorsements`, `${stats.expertYes} 位专家背书`)}
                  </span>
                )}
                <span className="ml-auto">{copyFor(language, `${stats.total} total votes`, `共 ${stats.total} 票`)}</span>
              </div>

              {/* Pass threshold hint */}
              <div className={`rounded-xl px-3 py-2 text-[11px] ${
                stats.isPassed
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-border/50 text-muted-foreground"
              }`}>
                {stats.isPassed
                  ? copyFor(language, "✓ Passing threshold met (>=60% support + >=1 expert endorsement)", "✓ 已达通过门槛（≥60% 支持 + ≥1 专家背书）")
                  : copyFor(
                      language,
                      `Passing needs >=60% support (currently ${yPct}%) and >=1 expert endorsement (currently ${stats.expertYes}).`,
                      `通过条件：≥60% 支持票（当前 ${yPct}%）且 ≥1 专家背书（当前 ${stats.expertYes}）`
                    )}
              </div>
            </>
          )}
        </div>

        {/* Voting buttons */}
        {proposal.status === "active" && (
          <div className="space-y-2">
            {alreadyVoted ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                {copyFor(language, "You already voted", "你已参与投票")}
              </div>
            ) : !zkp.identity ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
                {copyFor(
                  language,
                  "Sign up or sign in before voting.",
                  "请先完成注册或登录，才能参与投票"
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote("yes")}
                  disabled={voting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 py-3.5 text-sm font-bold text-emerald-400 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  {copyFor(language, "Support", "支持")}
                </button>
                <button
                  onClick={() => handleVote("no")}
                  disabled={voting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-card border border-border py-3.5 text-sm font-bold text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
                >
                  {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                  {copyFor(language, "Oppose", "反对")}
                </button>
              </div>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              {copyFor(language, "Votes use ZKP anonymous credentials. Your identity is never public.", "投票通过 ZKP 匿名凭证，身份不会被公开")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create proposal sheet ──────────────────────────────────────────────────────

function CreateProposalSheet({
  zkp, language, onClose, onCreate,
}: {
  zkp: ReturnType<typeof useZKPIdentity>;
  language: AppLanguage;
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
    if (!title.trim() || !desc.trim()) {
      toast(copyFor(language, "Please fill in the title and description.", "请填写标题和描述"));
      return;
    }
    if (!zkp.identity) {
      toast(copyFor(language, "Sign up or sign in before creating a proposal.", "请先完成注册或登录后再发起提案。"));
      return;
    }
    setSubmitting(true);
    try {
      const p = createProposal(
        type,
        title.trim(),
        desc.trim(),
        zkp.alias ?? copyFor(language, "Anonymous user", "匿名用户"),
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
          <h3 className="font-bold text-foreground">
            {copyFor(language, "Create Proposal", "发起提案")}
          </h3>
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
              {proposalTypeLabel(c.id, language)}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={copyFor(language, "Proposal title", "提案标题")}
          maxLength={60}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />

        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder={copyFor(language, "Describe your need and background in detail", "详细描述你的需求和背景（50字以上）")}
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
        />

        {type !== "community" && (
          <div className="flex gap-3">
            <input
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder={copyFor(language, "Requested amount (USDC)", "请求金额（USDC）")}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>
        )}

        <input
          value={evHash}
          onChange={e => setEvHash(e.target.value)}
          placeholder={copyFor(language, "Linked evidence hash (optional, from vault)", "关联证据哈希（可选，来自证据库）")}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />

        {!zkp.identity && (
          <p className="text-center text-xs text-primary">
            {copyFor(language, "Sign up or sign in before submitting.", "请先完成注册或登录后再提交。")}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !desc.trim() || !zkp.identity}
          className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : copyFor(language, "Submit proposal", "提交提案")}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Experts Tab ────────────────────────────────────────────────────────────────

function ExpertsTab({
  zkp,
  language,
}: {
  zkp: ReturnType<typeof useZKPIdentity>;
  language: AppLanguage;
}) {
  const [holders,      setHolders]      = useState<SBTHolder[]>(() => loadLocalSBTs());
  const [claiming,     setClaiming]     = useState(false);
  const [sbtType,      setSbtType]      = useState<SBTType>("lawyer");
  const [myNullHash,   setMyNullHash]   = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [issuerName,   setIssuerName]   = useState("");
  const [credentialNote, setCredentialNote] = useState("");
  const [showMagicBlockClaim, setShowMagicBlockClaim] = useState(false);

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
      toast(copyFor(language, "Sign in before claiming a professional SBT.", "请先登录后再认领专业 SBT")); return;
    }
    if (!certFileName) {
      toast(copyFor(language, "Upload a certification file for demo review first.", "请先上传认证材料用于演示审核")); return;
    }
    setClaiming(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 650));
      const holder: SBTHolder = {
        alias:         zkp.alias ?? copyFor(language, "Anonymous expert", "匿名专家"),
        nullifierHash: myNullHash,
        sbtType,
        claimedAt:     Date.now(),
      };
      claimSBT(holder);
      setHolders(prev => [...prev.filter(h => h.nullifierHash !== myNullHash), holder]);
      toast.success(copyFor(
        language,
        `Certification uploaded. ${sbtLabel(sbtType, language)} SBT claimed.`,
        `认证材料已上传，${sbtLabel(sbtType, language)} SBT 已认领。`
      ));
      setCertFileName("");
      setCredentialId("");
      setIssuerName("");
      setCredentialNote("");
    } finally { setClaiming(false); }
  };

  return (
    <div className="flex flex-1 flex-col px-4 py-3 space-y-4">
      {/* Info card */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-bold text-foreground">
            {copyFor(language, "Professional SBT Verification", "SBT 专业认证")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {copyFor(
            language,
            "Professionals can claim soulbound tokens (SBTs). Their votes count as expert endorsements. SBTs are non-transferable and bound to anonymous identity for authenticity.",
            "专业人士认领灵魂绑定代币（SBT）后，其投票具有「专家背书」效力。SBT 不可转让，与匿名身份绑定，确保真实性。"
          )}
        </p>
      </div>

      {/* Expert list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {copyFor(language, `Committee members (${holders.length})`, `当前委员会成员 (${holders.length})`)}
        </p>
        {holders.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {copyFor(language, "No expert members yet", "暂无专家成员")}
          </p>
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
                  {displayAlias(h.alias, language)}
                  {isMe && (
                    <span className="ml-2 text-[10px] font-semibold text-primary">
                      {copyFor(language, "(you)", "（你）")}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{sbtLabel(h.sbtType, language) || config?.label || h.sbtType}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-0.5">
                  <ShieldCheck className="h-3 w-3 text-yellow-400" />
                  <span className="text-[10px] font-bold text-yellow-400">
                    {copyFor(language, "Verified", "已认证")}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{timeAgo(h.claimedAt, language)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claim section */}
      {!alreadyHolding && (
        <div className="rounded-[1.6rem] border border-dashed border-primary/30 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--card)))] p-4 shadow-[0_14px_34px_hsl(240_70%_4%/0.12)] space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">
                {copyFor(language, "Professional SBT Claim", "专业 SBT 认领")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copyFor(
                  language,
                  "Upload a license, certificate, or proof of service for a demo verification review. This is front-end only for the hackathon demo.",
                  "上传执照、证书或服务经验证明，进入演示版认证审核。本功能目前仅用于黑客松前端演示。"
                )}
              </p>
            </div>
          </div>

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
                    {sbtLabel(c.id, language)}
                  </p>
                  <p className="text-xs text-muted-foreground">{sbtDesc(c.id, language)}</p>
                </div>
                {sbtType === c.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-card/85 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                  {copyFor(language, "Certification Upload", "认证材料上传")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copyFor(language, "PDF, PNG, JPG accepted for the demo.", "演示支持 PDF、PNG、JPG。")}
                </p>
              </div>
              {certFileName && <FileCheck2 className="h-5 w-5 shrink-0 text-sos-success" />}
            </div>

            <input
              id="dao-cert-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(event) => setCertFileName(event.target.files?.[0]?.name ?? "")}
            />
            <label
              htmlFor="dao-cert-upload"
              className="flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/6 px-4 py-4 text-center transition-transform active:scale-[0.98]"
            >
              {certFileName ? (
                <>
                  <FileCheck2 className="h-6 w-6 text-sos-success" />
                  <span className="mt-2 max-w-full truncate text-sm font-bold text-foreground">{certFileName}</span>
                  <span className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    {copyFor(language, "Tap to replace file", "点击更换文件")}
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6 text-primary" />
                  <span className="mt-2 text-sm font-bold text-foreground">
                    {copyFor(language, "Upload certification", "上传认证材料")}
                  </span>
                  <span className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    {copyFor(language, "License, certificate, or organization letter", "执照、证书或机构证明")}
                  </span>
                </>
              )}
            </label>

            <div className="grid gap-2">
              <input
                value={issuerName}
                onChange={e => setIssuerName(e.target.value)}
                placeholder={copyFor(language, "Issuing organization (optional)", "发证机构（可选）")}
                className="w-full rounded-xl border border-border bg-background/75 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              <input
                value={credentialId}
                onChange={e => setCredentialId(e.target.value)}
                placeholder={copyFor(language, "License / certificate ID (optional)", "执照 / 证书编号（可选）")}
                className="w-full rounded-xl border border-border bg-background/75 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              <textarea
                value={credentialNote}
                onChange={e => setCredentialNote(e.target.value)}
                rows={3}
                placeholder={copyFor(language, "Short professional background note (optional)", "专业背景补充说明（可选）")}
                className="w-full resize-none rounded-xl border border-border bg-background/75 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="rounded-xl bg-primary/8 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              {copyFor(
                language,
                "Demo privacy note: this upload is not sent to a backend yet. In production, it should be reviewed by trusted DAO verifiers before the SBT is issued.",
                "演示隐私提示：当前上传不会发送到后端。正式版本中，应由可信 DAO 审核者确认后再发放 SBT。"
              )}
            </div>

            <div className="rounded-xl border border-primary/20 bg-background/45">
              <button
                type="button"
                onClick={() => setShowMagicBlockClaim((current) => !current)}
                aria-expanded={showMagicBlockClaim}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-primary"
              >
                <span>{copyFor(language, "MagicBlock privacy note", "MagicBlock 隐私说明")}</span>
                <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${showMagicBlockClaim ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {showMagicBlockClaim && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden px-3 pb-3 text-[11px] leading-5 text-muted-foreground"
                  >
                    {copyFor(
                      language,
                      "This demo marks the certification packet as delegated to a Private Ephemeral Rollup review room, so only approved DAO verifiers would inspect private documents while the public chain receives the final SBT result.",
                      "本 Demo 将认证包标记为委托到 Private Ephemeral Rollup 审核室：只有授权 DAO 审核者查看私密材料，公开链上只接收最终 SBT 结果。"
                    )}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {!zkp.identity ? (
            <p className="text-center text-xs text-primary">
              {copyFor(language, "Sign in first to continue the SBT claim.", "请先登录后继续认领 SBT。")}
            </p>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming || !certFileName}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-95 transition-transform"
            >
              {claiming
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <BadgeCheck className="h-4 w-4" />}
              {copyFor(language, "Submit certification and claim SBT", "提交认证并认领 SBT")}
            </button>
          )}
        </div>
      )}

      {alreadyHolding && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/8 p-4 text-center space-y-1">
          <BadgeCheck className="mx-auto h-6 w-6 text-yellow-400" />
          <p className="text-sm font-bold text-foreground">
            {copyFor(language, "You already hold a professional SBT", "你已持有专业 SBT")}
          </p>
          <p className="text-xs text-muted-foreground">
            {copyFor(language, "Your votes will be marked as expert endorsements.", "你的投票将被标记为专家背书")}
          </p>
        </div>
      )}
    </div>
  );
}
