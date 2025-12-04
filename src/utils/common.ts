import { toHex } from '../bytes';

export function paddedHex(value: string | number | bigint): string {
  // Accept decimal strings, hex strings (with or without 0x), or numeric inputs.
  if (typeof value === 'string') {
    const str = value.trim();
    const isHex = str.startsWith('0x') || /[a-fA-F]/.test(str);
    const bigintValue = isHex ? BigInt(str.startsWith('0x') ? str : `0x${str}`) : BigInt(str);
    return toHex(bigintValue, { hexPad: 'left' });
  }

  return toHex(BigInt(value), { hexPad: 'left' });
}
