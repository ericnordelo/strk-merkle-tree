import { throwError } from './utils/errors';
import { HexString } from './bytes';
import { paddedHex } from './utils/common';

export type ValueType = 'felt252' | 'ContractAddress' | 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256' | 'bool';

export function serialize(types: ReadonlyArray<ValueType>, values: ReadonlyArray<any>): Array<HexString> {
  if (types.length !== values.length) {
    throwError('types/values length mismatch');
  }
  let ret: string[] = [];
  for (let i = 0; i < types.length; i++) {
    ret = ret.concat(...serialize_single(types[i]!, values[i]));
  }
  return ret;
}

function serialize_single(type: ValueType, value: any): Array<HexString> {
  switch (type) {
    case 'felt252':
    case 'ContractAddress':
    case 'u8':
    case 'u16':
    case 'u32':
    case 'u64':
    case 'u128':
      checkOverflow(value, type);
      return [paddedHex(value)];
    case 'u256':
      checkOverflow(value, type);
      value = paddedHex(value);
      value = BigInt(value);
      // return [low, high]
      return [value & BigInt('0xffffffffffffffffffffffffffffffff'), value >> BigInt(128)].map(bint =>
        paddedHex(bint.toString(16)),
      );
    case 'bool':
      return [value ? '0x01' : '0x00'];
    default:
      throwError(`Unknown type '${type}' while serializing`);
  }
}

function checkOverflow(value: any, type: ValueType) {
  value = BigInt(value);
  let max;
  switch (type) {
    case 'felt252':
    case 'ContractAddress':
      max = 2n ** 251n + 17n * 2n ** 192n;
      break;
    case 'u8':
      max = 255n;
      break;
    case 'u16':
      max = 2n ** 16n - 1n;
      break;
    case 'u32':
      max = 2n ** 32n - 1n;
      break;
    case 'u64':
      max = 2n ** 64n - 1n;
      break;
    case 'u128':
      max = 2n ** 128n - 1n;
      break;
    case 'u256':
      max = 2n ** 256n - 1n;
      break;
    default:
      throwError(`Unknown type '${type}' while asserting range`);
  }

  if (value > max) {
    throwError(`Value is too large for type ${type}`);
  }
}
