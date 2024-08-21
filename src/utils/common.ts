import { toHex } from '../bytes';

export function paddedHex(value: string): string {
  return toHex(value, { allowMissingPrefix: true, hexPad: 'left' });
}
