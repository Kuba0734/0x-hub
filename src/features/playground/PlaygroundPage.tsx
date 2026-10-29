import { useState, type ReactNode } from "react";
import { Copy, Pin, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  GlassButton,
  GlassCard,
  GlassContextMenu,
  GlassDialog,
  GlassInput,
  GlassPanel,
  GlassSelect,
  GlassSlider,
  GlassToggle,
  GlassTooltip,
} from "@/components/glass";
import { AnimatedNumber, Pressable, StaggerItem, StaggerList } from "@/components/motion";
import { AnimatedCheck } from "@/components/ui/AnimatedCheck";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";

const p = strings.playground;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GlassPanel className="p-6">
      <h2 className="mb-4 text-[16px]">{title}</h2>
      {children}
    </GlassPanel>
  );
}

/** Dev-only: every glass primitive and motion pattern for design review. */
export function PlaygroundPage() {
  const [dialog, setDialog] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [check, setCheck] = useState(false);
  const [slider, setSlider] = useState(0.6);
  const [num, setNum] = useState(1284);
  const [select, setSelect] = useState("a");
  const [replay, setReplay] = useState(0);

  return (
    <div className="h-full overflow-y-auto px-8 pt-7 pb-10">
      <h1 className="text-[28px]">{p.title}</h1>
      <p className="mt-1 text-[13px] text-fg-2">{p.subtitle}</p>
      <div className="mt-6 grid grid-cols-2 gap-5">
        <Block title={p.buttons}>
          <div className="flex flex-wrap gap-2">
            <GlassButton variant="primary" icon={<Plus />}>
              {p.primary}
            </GlassButton>
            <GlassButton icon={<Sparkles />}>{p.secondary}</GlassButton>
            <GlassButton variant="ghost">{p.ghost}</GlassButton>
            <GlassButton disabled>{p.disabled}</GlassButton>
            <GlassButton iconOnly aria-label={strings.common.copy} icon={<Copy />} />
            <Pressable className="h-9 rounded-full border border-dashed border-white/30 px-4 text-[13px]">
              Pressable
            </Pressable>
          </div>
        </Block>

        <Block title={p.inputs}>
          <div className="flex flex-col gap-4">
            <GlassInput label={p.inputLabel} placeholder={p.inputPlaceholder} />
            <GlassToggle label={p.toggleLabel} checked={toggle} onChange={setToggle} />
            <GlassSlider
              label={p.sliderLabel}
              value={slider}
              min={0}
              max={1}
              onChange={setSlider}
            />
            <div className="flex items-center gap-3">
              <AnimatedCheck checked={check} onChange={setCheck} label={p.toggleLabel} />
              <GlassSelect
                label={p.sliderLabel}
                value={select}
                onChange={setSelect}
                options={[
                  { value: "a", label: "Option A" },
                  { value: "b", label: "Option B" },
                ]}
              />
            </div>
            <ProgressBar value={slider} label={p.sliderLabel} />
          </div>
        </Block>

        <Block title={p.surfaces}>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <GlassCard
                key={n}
                hoverable
                className="flex h-24 items-center justify-center text-[13px] text-fg-2"
              >
                {p.card(n)}
              </GlassCard>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
          </div>
        </Block>

        <Block title={p.overlays}>
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton onClick={() => setDialog(true)}>{p.openDialog}</GlassButton>
            <GlassButton onClick={() => toast.show(p.toastSample)}>{p.showToast}</GlassButton>
            <GlassTooltip label={p.tooltipSample}>
              <GlassButton variant="ghost">{p.hoverMe}</GlassButton>
            </GlassTooltip>
            <GlassContextMenu
              items={[
                { label: strings.common.pin, icon: <Pin />, onSelect: () => {} },
                { label: strings.common.copy, icon: <Copy />, onSelect: () => {} },
                {
                  label: strings.common.delete,
                  icon: <Trash2 />,
                  danger: true,
                  onSelect: () => {},
                },
              ]}
            >
              <div className="rounded-xl border border-dashed border-white/25 px-4 py-2 text-[13px] text-fg-2">
                {p.rightClickMe}
              </div>
            </GlassContextMenu>
          </div>
        </Block>

        <Block title={p.motion}>
          <div className="flex items-center gap-4">
            <AnimatedNumber value={num} className="text-[40px] font-semibold tracking-[-0.03em]" />
            <GlassButton size="sm" onClick={() => setNum(Math.round(Math.random() * 10000))}>
              {p.shuffle}
            </GlassButton>
            <GlassButton size="sm" onClick={() => setReplay((r) => r + 1)}>
              {p.restagger}
            </GlassButton>
          </div>
          <StaggerList key={replay} className="mt-4 grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <StaggerItem key={i}>
                <div className="h-10 rounded-xl border border-line bg-white/[0.06]" />
              </StaggerItem>
            ))}
          </StaggerList>
        </Block>
      </div>

      <GlassDialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={p.openDialog}
        description={p.dialogBody}
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setDialog(false)}>
              {strings.common.cancel}
            </GlassButton>
            <GlassButton variant="primary" onClick={() => setDialog(false)}>
              {strings.common.confirm}
            </GlassButton>
          </>
        }
      />
    </div>
  );
}
