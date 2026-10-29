import { ArrowRight, ShieldCheck } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { strings } from "@/lib/strings";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const s = strings.onboarding;
  return (
    <div>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h1 className="text-[28px]">{s.welcomeTitle}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-fg-2">{s.welcomeBody}</p>
      <div className="mt-8 flex justify-end">
        <GlassButton variant="primary" size="lg" onClick={onNext} data-autofocus>
          {s.start}
          <ArrowRight className="h-4 w-4" />
        </GlassButton>
      </div>
    </div>
  );
}
