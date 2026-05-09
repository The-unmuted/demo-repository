import { Shield, Map, FileText, Users, Landmark } from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";

interface BottomNavProps {
  activeTab: "sos" | "map" | "evidence" | "community" | "dao";
  onTabChange: (tab: "sos" | "map" | "evidence" | "community" | "dao") => void;
  language: AppLanguage;
}

const tabs = [
  { id: "sos"       as const, english: "Help", chinese: "求助", icon: Shield   },
  { id: "map"       as const, english: "Map", chinese: "地图", icon: Map      },
  { id: "evidence"  as const, english: "Report", chinese: "存证", icon: FileText },
  { id: "community" as const, english: "Circle", chinese: "互助", icon: Users    },
  { id: "dao"       as const, english: "DAO", chinese: "治理", icon: Landmark },
];

export default function BottomNav({ activeTab, onTabChange, language }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors active:scale-95 ${
                isActive ? "text-nav-active" : "text-nav-inactive"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">
                {copyFor(language, tab.english, tab.chinese)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
