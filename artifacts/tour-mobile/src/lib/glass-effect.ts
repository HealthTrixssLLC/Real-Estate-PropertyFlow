// Bare RN has no liquid-glass tab bar primitive; always fall back to the
// classic tab layout. The original (tabs)/_layout.tsx branched on this.
export function isLiquidGlassAvailable(): boolean {
  return false;
}
