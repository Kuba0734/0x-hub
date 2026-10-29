import { motion } from "motion/react";
import { NavLink, useParams } from "react-router";
import {
  Archive,
  Bell,
  Info,
  Keyboard,
  Palette,
  PenLine,
  RefreshCw,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { spring, StaggerItem, StaggerList } from "@/components/motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useSettings } from "@/stores/settings";
import { AboutSection } from "./sections/AboutSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { BackupSection } from "./sections/BackupSection";
import { HotkeySection } from "./sections/HotkeySection";
import { IntegritySection } from "./sections/IntegritySection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { SecuritySection } from "./sections/SecuritySection";
import { SignaturesSection } from "./sections/SignaturesSection";
import { UpdatesSection } from "./sections/UpdatesSection";

const s = strings.settings;
const sections = [
  { id: "security", label: s.sections.security, icon: Shield },
  { id: "appearance", label: s.sections.appearance, icon: Palette },
  { id: "notifications", label: s.sections.notifications, icon: Bell },
  { id: "hotkey", label: s.sections.hotkey, icon: Keyboard },
  { id: "backup", label: s.sections.backup, icon: Archive },
  { id: "integrity", label: s.sections.integrity, icon: ShieldCheck },
  { id: "signatures", label: s.sections.signatures, icon: PenLine },
  { id: "updates", label: s.sections.updates, icon: RefreshCw },
  { id: "about", label: s.sections.about, icon: Info },
] as const;

type SectionId = (typeof sections)[number]["id"];

export function SettingsPage() {
  const params = useParams();
  const active: SectionId = sections.some((x) => x.id === params.section)
    ? (params.section as SectionId)
    : "security";
  const settings = useSettings((st) => st.settings);

  const body = (() => {
    if (!settings) return <Skeleton className="h-64 rounded-3xl" />;
    switch (active) {
      case "security":
        return <SecuritySection settings={settings} />;
      case "appearance":
        return <AppearanceSection settings={settings} />;
      case "notifications":
        return <NotificationsSection settings={settings} />;
      case "hotkey":
        return <HotkeySection settings={settings} />;
      case "backup":
        return <BackupSection settings={settings} />;
      case "integrity":
        return <IntegritySection settings={settings} />;
      case "signatures":
        return <SignaturesSection />;
      case "updates":
        return <UpdatesSection />;
      case "about":
        return <AboutSection />;
    }
  })();

  return (
    <div className="flex h-full gap-6 overflow-hidden px-8 pt-7">
      <nav aria-label={s.title} className="flex w-52 shrink-0 flex-col gap-1">
        <h1 className="mb-4 text-[28px]">{s.title}</h1>
        {sections.map((sec) => (
          <NavLink
            key={sec.id}
            to={`/settings/${sec.id}`}
            aria-current={active === sec.id ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] transition-colors",
              active === sec.id ? "text-fg" : "text-fg-2 hover:text-fg",
            )}
          >
            {active === sec.id && (
              <motion.span
                layoutId="settings-active"
                transition={spring}
                className="absolute inset-0 rounded-xl bg-white/[0.08]"
              />
            )}
            <sec.icon className="relative h-4 w-4" />
            <span className="relative">{sec.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto pb-10">
        <StaggerList key={active} className="flex max-w-[720px] flex-col gap-4 pt-14">
          <StaggerItem className="flex flex-col gap-4">{body}</StaggerItem>
        </StaggerList>
      </div>
    </div>
  );
}
