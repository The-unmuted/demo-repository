import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, MapPin, MessageCircle, Loader2,
  RefreshCw, Plus, ArrowLeft, Send, LogOut,
  CheckCircle2, Copy, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import { useGeoAlert } from "@/hooks/useGeoAlert";
import { useP2PChat } from "@/hooks/useP2PChat";
import { riskLabel, riskBg, timeAgo } from "@/lib/geoAlert";
import type { IdentityCategory } from "@/lib/zkpIdentity";

// ── Inner tab type ─────────────────────────────────────────────────────────────

type InnerTab = "identity" | "alerts" | "chat";

const INNER_TABS: { id: InnerTab; label: string; icon: React.ReactNode }[] = [
  { id: "identity", label: "身份",  icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "alerts",   label: "预警",  icon: <MapPin       className="h-4 w-4" /> },
  { id: "chat",     label: "聊天",  icon: <MessageCircle className="h-4 w-4" /> },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const [tab, setTab] = useState<InnerTab>("identity");
  const zkp           = useZKPIdentity();
  const geo           = useGeoAlert();
  const chat          = useP2PChat(zkp.alias ?? "匿名用户");

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
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "identity" && (
            <TabPane key="identity"><IdentityTab zkp={zkp} /></TabPane>
          )}
          {tab === "alerts" && (
            <TabPane key="alerts"><AlertsTab geo={geo} /></TabPane>
          )}
          {tab === "chat" && (
            <TabPane key="chat"><ChatTab chat={chat} alias={zkp.alias ?? "匿名用户"} /></TabPane>
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

// ── Identity Tab ───────────────────────────────────────────────────────────────

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
        {/* Badge */}
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

          {/* Commitment hash */}
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

          {/* Nullifier */}
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

        {/* Self-verify */}
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

      {/* Category picker */}
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

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">工作原理</p>
        {[
          ["🎲", "随机密钥", "设备生成 32 字节随机密钥，仅存你的手机"],
          ["🔒", "承诺计算", "SHA-256(类别 + 密钥) = 承诺哈希"],
          ["✅", "零知识验证", "向他人出示承诺，无需透露密钥"],
        ].map(([icon, title, desc]) => (
          <div key={title} className="flex items-start gap-2 text-xs">
            <span>{icon}</span>
            <span><span className="font-semibold text-foreground">{title}</span><span className="text-muted-foreground"> — {desc}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alerts Tab ─────────────────────────────────────────────────────────────────

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
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50 active:scale-95 transition-transform"
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
            <MapPin className="h-4 w-4" />
            获取附近预警
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
          <button
            onClick={() => geo.refresh(true)}
            className="text-xs text-primary underline"
          >
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
                <div
                  key={alert.zoneHash}
                  className={`rounded-xl border p-4 space-y-2 ${riskBg(alert.riskLevel)}`}
                >
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

// ── Chat Tab ───────────────────────────────────────────────────────────────────

function ChatTab({ chat, alias }: { chat: ReturnType<typeof useP2PChat>; alias: string }) {
  const [roomInput, setRoomInput] = useState("");
  const [msgInput, setMsgInput]   = useState("");
  const bottomRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  if (chat.activeRoom) {
    return (
      <div className="flex flex-1 flex-col -mx-4 -mt-4">
        {/* Chat header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => chat.setActiveRoom(null)} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">房间 #{chat.activeRoom}</p>
            <p className="text-xs text-muted-foreground">以 <span className="font-semibold">{alias}</span> 身份聊天</p>
          </div>
          <button
            onClick={() => { chat.exitRoom(chat.activeRoom!); toast("已离开房间"); }}
            className="text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {chat.messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <MessageCircle className="h-8 w-8 opacity-30" />
              <p className="text-xs">等待消息…</p>
              <p className="text-[11px] text-center opacity-60">所有消息端到端加密，Gun.js P2P 传输</p>
            </div>
          )}
          {chat.messages.map(msg => (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isMine ? "items-end" : "items-start"}`}>
              <span className="text-[11px] text-muted-foreground px-1">{msg.alias}</span>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.isMine
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm bg-card text-foreground border border-border"
              }`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground/50 px-1">
                {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 flex gap-2 border-t border-border bg-card px-4 py-3"
             style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <input
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="输入消息…"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={handleSend}
            disabled={chat.sending || !msgInput.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition-transform"
          >
            {chat.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  function handleSend() {
    if (!msgInput.trim()) return;
    chat.send(msgInput);
    setMsgInput("");
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-foreground">匿名互助聊天</h3>
        <p className="text-xs text-muted-foreground">端到端加密 · P2P 传输 · 身份匿名</p>
      </div>

      {/* Join by code */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">输入房间码加入</p>
        <div className="flex gap-2">
          <input
            value={roomInput}
            onChange={e => setRoomInput(e.target.value.toLowerCase())}
            placeholder="房间码（如：abc123）"
            maxLength={12}
            className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={() => { chat.joinRoom(roomInput); setRoomInput(""); }}
            disabled={!roomInput.trim()}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40 active:scale-95 transition-transform"
          >
            加入
          </button>
        </div>
      </div>

      {/* Create new room */}
      <button
        onClick={() => {
          const code = chat.createRoom();
          toast.success(`已创建房间 #${code}，将房间码分享给对方`);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground active:scale-95 transition-transform"
      >
        <Plus className="h-4 w-4" />
        创建新房间
      </button>

      {/* Room list */}
      {chat.rooms.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">已加入的房间</p>
          {chat.rooms.map(room => (
            <div
              key={room.code}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <button
                onClick={() => chat.setActiveRoom(room.code)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-base">
                  💬
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">#{room.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(room.joinedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </button>
              <button
                onClick={() => { chat.exitRoom(room.code); toast("已离开房间"); }}
                className="text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Security note */}
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">安全说明</p>
        {[
          "🔒 消息 AES-256-GCM 加密后才发送",
          "🌐 Gun.js P2P 传输，无中心服务器",
          "👤 别名由你的 ZKP 身份自动生成",
          "🗝️ 房间码即密钥，不要在不安全的渠道分享",
        ].map(t => (
          <p key={t} className="text-xs text-muted-foreground">{t}</p>
        ))}
      </div>
    </div>
  );
}
