/**
 * Full-area frosted layer (lock screen, drop zone, palette backdrop). Fixed blur radius:
 * animate the parent's opacity, never the blur itself.
 */
export function GlassFrost({ blur = 40, dim = 0.45 }: { blur?: number; dim?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background: `rgba(0,0,0,${dim})`, backdropFilter: `blur(${blur}px) saturate(120%)` }}
    />
  );
}
