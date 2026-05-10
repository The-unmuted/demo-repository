/**
 * Support page — supporter mode (opt-in, see requests, accept → E2E chat)
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, HandHeart, Loader2,
  ArrowLeft, Send, Lock, Clock, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import {
  HELP_TYPE_CONFIG, SUPPORT_TYPE_CONFIG,
  type HelpRequest, type HelpType, type SupportType,
  isSupporterMode, setSupporterMode, subscribeHelpRequests,
} from "@/lib/supportNetwork";
import { sendMessage, subscribeRoom, type ChatMessage } from "@/lib/p2pChat";
import {
  MAP_ALERTS_CHANGED_EVENT,
  alertKindLabel,
  getMapAlertRecords,
  timeAgo,
  type MapAlertRecord,
} from "@/lib/geoAlert";
import { AppLanguage, copyFor } from "@/lib/locale";

function helpLabel(helpType: HelpType | undefined, language: AppLanguage) {
  const config = HELP_TYPE_CONFIG.find(c => c.id === helpType);
  return config ? copyFor(language, config.labelEn, config.labelZh) : "";
}

function supportLabel(supportType: SupportType | undefined, language: AppLanguage) {
  const config = SUPPORT_TYPE_CONFIG.find(c => c.id === supportType);
  return config ? copyFor(language, config.labelEn, config.labelZh) : "";
}

function helpTypeLabel(helpType: string | undefined, language: AppLanguage) {
  const config = HELP_TYPE_CONFIG.find(c => c.id === helpType);
  return config ? copyFor(language, config.labelEn, config.labelZh) : copyFor(language, "Community Help", "社区陪伴支持");
}

function supportTypeLabel(supportType: string, language: AppLanguage) {
  const config = SUPPORT_TYPE_CONFIG.find(c => c.id === supportType);
  return config ? copyFor(language, config.labelEn, config.labelZh) : supportType;
}

function alertNote(alert: MapAlertRecord, language: AppLanguage) {
  if (alert.noteEn || alert.noteZh) {
    return copyFor(language, alert.noteEn ?? "", alert.noteZh ?? "");
  }

  return alert.kind === "emergency"
    ? copyFor(language, "Exact live location is available while this SOS is active.", "SOS 激活期间会显示精确实时位置。")
    : copyFor(language, "Only an approximate area is shared for non-emergency support.", "非紧急支援仅共享大致区域。");
}

function alertSourceLabel(source: MapAlertRecord["source"], language: AppLanguage) {
  return source === "demo"
    ? copyFor(language, "Demo example", "演示示例")
    : copyFor(language, "Live from this device", "来自本机实时记录");
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CommunityPage({ language }: { language: AppLanguage }) {
  const zkp           = useZKPIdentity();

  return (
    <TabPane>
      <SupporterTab zkp={zkp} language={language} />
    </TabPane>
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

function SupportAlertsPanel({
  alerts,
  language,
}: {
  alerts: MapAlertRecord[];
  language: AppLanguage;
}) {
  const sosAlerts = alerts.filter(alert => alert.kind === "emergency");
  const communityAlerts = alerts.filter(alert => alert.kind === "community");

  return (
    <section className="space-y-3">
      <SupportAlertSection
        title={copyFor(language, "SOS support alerts", "SOS 支援提醒")}
        description={copyFor(
          language,
          "Emergency reports show live location for immediate response.",
          "紧急上报会显示实时位置，方便快速响应。"
        )}
        alerts={sosAlerts}
        language={language}
        tone="sos"
      />
      <SupportAlertSection
        title={copyFor(language, "Community Help", "社区陪伴支持")}
        description={copyFor(
          language,
          "Non-emergency support keeps location approximate and privacy-first.",
          "非紧急陪伴支持仅显示大致区域，优先保护隐私。"
        )}
        alerts={communityAlerts}
        language={language}
        tone="community"
      />
    </section>
  );
}

function SupportAlertSection({
  title,
  description,
  alerts,
  language,
  tone,
}: {
  title: string;
  description: string;
  alerts: MapAlertRecord[];
  language: AppLanguage;
  tone: "sos" | "community";
}) {
  const isSos = tone === "sos";
  const Icon = isSos ? AlertTriangle : HandHeart;

  return (
    <section
      className={`space-y-3 rounded-[1.75rem] border p-4 shadow-[0_14px_34px_hsl(240_70%_4%/0.16)] ${
        isSos
          ? "border-sos/18 bg-[linear-gradient(145deg,hsl(352_84%_62%/0.10),hsl(336_92%_76%/0.12),hsl(var(--card)/0.92))]"
          : "border-primary/16 bg-[linear-gradient(145deg,hsl(270_75%_62%/0.08),hsl(336_92%_76%/0.13),hsl(var(--card)/0.9))]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isSos ? "bg-sos/12 text-sos" : "bg-primary/12 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
            isSos ? "bg-sos/12 text-sos" : "bg-primary/12 text-primary"
          }`}
        >
          {copyFor(language, `${alerts.length} active`, `${alerts.length} 个进行中`)}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/55 px-3 py-5 text-center text-xs text-muted-foreground">
          {copyFor(
            language,
            isSos ? "No active SOS alerts nearby" : "No active Community Help requests nearby",
            isSos ? "附近暂无 SOS 提醒" : "附近暂无社区陪伴支持请求"
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 4).map((alert) => {
            const isEmergency = alert.kind === "emergency";
            const Icon = isEmergency ? AlertTriangle : HandHeart;

            return (
              <article
                key={alert.id}
                className={`rounded-2xl border p-3 text-left ${
                  isEmergency
                    ? "border-sos/20 bg-card/78"
                    : "border-primary/16 bg-[linear-gradient(145deg,hsl(270_75%_62%/0.08),hsl(336_92%_76%/0.12))]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isEmergency ? "bg-sos/12 text-sos" : "bg-primary/12 text-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                          isEmergency ? "bg-sos/12 text-sos" : "bg-primary/12 text-primary"
                        }`}
                      >
                        {alertKindLabel(alert.kind, language)}
                      </span>
                      <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {alertSourceLabel(alert.source, language)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-foreground">
                      {isEmergency
                        ? copyFor(language, "SOS emergency report", "SOS 紧急上报")
                        : helpTypeLabel(alert.helpType, language)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {alertNote(alert, language)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {isEmergency
                          ? `${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}`
                          : alert.locationLabel}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(alert.createdAt, language)}
                      </span>
                    </div>
                    {!isEmergency && alert.supportTypes && alert.supportTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {alert.supportTypes.map((supportType) => (
                          <span
                            key={supportType}
                            className="rounded-full border border-primary/14 bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-primary"
                          >
                            {supportTypeLabel(supportType, language)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NearbyRequestCard({
  req,
  language,
  onAccept,
}: {
  req: HelpRequest;
  language: AppLanguage;
  onAccept: () => void;
}) {
  const typeConfig = HELP_TYPE_CONFIG.find(h => h.id === req.helpType);
  const minsRemaining = Math.max(0, Math.ceil((req.expiresAt - Date.now()) / 60000));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeConfig?.icon ?? "⚠️"}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm">{helpLabel(req.helpType, language)}</p>
          <p className="text-xs text-muted-foreground">📍 {req.locationHint}</p>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {copyFor(language, `${minsRemaining} min`, `${minsRemaining} 分钟`)}
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
              {sc?.icon} {supportLabel(st, language)}
            </span>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {copyFor(language, "You cannot see their real identity or precise location.", "你看不到对方的真实身份或精确位置")}
      </p>

      <button
        onClick={onAccept}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
      >
        {copyFor(language, "Accept request", "接受请求")}
      </button>
    </div>
  );
}

// ── Supporter Tab ──────────────────────────────────────────────────────────────

function SupporterTab({
  zkp,
  language,
}: {
  zkp: ReturnType<typeof useZKPIdentity>;
  language: AppLanguage;
}) {
  const [isSupporter, setIsSupporter] = useState(() => isSupporterMode());
  const [requests,    setRequests]    = useState<HelpRequest[]>([]);
  const [session,     setSession]     = useState<HelpRequest | null>(null);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [msgInput,    setMsgInput]    = useState("");
  const [sending,     setSending]     = useState(false);
  const unsubReqRef  = useRef<(() => void) | null>(null);
  const unsubChatRef = useRef<(() => void) | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const alias        = zkp.alias ?? copyFor(language, "Supporter", "支援者");
  const [mapAlerts, setMapAlerts] = useState<MapAlertRecord[]>(() => getMapAlertRecords());

  const handleToggle = (val: boolean) => {
    setIsSupporter(val);
    setSupporterMode(val);
    if (!val) { unsubReqRef.current?.(); setRequests([]); }
  };

  useEffect(() => {
    const refreshAlerts = () => setMapAlerts(getMapAlertRecords());
    refreshAlerts();
    window.addEventListener(MAP_ALERTS_CHANGED_EVENT, refreshAlerts);
    return () => window.removeEventListener(MAP_ALERTS_CHANGED_EVENT, refreshAlerts);
  }, []);

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
              {copyFor(language, "Support chat", "支援对话")} · {helpLabel(session.helpType, language)}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{copyFor(language, `${minsLeft} min left`, `${minsLeft} 分钟后过期`)}</span>
              <span className="mx-1">·</span>
              <Lock className="h-3 w-3" />
              <span>{copyFor(language, "Encrypted", "加密")}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-card border border-border px-4 py-1.5 text-[11px] text-muted-foreground">
              {copyFor(language, "You joined this conversation as a supporter", "你作为支援者加入了此对话")}
            </div>
          </div>
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-center">
              <Lock className="h-8 w-8 opacity-20" />
              <p className="text-sm">{copyFor(language, "Waiting for the requester...", "等待求助方发送消息...")}</p>
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
        >
          <input
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={copyFor(language, "Send support message...", "发送支援消息...")}
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
      {/* Support mode card */}
      <button
        onClick={() => handleToggle(!isSupporter)}
        className={`group relative w-full overflow-hidden rounded-[1.75rem] border p-4 text-left transition-all active:scale-[0.99] ${
          isSupporter
            ? "border-primary/35 bg-[linear-gradient(145deg,hsl(270_75%_62%/0.22),hsl(336_92%_76%/0.24))] shadow-[0_0_34px_hsl(var(--primary)/0.18)]"
            : "border-border/80 bg-card/88 shadow-[0_14px_34px_hsl(240_70%_4%/0.18)] hover:border-primary/25 hover:bg-primary/8"
        }`}
        aria-pressed={isSupporter}
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-90" />
        <div className="relative flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isSupporter ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            }`}
          >
            <HandHeart className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-foreground">
              {copyFor(language, isSupporter ? "Support mode active" : "Become a supporter", isSupporter ? "支援模式进行中" : "成为支援者")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copyFor(
                language,
                isSupporter
                  ? "You are listening for anonymous support requests nearby."
                  : "Receive nearby anonymous requests and offer encrypted support.",
                isSupporter
                  ? "你正在留意附近的匿名求助请求。"
                  : "接收附近匿名求助，并提供加密支援。"
              )}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${
              isSupporter ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {copyFor(language, isSupporter ? "End" : "Start", isSupporter ? "结束" : "开始")}
          </span>
        </div>
      </button>

      {/* ZKP identity note */}
      {isSupporter && !zkp.identity && (
        <div className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 text-xs text-muted-foreground">
          {copyFor(
            language,
            "Create an identity first. Chat will show your alias, not your real information.",
            "请先创建匿名身份。聊天时将显示你的别名，而非真实信息。"
          )}
        </div>
      )}

      {/* Request list */}
      {isSupporter && (
        <div className="space-y-3">
          <SupportAlertsPanel alerts={mapAlerts} language={language} />

          {requests.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {copyFor(language, `${requests.length} pending requests`, `${requests.length} 个待响应请求`)}
              </p>
              {requests.map(req => (
                <NearbyRequestCard
                  key={req.id}
                  req={req}
                  language={language}
                  onAccept={() => {
                    setSession(req);
                    setRequests(prev => prev.filter(r => r.id !== req.id));
                    toast.success(copyFor(language, "Request accepted. Opening encrypted channel.", "已接受请求，正在建立加密通道"));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Explainer when off */}
      {!isSupporter && (
        <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{copyFor(language, "Supporter notes", "成为支援者须知")}</p>
          {[
            copyFor(language, "Requesters stay anonymous.", "求助方匿名发送，你看不到对方真实身份"),
            copyFor(language, "Only approximate areas are shown.", "仅显示大致区域，非精确位置"),
            copyFor(language, "Chats expire automatically after 2 hours.", "对话临时存在，2 小时后自动过期"),
            copyFor(language, "Your anonymous identity appears as an alias.", "你的匿名身份将作为别名显示在对话中"),
            copyFor(language, "You can leave any conversation anytime.", "随时可以退出任何对话"),
          ].map(t => (
            <p key={t} className="text-xs text-muted-foreground">{t}</p>
          ))}
        </div>
      )}
    </div>
  );
}
