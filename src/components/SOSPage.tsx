/**
 * Unified emergency entry point.
 *
 * Primary path  → 5-step anonymous help-request flow (5.1 spec)
 * Secondary path → blockchain panic button (existing SOSButton)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Send, Shield, Users, Lock,
  Clock, CheckCircle2, X,
} from "lucide-react";
import { Contract } from "ethers";
import { toast } from "sonner";
import SOSButton from "./SOSButton";
import DeterrentAudioPanel from "./DeterrentAudioPanel";
import {
  HELP_TYPE_CONFIG, SUPPORT_TYPE_CONFIG,
  type HelpType, type SupportType, type HelpRequest,
  createHelpRequest, broadcastHelpRequest, getFuzzyLocation,
} from "@/lib/supportNetwork";
import { sendMessage, subscribeRoom, type ChatMessage } from "@/lib/p2pChat";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";

// ── Types ──────────────────────────────────────────────────────────────────────

type PageView =
  | "home"
  | "panic"
  | "help:type"
  | "help:location"
  | "help:support"
  | "matching"
  | "session";

interface FlowState {
  view:          PageView;
  helpType?:     HelpType;
  locationHint?: string;
  supportTypes?: SupportType[];
  request?:      HelpRequest;
}

export interface SOSPageProps {
  contract:          Contract | null;
  isWalletConnected: boolean;
  isCorrectNetwork:  boolean;
  isSilent:          boolean;
  voiceDeterrent:    boolean;
  customAudioUrl:    string | null;
  saveCustomAudio:   (url: string) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SOSPage(props: SOSPageProps) {
  const [flow, setFlow] = useState<FlowState>({ view: "home" });
  const zkp   = useZKPIdentity();
  const alias = zkp.alias ?? "匿名用户";

  // Session chat state
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [msgInput,  setMsgInput]  = useState("");
  const [sending,   setSending]   = useState(false);
  const unsubRef  = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionCode = flow.view === "session" ? flow.request?.roomCode ?? null : null;

  useEffect(() => {
    if (!sessionCode) { unsubRef.current?.(); return; }
    unsubRef.current?.();
    setMessages([]);
    unsubRef.current = subscribeRoom(sessionCode, alias, (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
      });
    });
    return () => { unsubRef.current?.(); };
  }, [sessionCode, alias]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!sessionCode || !msgInput.trim()) return;
    setSending(true);
    try {
      await sendMessage(sessionCode, alias, msgInput.trim());
      setMsgInput("");
    } finally { setSending(false); }
  }, [sessionCode, alias, msgInput]);

  const go = (next: Partial<FlowState>) =>
    setFlow(prev => ({ ...prev, ...next }));

  // ── View rendering ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col">
      <AnimatePresence mode="wait">

        {/* ── Home ── */}
        {flow.view === "home" && (
          <Pane key="home">
            <HomeView
              onHelp={() => go({ view: "help:type" })}
              onPanic={() => go({ view: "panic" })}
            />
          </Pane>
        )}

        {/* ── Panic (old blockchain SOS) ── */}
        {flow.view === "panic" && (
          <Pane key="panic">
            <div className="flex flex-1 flex-col">
              <button
                onClick={() => go({ view: "home" })}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
              <SOSButton
                contract={props.contract}
                isWalletConnected={props.isWalletConnected}
                isCorrectNetwork={props.isCorrectNetwork}
                isSilent={props.isSilent}
                voiceDeterrent={props.voiceDeterrent}
                customAudioUrl={props.customAudioUrl}
              />
              <div className="px-4 pb-4">
                <DeterrentAudioPanel
                  customAudioUrl={props.customAudioUrl}
                  onSaveAudio={props.saveCustomAudio}
                />
              </div>
            </div>
          </Pane>
        )}

        {/* ── Step 1: Help type ── */}
        {flow.view === "help:type" && (
          <Pane key="help:type">
            <StepHeader step={1} total={3} onBack={() => go({ view: "home" })} />
            <div className="space-y-4 px-4 pb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">发生了什么？</h2>
                <p className="text-sm text-muted-foreground mt-1">选择最接近的情况</p>
              </div>
              <div className="grid gap-3">
                {HELP_TYPE_CONFIG.map(c => (
                  <button
                    key={c.id}
                    onClick={() => go({ view: "help:location", helpType: c.id })}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 text-left active:scale-[0.98] transition-transform"
                  >
                    <span className="text-3xl">{c.icon}</span>
                    <div>
                      <p className="font-bold text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Pane>
        )}

        {/* ── Step 2: Location ── */}
        {flow.view === "help:location" && (
          <Pane key="help:location">
            <LocationStep
              helpType={flow.helpType!}
              onBack={() => go({ view: "help:type" })}
              onNext={(loc) => go({ view: "help:support", locationHint: loc })}
            />
          </Pane>
        )}

        {/* ── Step 3: Support type ── */}
        {flow.view === "help:support" && (
          <Pane key="help:support">
            <SupportStep
              onBack={() => go({ view: "help:location" })}
              onNext={(types) => go({ view: "matching", supportTypes: types })}
            />
          </Pane>
        )}

        {/* ── Matching ── */}
        {flow.view === "matching" && (
          <Pane key="matching">
            <MatchingView
              flow={flow}
              onSession={(req) => go({ view: "session", request: req })}
              onCancel={() => { toast("已取消求助"); go({ view: "home" }); }}
            />
          </Pane>
        )}

        {/* ── Session ── */}
        {flow.view === "session" && flow.request && (
          <Pane key="session">
            <SessionView
              request={flow.request}
              alias={alias}
              messages={messages}
              msgInput={msgInput}
              setMsgInput={setMsgInput}
              sending={sending}
              onSend={handleSend}
              bottomRef={bottomRef}
              onEnd={() => {
                unsubRef.current?.();
                go({ view: "home" });
                toast("支援对话已安全结束");
              }}
            />
          </Pane>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Shared frame ───────────────────────────────────────────────────────────────

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function StepHeader({
  step, total, onBack,
}: {
  step: number; total: number; onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-4 py-3">
      <button onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{step} / {total}</span>
    </div>
  );
}

// ── Home view ──────────────────────────────────────────────────────────────────

function HomeView({
  onHelp, onPanic,
}: {
  onHelp: () => void;
  onPanic: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-8">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 text-center">
        <Shield className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-black text-foreground">你安全吗？</h1>
        <p className="text-sm text-muted-foreground">所有求助完全匿名，无需注册账号</p>
      </div>

      {/* Primary CTA */}
      <button
        onClick={onHelp}
        className="w-full max-w-sm rounded-3xl bg-primary px-6 py-6 text-left shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
      >
        <p className="text-2xl font-black text-primary-foreground">我需要帮助</p>
        <p className="mt-1 text-sm text-primary-foreground/80">
          找到可信社区支援者 · 匿名 · 加密
        </p>
        <div className="mt-4 flex gap-2">
          {["💙 情绪支持", "🤝 陪同接应", "💡 信息建议"].map(t => (
            <span
              key={t}
              className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </button>

      {/* Secondary: panic */}
      <div className="w-full max-w-sm space-y-2">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          极端危险情况
        </p>
        <button
          onClick={onPanic}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-black text-primary">
            SOS
          </div>
          <div className="text-left">
            <p className="font-bold text-foreground">紧急求救 + 存证</p>
            <p className="text-xs text-muted-foreground">长按触发报警 + Solana 链上存证</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Location step ──────────────────────────────────────────────────────────────

function LocationStep({
  helpType, onBack, onNext,
}: {
  helpType: HelpType;
  onBack: () => void;
  onNext: (locationHint: string) => void;
}) {
  const [location, setLocation] = useState("当前区域");
  const [locating, setLocating] = useState(false);
  const typeConfig = HELP_TYPE_CONFIG.find(c => c.id === helpType);

  const handleAutoLocate = async () => {
    setLocating(true);
    try {
      const loc = await getFuzzyLocation();
      setLocation(loc);
    } finally { setLocating(false); }
  };

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader step={2} total={3} onBack={onBack} />
      <div className="flex-1 space-y-5 px-4 pb-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xl">{typeConfig?.icon}</span>
            <span className="text-sm font-semibold text-primary">{typeConfig?.label}</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">你大概在哪里？</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            仅用于匹配附近支援者，精确位置不会被记录
          </p>
        </div>

        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="城市或区域名称"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />

        <button
          onClick={handleAutoLocate}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-foreground disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {locating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <span>📍</span>}
          自动获取大致位置
        </button>

        <p className="text-center text-[11px] text-muted-foreground">
          🔒 坐标被四舍五入至约 11km 精度，不存储精确位置
        </p>

        <button
          onClick={() => onNext(location.trim() || "当前区域")}
          disabled={!location.trim()}
          className="mt-auto w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          下一步
        </button>
      </div>
    </div>
  );
}

// ── Support type step ──────────────────────────────────────────────────────────

function SupportStep({
  onBack, onNext,
}: {
  onBack: () => void;
  onNext: (types: SupportType[]) => void;
}) {
  const [selected, setSelected] = useState<SupportType[]>(["emotional"]);

  const toggle = (id: SupportType) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader step={3} total={3} onBack={onBack} />
      <div className="flex-1 space-y-5 px-4 pb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">需要什么帮助？</h2>
          <p className="mt-1 text-sm text-muted-foreground">可多选</p>
        </div>

        <div className="grid gap-3">
          {SUPPORT_TYPE_CONFIG.map(c => {
            const active = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.98] ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span className="text-3xl">{c.icon}</span>
                <div className="flex-1">
                  <p className={`font-bold ${active ? "text-primary" : "text-foreground"}`}>
                    {c.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
                {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onNext(selected)}
          disabled={selected.length === 0}
          className="mt-auto w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          寻找支援者
        </button>
      </div>
    </div>
  );
}

// ── Matching view ──────────────────────────────────────────────────────────────

function MatchingView({
  flow, onSession, onCancel,
}: {
  flow: FlowState;
  onSession: (req: HelpRequest) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase]     = useState<"searching" | "found">("searching");
  const [request, setRequest] = useState<HelpRequest | null>(null);

  useEffect(() => {
    let cancelled = false;

    const req = createHelpRequest(
      flow.helpType!,
      flow.supportTypes!,
      flow.locationHint!
    );
    broadcastHelpRequest(req);
    setRequest(req);

    const timer = setTimeout(() => {
      if (!cancelled) setPhase("found");
    }, 3000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      {phase === "searching" ? (
        <>
          <div className="relative flex h-32 w-32 items-center justify-center">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute h-full w-full rounded-full border-2 border-primary/40"
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
              />
            ))}
            <Users className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">正在匹配支援者…</p>
            <p className="mt-1 text-sm text-muted-foreground">系统正在为你寻找可信社区成员</p>
          </div>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground underline"
          >
            取消
          </button>
        </>
      ) : (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-foreground">找到 3 位支援者</p>
            <p className="mt-2 text-sm text-muted-foreground">
              已准备好私密加密通道
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {(flow.supportTypes ?? []).map(st => {
                const c = SUPPORT_TYPE_CONFIG.find(s => s.id === st);
                return (
                  <span
                    key={st}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {c?.icon} {c?.label}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="w-full space-y-2">
            <button
              onClick={() => request && onSession(request)}
              disabled={!request}
              className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground active:scale-[0.98] transition-transform"
            >
              进入支援通道
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3" />
              端到端加密 · 对话 2 小时后自动过期
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Session view ───────────────────────────────────────────────────────────────

function SessionView({
  request, alias, messages, msgInput, setMsgInput,
  sending, onSend, bottomRef, onEnd,
}: {
  request:     HelpRequest;
  alias:       string;
  messages:    ChatMessage[];
  msgInput:    string;
  setMsgInput: (v: string) => void;
  sending:     boolean;
  onSend:      () => void;
  bottomRef:   React.RefObject<HTMLDivElement>;
  onEnd:       () => void;
}) {
  const typeConfig = HELP_TYPE_CONFIG.find(c => c.id === request.helpType);
  const minsLeft   = Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 60000));

  return (
    <div className="flex flex-1 flex-col -mx-0">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <span className="text-xl">{typeConfig?.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{typeConfig?.label}</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{minsLeft} 分钟后过期</span>
            <span className="mx-1">·</span>
            <Lock className="h-3 w-3" />
            <span>端到端加密</span>
          </div>
        </div>
        <button
          onClick={onEnd}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground active:scale-95 transition-transform"
        >
          <X className="h-3.5 w-3.5" />
          我已安全
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {/* System message */}
        <div className="flex justify-center">
          <div className="rounded-full bg-card border border-border px-4 py-1.5 text-[11px] text-muted-foreground">
            🔒 已建立加密通道 · 支援者已就绪
          </div>
        </div>

        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isMine ? "items-end" : "items-start"}`}>
            <span className="px-1 text-[11px] text-muted-foreground">{msg.alias}</span>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.isMine
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm border border-border bg-card text-foreground"
              }`}
            >
              {msg.text}
            </div>
            <span className="px-1 text-[10px] text-muted-foreground/50">
              {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Shield className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">通道已加密，等待支援者回应…</p>
            <p className="text-xs opacity-60">你可以先描述你的情况</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 flex gap-2 border-t border-border bg-card px-4 py-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <input
          value={msgInput}
          onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="描述你的情况…"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />
        <button
          onClick={onSend}
          disabled={sending || !msgInput.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition-transform"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
