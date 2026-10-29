import { motion, type HTMLMotionProps } from "motion/react";
import type { CSSProperties, PointerEvent, Ref } from "react";
import { cn } from "@/lib/format";
import { useSpecular } from "./useSpecular";

export interface GlassSurfaceProps extends HTMLMotionProps<"div"> {
  ref?: Ref<HTMLDivElement>;
  /** Corner radius in px. Defaults to the card radius (16). */
  radius?: number;
  /** SVG displacement refraction. Never on items inside scrolling lists. */
  refract?: boolean;
  /** Cheaper blur for many items in a grid. */
  lite?: boolean;
  /** Denser fill for text-heavy surfaces (keeps AA contrast). */
  solid?: boolean;
  /** Hover fill + cursor sheen. */
  interactive?: boolean;
  /** Override the glass fill with one of the greyscale note shades. */
  fill?: string;
}

/** Base liquid-glass element. All glass primitives are built on this. */
export function GlassSurface({
  radius,
  refract,
  lite,
  solid,
  interactive,
  fill,
  className,
  style,
  children,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: GlassSurfaceProps) {
  const sheen = useSpecular<HTMLDivElement>();
  const mergedStyle = {
    ...(style as object),
    "--glass-radius": radius ? `${radius}px` : undefined,
    ...(fill ? { "--glass-fill": fill, "--glass-fill-hover": fill } : {}),
  } as CSSProperties;

  return (
    <motion.div
      {...rest}
      className={cn(
        "glass",
        refract && "glass--refract",
        lite && "glass--lite",
        solid && "glass--solid",
        interactive && "glass--interactive",
        className,
      )}
      style={mergedStyle as HTMLMotionProps<"div">["style"]}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        if (interactive) sheen.onPointerMove(e);
        onPointerMove?.(e);
      }}
      onPointerEnter={(e: PointerEvent<HTMLDivElement>) => {
        if (interactive) sheen.onPointerEnter(e);
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e: PointerEvent<HTMLDivElement>) => {
        if (interactive) sheen.onPointerLeave(e);
        onPointerLeave?.(e);
      }}
    >
      <span className="glass-backdrop" aria-hidden="true" />
      <span className="glass-sheen" aria-hidden="true" />
      {children as React.ReactNode}
    </motion.div>
  );
}
