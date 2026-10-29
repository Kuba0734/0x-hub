/** Slow, low-contrast grey blobs behind the glass. CSS keyframes, transform only. */
export function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-blob ambient-blob--a" />
      <div className="ambient-blob ambient-blob--b" />
      <div className="ambient-blob ambient-blob--c" />
    </div>
  );
}
