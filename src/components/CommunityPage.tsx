/**
 * Community page — three tabs:
 *   身份  → ZKP anonymous identity
 *   预警  → Nearby geo-alert zones
 *   支援  → Supporter mode (opt-in, see requests, accept → E2E chat)
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, MapPin, HandHeart, Loader2,
  RefreshCw, CheckCircle2, Copy, AlertTriangle,
  ArrowLeft, Send, Lock, Clock, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import { useGeoAlert } from "@/hooks/useGeoAlert";
import { riskLabel, riskBg, timeAgo } from "@/lib/geoAlert";
import type { IdentityCategory } from "@/lib/zkpIdentity";
import {
  HELP_TYPE_CONFIG, SUPPORT_TYPE_CONFIG,
  type HelpRequest,
  isSupporterMode, setSupporterMode, subscribeHelpRequests,
} from "@/lib/supportNetwork";
import { sendMessage, subscribeRoom, type ChatMessage } from "@/lib/p2pChat";

// ── Tab type ───────────────────────────────────────────────────────────────────

type InnerTab = "identity" | "alerts" | "support";

const INNER_TABS: { id: InnerTab; label: string; english: string; icon: React.ReactNode }[] = [
  { id: "identity", label: "身份", english: "Identity", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "alerts",   label: "预警", english: "Alerts", icon: <MapPin className="h-4 w-4" /> },
  { id: "support",  label: "支援", english: "Support", icon: <HandHeart className="h-4 w-4" /> },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const [tab, setTab] = useState<InnerTab>("identity");
  const zkp           = useZKPIdentity();
  const geo           = useGeoAlert();

  return (
    <div className="flex flex-1 flex-col">
      {/* Inner tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {INNER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            <span className="text-[10px] font-normal opacity-80">{t.english}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "identity" && (
            <TabPane key="identity"><IdentityTab zkp={zkp} /></TabPane>
          )}
          {tab === "alerts" && (
            <TabPane key="alerts"><AlertsTab geo={geo} /></TabPane>
          )}
          {tab === "support" && (
            <TabPane key="support"><SupporterTab zkp={zkp} /></TabPane>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TabPane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-1 flex-col px-4 pb-6 pt-4"
    >
      {children}
    </motion.div>
  );
}

// ── Identity Tab (unchanged from 3.2) ─────────────────────────────────────────

function IdentityTab({ zkp }: { zkp: ReturnType<typeof useZKPIdentity> }) {
  const [category, setCategory] = useState<IdentityCategory>("female");
  const [region, setRegion]     = useState("");

  const handleGenerate = async () => {
    await zkp.generate(category, category === "local" ? region || undefined : undefined);
    toast.success("身份承诺已生成");
  };

  if (zkp.identity) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-sos-success/30 bg-sos-success/6 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sos-success/15 text-2xl">
              {zkp.identity.category === "female" ? "♀" : "📍"}
            </div>
            <div>
              <p className="font-bold text-foreground text-base">{zkp.alias}</p>
              <p className="text-xs text-muted-foreground">
                {zkp.identity.category === "female" ? "女性成员" : `区域居民 · ${zkp.identity.region}`}
              </p>
            </div>
            <div className="ml-auto flex h-7 items-center gap-1 rounded-full bg-sos-success/15 px-2.5 text-[11px] font-bold text-sos-success">
              <CheckCircle2 className="h-3 w-3" />已验证
            </div>
          </div>

          <div className="rounded-xl bg-card px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">承诺哈希（公开）</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-xs text-foreground">{zkp.shortCommit}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(zkp.identity!.commitment); toast.success("已复制"); }}
                className="text-muted-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-card px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">空值符（防重复）</p>
            <p className="font-mono text-xs text-foreground">
              {"0x" + zkp.identity.nullifier.slice(0, 12) + "…"}
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            🔐 原始密钥仅存储在你的设备上，任何人无法从承诺反推你的真实身份
          </p>
        </div>

        <button
          onClick={async () => {
            const ok = await zkp.verify();
            toast(ok ? "✅ 承诺验证通过" : "❌ 验证失败");
          }}
          className="w-full rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground active:scale-95 transition-transform"
        >
          验证我的承诺
        </button>

        <button
          onClick={() => { zkp.revoke(); toast("身份已清除"); }}
          className="w-full rounded-xl py-2.5 text-sm font-medium text-muted-foreground"
        >
          清除身份 / 重新生成
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="font-bold text-foreground">生成匿名身份</h3>
        <p className="text-xs text-muted-foreground">
          无需绑定账号。承诺哈希证明你的身份类别，原始密钥永不离开设备。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["female", "local"] as IdentityCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex flex-col items-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition-all active:scale-95 ${
              category === cat
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <span className="text-2xl">{cat === "female" ? "♀" : "📍"}</span>
            {cat === "female" ? "女性成员" : "区域居民"}
          </button>
        ))}
      </div>

      {category === "local" && (
        <input
          value={region}
          onChange={e => setRegion(e.target.value)}
          placeholder="输入城市或区域（如：上海静安区）"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      )}

      <button
        onClick={handleGenerate}
        disabled={zkp.generating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50 active:scale-95 transition-transform"
      >
        {zkp.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        生成承诺证明
      </button>

      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">工作原理</p>
        {[
          ["🎲", "随机密钥", "设备生成 32 字节随机密钥，仅存你的手机"],
          ["🔒", "承诺计算", "SHA-256(类别 + 密钥) = 承诺哈希"],
          ["✅", "零知识验证", "向他人出示承诺，无需透露密钥"],
        ].map(([icon, title, desc]) => (
          <div key={title} className="flex items-start gap-2 text-xs">
            <span>{icon}</span>
            <span>
              <span className="font-semibold text-foreground">{title}</span>
              <span className="text-muted-foreground"> — {desc}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alerts Tab (unchanged from 3.2) ───────────────────────────────────────────

function AlertsTab({ geo }: { geo: ReturnType<typeof useGeoAlert> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">附近风险预警</h3>
          <p className="text-xs text-muted-foreground">同区域 2+ 份举报即触发预警</p>
        </div>
        <button
          onClick={() => geo.refresh()}
          disabled={geo.status === "locating"}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-50 active:scale-95 transition-transform"
        >
          {geo.status === "locating"
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          刷新
        </button>
      </div>

      {geo.status === "idle" && (
        <div className="space-y-3">
          <button
            onClick={() => geo.refresh()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
          >
            <MapPin className="h-4 w-4" />获取附近预警
          </button>
          <button
            onClick={() => geo.refresh(true)}
            className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
          >
            🎭 加载演示数据（Hackathon Demo）
          </button>
          <p className="text-center text-xs text-muted-foreground">
            定位仅用于匿名区域聚合，不存储真实坐标
          </p>
        </div>
      )}

      {geo.status === "locating" && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">正在获取位置…</p>
        </div>
      )}

      {geo.status === "error" && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center space-y-2">
          <AlertTriangle className="mx-auto h-6 w-6 text-primary" />
          <p className="text-sm text-foreground">{geo.error}</p>
          <button onClick={() => geo.refresh(true)} className="text-xs text-primary underline">
            改用演示数据
          </button>
        </div>
      )}

      {geo.status === "done" && (
        <div className="space-y-3">
          {geo.coords && (
            <p className="text-xs text-muted-foreground text-center">
              📍 已定位 · 匿名化处理后查询
            </p>
          )}
          {geo.alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-sos-success" />
              <p className="text-sm font-medium text-sos-success">附近暂无预警</p>
              <p className="text-xs">当前区域 7 天内举报数量较少</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                发现 <span className="font-bold text-foreground">{geo.alerts.length}</span> 个预警区域
              </p>
              {geo.alerts.map(alert => (
                <div key={alert.zoneHash} className={`rounded-xl border p-4 space-y-2 ${riskBg(alert.riskLevel)}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${alert.riskLevel === "medium" ? "text-sos-offline" : "text-primary"}`}>
                      {riskLabel(alert.riskLevel)}
                      {alert.isSameZone && <span className="ml-2 text-xs font-semibold">← 你所在区域</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(alert.latestAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    该区域 7 天内收到 <span className="font-bold text-foreground">{alert.count}</span> 份匿名举报
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    区域 ID: {alert.zoneHash}
                  </p>
                </div>
              ))}
            </>
          )}
          <button
            onClick={() => geo.refresh()}
            className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
          >
            重新定位
          </button>
        </div>
      )}
    </div>
  );
}

// ── Supporter Tab ──────────────────────────────────────────────────────────────

function SupporterTab({ zkp }: { zkp: ReturnType<typeof useZKPIdentity> }) {
  const [isSupporter, setIsSupporter] = useState(() => isSupporterMode());
  const [requests,    setRequests]    = useState<HelpRequest[]>([]);
  const [session,     setSession]     = useState<HelpRequest | null>(null);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [msgInput,    setMsgInput]    = useState("");
  const [sending,     setSending]     = useState(false);
  const unsubReqRef  = useRef<(() => void) | null>(null);
  const unsubChatRef = useRef<(() => void) | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const alias        = zkp.alias ?? "支援者";

  const handleToggle = (val: boolean) => {
    setIsSupporter(val);
    setSupporterMode(val);
    if (!val) { unsubReqRef.current?.(); setRequests([]); }
  };

  useEffect(() => {
    if (!isSupporter) return;
    unsubReqRef.current = subscribeHelpRequests((req) => {
      setRequests(prev => {
        if (prev.some(r => r.id === req.id)) return prev;
        return [req, ...prev].slice(0, 10);
      });
    });
    return () => { unsubReqRef.current?.(); };
  }, [isSupporter]);

  useEffect(() => {
    if (!session) { unsubChatRef.current?.(); return; }
    unsubChatRef.current?.();
    setMessages([]);
    unsubChatRef.current = subscribeRoom(session.roomCode, alias, (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
      });
    });
    return () => { unsubChatRef.current?.(); };
  }, [session?.roomCode, alias]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!session || !msgInput.trim()) return;
    setSending(true);
    try {
      await sendMessage(session.roomCode, alias, msgInput.trim());
      setMsgInput("");
    } finally { setSending(false); }
  };

  // ── Active support session ─────────────────────────────────────────────────
  if (session) {
    const typeConfig = HELP_TYPE_CONFIG.find(h => h.id === session.helpType);
    const minsLeft   = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 60000));

    return (
      <div className="flex flex-1 flex-col -mx-4 -mt-4">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button
            onClick={() => { unsubChatRef.current?.(); setSession(null); }}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xl">{typeConfig?.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              支援对话 · {typeConfig?.label}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{minsLeft} 分钟后过期</span>
              <span className="mx-1">·</span>
              <Lock className="h-3 w-3" />
              <span>加密</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-card border border-border px-4 py-1.5 text-[11px] text-muted-foreground">
              🤝 你作为支援者加入了此对话
            </div>
          </div>
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-center">
              <Lock className="h-8 w-8 opacity-20" />
              <p className="text-sm">等待求助方发送消息…</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isMine ? "items-end" : "items-start"}`}>
              <span className="px-1 text-[11px] text-muted-foreground">{msg.alias}</span>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.isMine
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm border border-border bg-card text-foreground"
              }`}>
                {msg.text}
              </div>
              <span className="px-1 text-[10px] text-muted-foreground/50">
                {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
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
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="发送支援消息…"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button
            onClick={handleSend}
            disabled={sending || !msgInput.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition-transform"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  // ── Supporter list view ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toggle card */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="font-bold text-foreground">成为支援者</p>
          <p className="text-xs text-muted-foreground">接收附近的匿名求助请求</p>
        </div>
        <button
          onClick={() => handleToggle(!isSupporter)}
          className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
            isSupporter ? "bg-primary" : "bg-border"
          }`}
          aria-label="切换支援者模式"
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isSupporter ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* ZKP identity note */}
      {isSupporter && !zkp.identity && (
        <div className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 text-xs text-muted-foreground">
          💡 前往「身份」标签生成匿名身份，聊天时将显示你的别名而非真实信息
        </div>
      )}

      {/* Request list */}
      {isSupporter && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <div className="relative">
                <Users className="h-10 w-10 opacity-20" />
                <motion.div
                  className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <p className="text-sm">正在监听附近求助…</p>
              <p className="text-xs opacity-60 text-center">
                当有人发出求助请求时，你会在这里看到
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground">
                {requests.length} 个待响应请求
              </p>
              {requests.map(req => {
                const typeConfig    = HELP_TYPE_CONFIG.find(h => h.id === req.helpType);
                const minsRemaining = Math.max(0, Math.ceil((req.expiresAt - Date.now()) / 60000));
                return (
                  <div key={req.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{typeConfig?.icon ?? "⚠️"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{typeConfig?.label}</p>
                        <p className="text-xs text-muted-foreground">📍 {req.locationHint}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {minsRemaining} 分钟
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {req.supportTypes.map(st => {
                        const sc = SUPPORT_TYPE_CONFIG.find(s => s.id === st);
                        return (
                          <span
                            key={st}
                            className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs"
                          >
                            {sc?.icon} {sc?.label}
                          </span>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      ⚠️ 你看不到对方的真实身份或精确位置
                    </p>

                    <button
                      onClick={() => {
                        setSession(req);
                        setRequests(prev => prev.filter(r => r.id !== req.id));
                        toast.success("已接受请求，正在建立加密通道");
                      }}
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
                    >
                      接受请求
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Explainer when off */}
      {!isSupporter && (
        <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">成为支援者须知</p>
          {[
            "🔒 求助方匿名发送，你看不到对方真实身份",
            "📍 仅显示大致区域，非精确位置",
            "⏱️ 对话临时存在，2 小时后自动过期",
            "💙 你的匿名身份将作为别名显示在对话中",
            "🛡️ 随时可以退出任何对话",
          ].map(t => (
            <p key={t} className="text-xs text-muted-foreground">{t}</p>
          ))}
        </div>
      )}
    </div>
  );
}
