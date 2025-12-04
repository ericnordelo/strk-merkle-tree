import { toHex } from '../bytes';

export function paddedHex(value: string | number | bigint): string {
  // Convert to BigInt first so decimal strings are interpreted correctly.
  return toHex(BigInt(value), { hexPad: 'left' });
}
