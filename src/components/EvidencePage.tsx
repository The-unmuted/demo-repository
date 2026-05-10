import { useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Video, Mic, MicOff, CheckCircle2, Loader2,
  ArrowLeft, Clock, Download, ExternalLink, ShieldCheck, Copy, ChevronDown, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useEvidenceVault } from "@/hooks/useEvidenceVault";
import { useSolanaWallet, shortenSolAddress } from "@/hooks/useSolanaWallet";
import { loadSOSHistory } from "@/lib/localStorage";
import { shortenHash } from "@/hooks/useWallet";
import { formatBytes } from "@/lib/evidenceCrypto";
import { SOLANA_NETWORK } from "@/lib/evidenceContract";
import { AppLanguage, copyFor } from "@/lib/locale";

// ── helpers ────────────────────────────────────────────────────────────────────

function getMimeLabel(mime: string, language: AppLanguage) {
  if (mime.startsWith("image/")) return copyFor(language, "Image", "图片");
  if (mime.startsWith("video/")) return copyFor(language, "Video", "视频");
  if (mime.startsWith("audio/")) return copyFor(language, "Audio", "音频");
  return copyFor(language, "File", "文件");
}

function getMimeIcon(mime: string) {
  if (mime.startsWith("image/")) return "📷";
  if (mime.startsWith("video/")) return "🎥";
  if (mime.startsWith("audio/")) return "🎙️";
  return "📄";
}

function copyToClipboard(text: string, language: AppLanguage) {
  navigator.clipboard.writeText(text).then(() => toast.success(copyFor(language, "Copied", "已复制")));
}

function formatTs(ts: number, language: AppLanguage) {
  return new Date(ts * 1000).toLocaleString(language === "zh" ? "zh-CN" : "en-US");
}

// ── Step indicator ─────────────────────────────────────────────────────────────

type StepStatusVal = "pending" | "running" | "done" | "error";

function StepRow({
  label,
  sublabel,
  status,
}: {
  label: string;
  sublabel: string;
  status: StepStatusVal;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
        {status === "running" && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {status === "done" && (
          <CheckCircle2 className="h-4 w-4 text-sos-success" />
        )}
        {status === "error" && (
          <span className="text-xs font-bold text-destructive">✕</span>
        )}
        {status === "pending" && (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1">
        <p
          className={`text-sm font-semibold ${
            status === "running"
              ? "text-foreground"
              : status === "done"
              ? "text-sos-success"
              : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Receipt card ───────────────────────────────────────────────────────────────

function ReceiptCard({
  result,
  onDownloadKey,
  onReset,
  onComplete,
  language,
}: {
  result: NonNullable<ReturnType<typeof useEvidenceVault>["result"]>;
  onDownloadKey: () => void;
  onReset: () => void;
  onComplete?: () => void;
  language: AppLanguage;
}) {
  const { record } = result;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sos-success/30 bg-sos-success/5 p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sos-success/15">
          <ShieldCheck className="h-5 w-5 text-sos-success" />
        </div>
        <div>
          <p className="font-bold text-foreground">{copyFor(language, "Evidence Secured", "存证完成")}</p>
          <p className="text-xs text-muted-foreground">
            {getMimeIcon(record.mimeType)} {getMimeLabel(record.mimeType, language)} ·{" "}
            {formatBytes(record.originalSize)} · {new Date(record.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}
          </p>
        </div>
      </div>

      {/* Key download — most important action */}
      <button
        onClick={onDownloadKey}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-sm text-primary-foreground active:scale-95 transition-transform"
      >
        <Download className="h-4 w-4" />
        {copyFor(language, "Download decryption key", "下载解密密钥")}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        {copyFor(
          language,
          "Keep this key safe. The original file cannot be restored without it.",
          "请妥善保存密钥。密钥丢失后无法恢复原始文件。"
        )}
      </p>

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-xs text-muted-foreground"
      >
        <span>{copyFor(language, "View evidence details", "查看存证详情")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3"
          >
            {/* Hash */}
            <HashRow
              label={copyFor(language, "Encrypted file fingerprint (SHA-256)", "加密文件指纹 (SHA-256)")}
              value={record.encryptedHash}
              short={shortenHash("0x" + record.encryptedHash.slice(0, 8) + record.encryptedHash.slice(-8))}
              language={language}
            />

            {/* Arweave TX */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {copyFor(language, "Arweave permanent storage", "Arweave 永久存储")}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                <p className="flex-1 font-mono text-xs text-foreground truncate">
                  {record.arweaveTxId.slice(0, 12)}…{record.arweaveTxId.slice(-6)}
                </p>
                <button onClick={() => copyToClipboard(record.arweaveTxId, language)}>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <a
                  href={record.arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Chain TX — Solana */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {copyFor(language, "Solana on-chain timestamp", "Solana 链上时间戳")}
                </p>
                {record.isSimulated && (
                  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-sos-offline/15 text-sos-offline">
                    {copyFor(language, "Demo", "演示模式")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                <p className="flex-1 font-mono text-xs text-foreground truncate">
                  {record.chainTxHash.slice(0, 8)}…{record.chainTxHash.slice(-6)}
                </p>
                <button onClick={() => copyToClipboard(record.chainTxHash, language)}>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <a
                  href={record.chainExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {copyFor(language, "Block time", "区块时间")}：{formatTs(record.blockTimestamp, language)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onComplete ?? onReset}
        className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground active:scale-95 transition-transform"
      >
        {onComplete
          ? copyFor(language, "Finish report", "完成报告")
          : copyFor(language, "Continue", "继续存证")}
      </button>
    </motion.div>
  );
}

function HashRow({
  label,
  value,
  short,
  language,
}: {
  label: string;
  value: string;
  short: string;
  language: AppLanguage;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
        <p className="flex-1 font-mono text-xs text-foreground">{short}</p>
        <button onClick={() => copyToClipboard(value, language)}>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ── Audio recorder ─────────────────────────────────────────────────────────────

function useAudioRecorder(onBlob: (blob: Blob) => void, language: AppLanguage) {
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        onBlob(blob);
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      toast.error(copyFor(language, "Could not access microphone. Please check permissions.", "无法访问麦克风，请检查权限"));
    }
  }, [onBlob, language]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  }, []);

  return { recording, seconds, start, stop };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EvidencePage({
  language,
  onExit,
  onComplete,
}: {
  language: AppLanguage;
  onExit?: () => void;
  onComplete?: () => void;
}) {
  const vault = useEvidenceVault(language);
  const solana = useSolanaWallet();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const audioRecorder = useAudioRecorder(
    (blob) => vault.processFile(blob, "audio/webm"),
    language
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      vault.processFile(file, file.type);
      e.target.value = "";
    },
    [vault]
  );

  const isProcessing =
    vault.step === "encrypting" ||
    vault.step === "uploading" ||
    vault.step === "anchoring";

  return (
    <div className="flex flex-1 flex-col px-4 pb-4 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 pt-1">
        {onExit && (
          <button
            onClick={onExit}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-95"
            aria-label={copyFor(language, "Back to help", "返回求助页")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {copyFor(language, "After Report", "事后存证")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {copyFor(
              language,
              "Add photo, video, or audio evidence when you are safe.",
              "在安全后补充照片、视频或录音证据。"
            )}
          </p>
        </div>
      </div>

      {/* ── Phantom wallet banner ── */}
      <PhantomBanner solana={solana} language={language} />

      {/* ── Capture buttons (idle only) ── */}
      <AnimatePresence mode="wait">
        {vault.step === "idle" && (
          <motion.div
            key="capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-3 gap-3"
          >
            {/* Photo */}
            <CaptureButton
              icon={<Camera className="h-7 w-7" />}
              label={copyFor(language, "Photo", "拍照")}
              color="text-blue-400"
              bgColor="bg-blue-500/10 border-blue-500/20"
              onClick={() => photoInputRef.current?.click()}
            />

            {/* Video */}
            <CaptureButton
              icon={<Video className="h-7 w-7" />}
              label={copyFor(language, "Video", "录像")}
              color="text-purple-400"
              bgColor="bg-purple-500/10 border-purple-500/20"
              onClick={() => videoInputRef.current?.click()}
            />

            {/* Audio */}
            <CaptureButton
              icon={
                audioRecorder.recording ? (
                  <MicOff className="h-7 w-7 text-red-400 animate-pulse" />
                ) : (
                  <Mic className="h-7 w-7" />
                )
              }
              label={audioRecorder.recording ? `${audioRecorder.seconds}s` : copyFor(language, "Audio", "录音")}
              color={audioRecorder.recording ? "text-red-400" : "text-green-400"}
              bgColor={
                audioRecorder.recording
                  ? "bg-red-500/15 border-red-500/40"
                  : "bg-green-500/10 border-green-500/20"
              }
              onClick={
                audioRecorder.recording ? audioRecorder.stop : audioRecorder.start
              }
            />

            {/* Hidden file inputs */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInput}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInput}
            />
          </motion.div>
        )}

        {/* ── Processing steps ── */}
        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4"
          >
            <p className="text-sm font-bold text-foreground text-center">
              {copyFor(language, "Processing...", "正在处理...")}
            </p>
            <StepRow
              label={copyFor(language, "AES-256-GCM Local encryption", "AES-256-GCM 本地加密")}
              sublabel={copyFor(language, "Done on your device. Data never leaves unencrypted.", "在设备端完成，数据不离开本机")}
              status={vault.steps.encrypting}
            />
            <StepRow
              label={copyFor(language, "Upload to Arweave permanent storage", "上传至 Arweave 永久存储")}
              sublabel={copyFor(language, "Only encrypted originals are stored.", "加密原件，任何人无法解读内容")}
              status={vault.steps.uploading}
            />
            <StepRow
              label={copyFor(language, "Solana on-chain timestamp", "Solana 链上时间戳")}
              sublabel={copyFor(language, "The hash is written through Solana Memo Program.", "哈希通过 Memo Program 写入 Solana，不可篡改")}
              status={vault.steps.anchoring}
            />
          </motion.div>
        )}

        {/* ── Receipt ── */}
        {vault.step === "done" && vault.result && (
          <motion.div key="receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ReceiptCard
              result={vault.result}
              onDownloadKey={vault.downloadKey}
              onReset={vault.reset}
              onComplete={onComplete}
              language={language}
            />
          </motion.div>
        )}

        {/* ── Error ── */}
        {vault.step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-3"
          >
            <p className="text-sm font-bold text-destructive">
              {copyFor(language, "Evidence failed", "存证失败")}
            </p>
            <p className="text-xs text-muted-foreground">{vault.error}</p>
            <button
              onClick={vault.reset}
              className="w-full rounded-xl bg-card border border-border py-2.5 text-sm font-medium text-foreground"
            >
              {copyFor(language, "Retry", "重试")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── How it works ── */}
      {vault.step === "idle" && (
        <HowItWorksDisclosure
          open={showHowItWorks}
          onToggle={() => setShowHowItWorks((current) => !current)}
          language={language}
        />
      )}

      {/* ── Vault history ── */}
      {vault.history.length > 0 && (
        <VaultHistory records={vault.history} language={language} />
      )}

      {/* ── Legacy SOS history ── */}
      <SOSHistory language={language} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CaptureButton({
  icon, label, color, bgColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border ${bgColor} py-5 active:scale-95 transition-transform ${color}`}
    >
      {icon}
      <span className="text-xs font-bold text-foreground">{label}</span>
    </button>
  );
}

function HowItWorksDisclosure({
  open,
  onToggle,
  language,
}: {
  open: boolean;
  onToggle: () => void;
  language: AppLanguage;
}) {
  const items = [
    [
      "🔒",
      copyFor(language, "AES-256 encryption", "AES-256 加密"),
      copyFor(language, "Files are encrypted locally. Only you hold the key.", "文件在设备本地加密，密钥仅你持有"),
    ],
    [
      "🌐",
      copyFor(language, "Arweave storage", "Arweave 存储"),
      copyFor(language, "Encrypted originals are permanently stored on a decentralized network.", "加密原件永久存储于去中心化网络"),
    ],
    [
      "◎",
      copyFor(language, "Solana timestamp", "Solana 时间戳"),
      copyFor(language, "Hashes are written through Solana Memo Program.", "哈希经 Memo Program 写入 Solana，不可篡改"),
    ],
  ];

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex min-h-0 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        {copyFor(language, "How it works", "工作原理")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
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
            <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2">
              {items.map(([icon, title, desc]) => (
                <div key={title} className="flex items-start gap-2.5 text-xs">
                  <span>{icon}</span>
                  <div>
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="text-muted-foreground"> - {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VaultHistory({
  records,
  language,
}: {
  records: import("@/lib/localStorage").VaultRecord[];
  language: AppLanguage;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">
        {copyFor(language, "Evidence History", "存证记录")}
      </h3>
      {records.slice(0, 10).map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{getMimeIcon(r.mimeType)}</span>
            <span className="text-xs font-medium text-foreground">
              {getMimeLabel(r.mimeType, language)} · {formatBytes(r.originalSize)}
            </span>
            <span
              className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${
                r.isSimulated
                  ? "bg-sos-offline/15 text-sos-offline"
                  : "bg-sos-success/15 text-sos-success"
              }`}
            >
              {r.isSimulated ? copyFor(language, "Demo", "演示") : copyFor(language, "On-chain", "已上链")}
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            SHA-256: {r.encryptedHash.slice(0, 16)}…
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{new Date(r.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</span>
            {!r.isSimulated && (
              <a
                href={r.chainExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-primary"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SOSHistory({ language }: { language: AppLanguage }) {
  const history = loadSOSHistory();
  if (history.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">
        {copyFor(language, "SOS History", "SOS 记录")}
      </h3>
      {history.slice(0, 5).map((rec, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${rec.status === "success" ? "text-sos-success" : "text-sos-offline"}`}>
              {rec.status === "success"
                ? copyFor(language, "✓ On-chain", "✓ 已上链")
                : copyFor(language, "⚠ Saved locally", "⚠ 本地存储")}
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">{formatTs(rec.timestamp, language)}</span>
          </div>
          {rec.txHash && (
            <a
              href={`https://testnet.snowtrace.io/tx/${rec.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary underline"
            >
              TX: {shortenHash(rec.txHash)}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Phantom wallet banner ──────────────────────────────────────────────────────

function PhantomBanner({
  solana,
  language,
}: {
  solana: ReturnType<typeof useSolanaWallet>;
  language: AppLanguage;
}) {
  const { wallet, connect, disconnect } = solana;

  if (wallet.isConnected && wallet.address) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-sos-success/25 bg-sos-success/8 px-3 py-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-sos-success" />
          <span className="text-xs font-semibold text-sos-success">
            {copyFor(language, "Phantom connected", "Phantom 已连接")}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {shortenSolAddress(wallet.address)}
          </span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-sos-offline/15 text-sos-offline">
            {SOLANA_NETWORK}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="text-[11px] text-muted-foreground underline"
        >
          {copyFor(language, "Disconnect", "断开")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground active:scale-95 transition-transform"
    >
      <Wallet className="h-4 w-4 text-muted-foreground" />
      {wallet.isPhantomInstalled
        ? copyFor(language, "Connect Phantom", "连接 Phantom 钱包")
        : copyFor(language, "Install Phantom", "安装 Phantom 钱包")}
      <span className="text-xs text-muted-foreground font-normal">
        {copyFor(language, "Demo mode when disconnected", "未连接时演示模式运行")}
      </span>
    </button>
  );
}
