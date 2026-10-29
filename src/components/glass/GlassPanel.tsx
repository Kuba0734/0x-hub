import { GlassSurface, type GlassSurfaceProps } from "./GlassSurface";
import { hoverLift, spring } from "@/components/motion/presets";
import { useReduceMotion } from "@/stores/settings";

/** Large surface (sidebar, sections, dialogs): 24px radius, refraction on by default. */
export function GlassPanel({ refract = true, radius = 24, ...rest }: GlassSurfaceProps) {
  return <GlassSurface refract={refract} radius={radius} {...rest} />;
}

interface GlassCardProps extends GlassSurfaceProps {
  /** Lift + scale on hover (for clickable cards). */
  hoverable?: boolean;
}

/** Card: 16px radius, lite blur, optional hover lift with cursor-follow specular. */
export function GlassCard({ hoverable, lite = true, radius = 16, ...rest }: GlassCardProps) {
  const reduce = useReduceMotion();
  return (
    <GlassSurface
      lite={lite}
      radius={radius}
      interactive={hoverable}
      whileHover={hoverable && !reduce ? hoverLift : undefined}
      transition={spring}
      {...rest}
    />
  );
}
