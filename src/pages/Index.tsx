import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { useSilentMode } from "@/hooks/useSilentMode";
import WalletConnect from "@/components/WalletConnect";
import TopBarToggles from "@/components/TopBarToggles";
import SOSPage from "@/components/SOSPage";
import OfflineBanner from "@/components/OfflineBanner";
import BottomNav from "@/components/BottomNav";
import MapPage from "@/components/MapPage";
import EvidencePage from "@/components/EvidencePage";
import CommunityPage from "@/components/CommunityPage";
import DAOPage from "@/components/DAOPage";
import { useLocale, copyFor } from "@/lib/locale";
import { Shield } from "lucide-react";

const CONTRACT_ADDRESS = "0x79B1A83d803213560BA5AF373FDcE54d1e84f18c";

export default function Index() {
  const [activeTab, setActiveTab] = useState<"sos" | "map" | "evidence" | "community" | "dao">("sos");
  const legacyWalletHook = useWallet(CONTRACT_ADDRESS);
  const solanaWallet = useSolanaWallet();
  const { soundOn, toggleSound, isSilent, voiceDeterrent, customAudioUrl, saveCustomAudio } = useSilentMode();
  const { language, setLanguage } = useLocale();

  const { wallet } = legacyWalletHook;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Top bar — sits below the iOS status bar (safe-area-inset-top handled by body) */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.22)]">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-black text-foreground">The Unmuted</span>
            <span className="block text-[11px] tracking-[0.28em] text-primary/80">
              {copyFor(language, "SAFE. HEARD. PROTECTED.", "安全 发声 守护")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            className="rounded-full border border-border bg-card/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-accent"
          >
            {language === "en" ? "中文" : "EN"}
          </button>
          <TopBarToggles soundOn={soundOn} onToggleSound={toggleSound} language={language} />
          <WalletConnect walletHook={solanaWallet} language={language} />
        </div>
      </header>

      {/* Offline banner */}
      <OfflineBanner
        contract={wallet.contract}
        isWalletConnected={wallet.isConnected}
        isCorrectNetwork={wallet.isCorrectNetwork}
        isSilent={isSilent}
      />

      {/* Main content — pb-20 leaves room for bottom nav + safe-area */}
      <main className="flex flex-1 flex-col overflow-y-auto pb-20">
        {activeTab === "sos" && (
          <SOSPage
            contract={wallet.contract}
            isWalletConnected={wallet.isConnected}
            isCorrectNetwork={wallet.isCorrectNetwork}
            isSilent={isSilent}
            voiceDeterrent={voiceDeterrent}
            customAudioUrl={customAudioUrl}
            saveCustomAudio={saveCustomAudio}
            onAfterReport={() => setActiveTab("evidence")}
            language={language}
          />
        )}
        {activeTab === "map" && <MapPage contract={wallet.contract} language={language} />}
        {activeTab === "evidence" && <EvidencePage language={language} />}
        {activeTab === "community" && <CommunityPage />}
        {activeTab === "dao" && <DAOPage />}
      </main>

      {/* Bottom nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} language={language} />
    </div>
  );
}
