import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { Contract } from "ethers";
import { playBeep, startDeterrentAudio, stopDeterrentAudio, isDeterrentPlaying_ } from "@/lib/audio";
import { addSOSHistory } from "@/lib/localStorage";
import { recordEmergencyMapAlert, reportZone } from "@/lib/geoAlert";
import { canPublishMapAlert } from "@/lib/reportTrust";
import { useOfflineBuffer } from "@/hooks/useOfflineBuffer";
import { shortenHash } from "@/hooks/useWallet";
import { AppLanguage, copyFor } from "@/lib/locale";
import { toast } from "sonner";

type SOSState = "idle" | "pressing" | "loading" | "success" | "offline";
const LOGO_SRC = "/sos-button-logo-cutout.png";

interface SOSButtonProps {
  contract: Contract | null;
  isWalletConnected: boolean;
  isCorrectNetwork: boolean;
  isSilent: boolean;
  voiceDeterrent: boolean;
  customAudioUrl: string | null;
  language: AppLanguage;
}

export default function SOSButton({
  contract,
  isWalletConnected,
  isCorrectNetwork,
  isSilent,
  voiceDeterrent,
  customAudioUrl,
  language,
}: SOSButtonProps) {
  const [state, setState] = useState<SOSState>("idle");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSafeButton, setShowSafeButton] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number>(0);
  const { addRecord } = useOfflineBuffer();

  const HOLD_DURATION = 3000;

  const triggerSOS = useCallback(async () => {
    setState("loading");

    if (!isSilent) {
      playBeep();
      const flashEl = document.getElementById("screen-flash");
      if (flashEl) {
        flashEl.classList.add("screen-flash");
        flashEl.style.opacity = "0.5";
        setTimeout(() => {
          flashEl.classList.remove("screen-flash");
          flashEl.style.opacity = "0";
        }, 300);
      }
    }

    let lat = 0, lng = 0;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // fallback to 0,0
    }

    const latInt = Math.round(lat * 1_000_000);
    const lngInt = Math.round(lng * 1_000_000);

    addSOSHistory({
      latitude: latInt,
      longitude: lngInt,
      timestamp: Math.floor(Date.now() / 1000),
      status: "pending",
    });

    // Start deterrent audio if sound is on
    if (voiceDeterrent && !isSilent) {
      startDeterrentAudio(customAudioUrl, language);
      setShowSafeButton(true);
    }

    const canPublish = canPublishMapAlert();
    if (lat !== 0 || lng !== 0) {
      recordEmergencyMapAlert(lat, lng);
    }

    if (canPublish && (lat !== 0 || lng !== 0)) {
      void reportZone(lat, lng, "emergency");
    }

    if (contract && isWalletConnected && isCorrectNetwork && canPublish) {
      try {
        if (!isSilent) toast(copyFor(language, "Uploading on-chain...", "正在上链..."));
        const tx = await contract.triggerSOS(latInt, lngInt, "");
        const receipt = await tx.wait();
        const hash = receipt.hash || tx.hash;
        setTxHash(hash);
        setState("success");

        addSOSHistory({
          latitude: latInt,
          longitude: lngInt,
          timestamp: Math.floor(Date.now() / 1000),
          txHash: hash,
          status: "success",
        });

        if (!isSilent) toast.success(copyFor(language, "✅ Evidence secured", "✅ 已安全存证"));
        return;
      } catch {
        // Fall through to offline
      }
    }

    addRecord(lat, lng);
    setState("offline");
    if (!isSilent) {
      toast(canPublish
        ? copyFor(language, "⚠️ Saved locally. Waiting for network recovery.", "⚠️ 已本地存储，等待网络恢复")
        : copyFor(
            language,
            "Saved privately. Public map alert needs stronger account trust.",
            "已私密保存。公开地图预警需要更高账户可信度。"
          ));
    }
  }, [contract, isWalletConnected, isCorrectNetwork, isSilent, voiceDeterrent, customAudioUrl, addRecord, language]);

  const handlePointerDown = useCallback(() => {
    if (state === "loading" || state === "success") return;
    setState("pressing");
    setProgress(0);
    setCountdown(3);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / HOLD_DURATION, 1);
      setProgress(pct);
      setCountdown(Math.max(0, 3 - Math.floor(elapsed / 1000)));

      if (pct >= 1) {
        clearInterval(intervalRef.current);
        triggerSOS();
      }
    }, 30);
  }, [state, triggerSOS]);

  const handlePointerUp = useCallback(() => {
    if (state === "pressing") {
      clearInterval(intervalRef.current);
      setState("idle");
      setProgress(0);
      setCountdown(3);
    }
  }, [state]);

  const handleSafe = () => {
    stopDeterrentAudio();
    setShowSafeButton(false);
    setState("idle");
    setProgress(0);
    setTxHash(null);
  };

  const resetAfterDelay = () => {
    setTimeout(() => {
      if (!isDeterrentPlaying_()) {
        setState("idle");
        setProgress(0);
        setTxHash(null);
      }
    }, 8000);
  };

  if (state === "success" || state === "offline") {
    resetAfterDelay();
  }

  const glowClass = {
    idle: "drop-shadow-[0_0_34px_hsl(var(--sos-glow))]",
    pressing: "drop-shadow-[0_0_34px_hsl(var(--sos-pressing-glow))]",
    loading: "drop-shadow-[0_0_34px_hsl(var(--sos-glow))]",
    success: "drop-shadow-[0_0_34px_hsl(var(--sos-success-glow))]",
    offline: "drop-shadow-[0_0_28px_hsl(45_93%_58%/0.3)]",
  }[state];

  return (
    <div className="flex w-full flex-col items-center justify-center px-1">
      <div
        id="screen-flash"
        className="pointer-events-none fixed inset-0 z-[100] bg-primary opacity-0 transition-opacity"
      />

      <motion.button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`relative aspect-square w-[80vw] max-w-[360px] select-none overflow-visible rounded-[2rem] bg-transparent ${glowClass} transition-colors duration-500`}
        whileTap={state === "idle" ? { scale: 0.95 } : {}}
        style={{ touchAction: "none" }}
      >
        <img
          src={LOGO_SRC}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 object-contain opacity-100 drop-shadow-[0_0_42px_hsl(320_100%_78%/0.26)] [filter:saturate(1.16)_contrast(1.05)_brightness(1.04)]"
        />

        {state === "pressing" && (
          <svg className="absolute inset-0 z-20 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--foreground) / 0.15)" strokeWidth="3" />
            <motion.circle
              cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3"
              strokeLinecap="round" strokeDasharray={289} strokeDashoffset={289 * (1 - progress)}
            />
          </svg>
        )}

        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex h-full w-full items-center justify-center">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black tracking-[0.2em] text-primary-foreground drop-shadow-[0_3px_18px_hsl(246_64%_8%/0.55)] [text-indent:0.2em]">
                  SOS
                </span>
                <span className="absolute bottom-[22%] left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-bold text-primary-foreground/90 drop-shadow-[0_2px_10px_hsl(246_64%_8%/0.35)]">
                  {copyFor(language, "Emergency Report", "紧急上报")}
                </span>
              </motion.div>
            )}
            {state === "pressing" && (
              <motion.div key="pressing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                <span className="text-7xl font-black text-primary-foreground">{countdown}</span>
                <span className="text-sm text-primary-foreground/80">{Math.round(progress * 100)}%</span>
              </motion.div>
            )}
            {state === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <Loader2 className="h-14 w-14 animate-spin text-primary-foreground" />
                <span className="text-sm font-medium text-primary-foreground/80">
                  {copyFor(language, "Uploading...", "正在上链...")}
                </span>
              </motion.div>
            )}
            {state === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <Check className="h-16 w-16 text-primary-foreground" strokeWidth={3} />
                <span className="text-lg font-bold text-primary-foreground">
                  {copyFor(language, "Secured", "已安全存证")}
                </span>
                {txHash && (
                  <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-primary-foreground/70 underline" onClick={(e) => e.stopPropagation()}>
                    {shortenHash(txHash)}
                  </a>
                )}
              </motion.div>
            )}
            {state === "offline" && (
              <motion.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <AlertTriangle className="h-14 w-14 text-background" />
                <span className="text-base font-bold text-background">
                  {copyFor(language, "Saved Offline", "已本地存储")}
                </span>
                <span className="text-xs text-background/70">
                  {copyFor(language, "Waiting for network", "等待网络恢复")}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {state === "idle" && copyFor(language, "Hold for 3 seconds", "长按 3 秒触发")}
        {state === "pressing" && copyFor(language, "Keep holding", "继续按住...")}
        {state === "loading" && copyFor(language, "Getting location and uploading", "正在获取位置并上链")}
        {state === "success" && copyFor(language, "Report secured", "存证已完成并安全保存")}
        {state === "offline" && copyFor(language, "Offline, saved locally", "离线，数据已暂存本地")}
      </p>

      <AnimatePresence>
        {showSafeButton && (
          <motion.button
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onClick={handleSafe}
            className="mt-6 rounded-full bg-sos-success px-8 py-3 text-base font-bold text-primary-foreground"
          >
            {copyFor(language, "I'm Safe", "我已安全")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
