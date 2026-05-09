import { Switch } from "@/components/ui/switch";
import { AppLanguage, copyFor } from "@/lib/locale";

interface TopBarTogglesProps {
  soundOn: boolean;
  onToggleSound: () => void;
  language: AppLanguage;
}

export default function TopBarToggles({
  soundOn,
  onToggleSound,
  language,
}: TopBarTogglesProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card/80 px-2.5 py-1.5 text-xs text-muted-foreground">
        <span>
          {soundOn
            ? copyFor(language, "📢 Sound", "📢 威慑")
            : copyFor(language, "🔇 Silent", "🔇 静音")}
        </span>
        <Switch checked={soundOn} onCheckedChange={onToggleSound} />
      </label>
    </div>
  );
}
