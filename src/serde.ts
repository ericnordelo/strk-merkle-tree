import { throwError } from './utils/errors';
import { HexString, toHex } from './bytes';

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
      return [toHex(value, { allowMissingPrefix: true, hexPad: 'left' })];
    case 'bool':
      return [value ? '0x01' : '0x00'];
    default:
      throwError(`Unknown type '${type}' while serializing`);
  }
}
