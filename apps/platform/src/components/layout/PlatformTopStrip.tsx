/**
 * Unmissable top visual cue across the entire viewport.
 * Staff will NEVER confuse the Platform panel with a tenant admin panel.
 */
export function PlatformTopStrip() {
  return (
    <div className="relative w-full z-50">
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-[0_1px_8px_rgba(245,158,11,0.35)]" />
    </div>
  );
}
