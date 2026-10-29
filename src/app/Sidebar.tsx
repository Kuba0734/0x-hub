import { motion } from "motion/react";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { GlassPanel, GlassTooltip } from "@/components/glass";
import { spring } from "@/components/motion/presets";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { navItems, playgroundItem, sectionOf, type NavItem } from "./nav";

function NavEntry({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.path}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors duration-150",
        active ? "text-fg" : "text-fg-2 hover:text-fg",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={spring}
          className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.09] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
        />
      )}
      <Icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      {!collapsed && (
        <motion.span
          className="relative truncate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.06 }}
        >
          {item.label}
        </motion.span>
      )}
    </NavLink>
  );
  return collapsed ? (
    <GlassTooltip label={item.label} side="right">
      {link}
    </GlassTooltip>
  ) : (
    link
  );
}

/** Collapsible glass sidebar with a sliding active indicator. */
export function Sidebar() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const setCollapsed = useUi((s) => s.setSidebarCollapsed);
  const startCollapsed = useSettings((s) => s.settings?.sidebarCollapsed);

  useEffect(() => {
    if (startCollapsed !== undefined) setCollapsed(startCollapsed);
  }, [startCollapsed, setCollapsed]);

  const items = import.meta.env.DEV ? [...navItems, playgroundItem] : navItems;

  return (
    <GlassPanel
      layout
      transition={spring}
      radius={20}
      className={cn("m-3 mr-0 flex shrink-0 flex-col p-2", collapsed ? "w-[60px]" : "w-[216px]")}
    >
      <nav aria-label={strings.nav.navLabel} className="flex flex-col gap-1">
        {items.map((item) => (
          <NavEntry
            key={item.path}
            item={item}
            active={section === item.path}
            collapsed={collapsed}
          />
        ))}
      </nav>
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? strings.nav.expand : strings.nav.collapse}
          aria-expanded={!collapsed}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] text-fg-3 hover:bg-white/[0.05] hover:text-fg-2"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          )}
          {!collapsed && <span>{strings.nav.collapse}</span>}
        </button>
      </div>
    </GlassPanel>
  );
}
