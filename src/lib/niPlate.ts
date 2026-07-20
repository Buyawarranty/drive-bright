// Northern Ireland plate detection.
// Format: 3 letters + 1-4 digits, where the letter block contains I or Z.
export function isNorthernIrelandPlate(reg?: string | null): boolean {
  if (!reg) return false;
  const clean = reg.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{3}\d{1,4}$/.test(clean)) return false;
  return /[IZ]/.test(clean.slice(0, 3));
}
