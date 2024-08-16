import { hash } from 'starknet';
import { BytesLike, HexString, compare, toHex } from './bytes';
import { ValueType, serialize } from './serde';

export type LeafHash<T> = (leaf: T) => HexString;
export type NodeHash = (left: BytesLike, right: BytesLike) => HexString;

export function poseidonLeafHash<T extends any[]>(types: ValueType[], value: T): HexString {
  return toHex(hash.computePoseidonHashOnElements([hash.computePoseidonHashOnElements(serialize(types, value))]), {
    hexPad: 'left',
  });
}

export function poseidonNodeHash(a: BytesLike, b: BytesLike): HexString {
  const sorted = [a, b].sort(compare).map(x => toHex(x, { hexPad: 'left' }));
  return toHex(hash.computePoseidonHashOnElements(sorted).toString(), { hexPad: 'left' });
}

export function standardLeafHash<T extends any[]>(types: ValueType[], value: T): HexString {
  return toHex(hash.computePedersenHash(0, hash.computeHashOnElements(serialize(types, value))), { hexPad: 'left' });
}

export function standardNodeHash(a: BytesLike, b: BytesLike): HexString {
  const sorted = [a, b].sort(compare).map(x => toHex(x, { hexPad: 'left' }));
  return toHex(hash.computeHashOnElements(sorted).toString(), { hexPad: 'left' });
}
