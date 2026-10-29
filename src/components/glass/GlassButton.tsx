import type { HTMLMotionProps } from "motion/react";
import type { ReactNode, Ref } from "react";
import { Pressable } from "@/components/motion/Pressable";
import { cn } from "@/lib/format";
import { useSpecular } from "./useSpecular";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  ref?: Ref<HTMLButtonElement>;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Icon-only buttons must pass `aria-label`. */
  iconOnly?: boolean;
  children?: ReactNode;
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-[14px] gap-2",
  lg: "h-11 px-5 text-[14px] gap-2",
};

const iconSizes: Record<Size, string> = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-11 w-11" };

const variants: Record<Variant, string> = {
  // Primary: white fill, black text.
  primary:
    "bg-white text-black shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_rgba(0,0,0,0.5)] hover:bg-white/90",
  secondary: "glass glass--interactive text-fg",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/[0.06]",
};

export function GlassButton({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  className,
  children,
  disabled,
  ...rest
}: GlassButtonProps) {
  const sheen = useSpecular<HTMLButtonElement>();
  return (
    <Pressable
      {...rest}
      {...(variant === "secondary" ? sheen : {})}
      disabled={disabled}
      style={
        {
          ...(rest.style as object),
          "--glass-radius": "999px",
        } as HTMLMotionProps<"button">["style"]
      }
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium whitespace-nowrap",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        iconOnly ? iconSizes[size] : sizes[size],
        variants[variant],
        className,
      )}
    >
      {variant === "secondary" && (
        <>
          <span className="glass-backdrop" aria-hidden="true" />
          <span className="glass-sheen" aria-hidden="true" />
        </>
      )}
      {icon && <span className="flex shrink-0 items-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {!iconOnly && (
        <span className="flex min-w-0 items-center gap-2 [&>svg]:h-4 [&>svg]:w-4">{children}</span>
      )}
    </Pressable>
  );
}
