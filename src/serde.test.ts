import { test } from '@fast-check/ava';
import { serialize } from './serde';
import { paddedHex } from './utils/common';

const feltP = 2n ** 251n + 17n * 2n ** 192n + 1n;

function bigint_to_hex(n: bigint): string {
  return paddedHex(n.toString(16));
}

test('serialize bool', t => {
  const serialized1 = serialize(['bool'], [true]);
  const serialized2 = serialize(['bool'], [false]);

  t.true(serialized1.length === 1);
  t.true(serialized2.length === 1);
  t.deepEqual(serialized1[0], '0x01');
  t.deepEqual(serialized2[0], '0x00');
});

test('serialize felt252', t => {
  const serialized = serialize(['felt252'], [feltP - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(feltP - 1n));

  t.throws(() => serialize(['felt252'], [feltP]), { message: 'Value is too large for type felt252' });
});

test('serialize ContractAddress', t => {
  const serialized = serialize(['ContractAddress'], [feltP - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(feltP - 1n));

  t.throws(() => serialize(['ContractAddress'], [feltP]), { message: 'Value is too large for type ContractAddress' });
});

test('serialize u256', t => {
  const serialized = serialize(['u256'], [2n ** 128n - 1n + 2n ** 129n]);

  t.true(serialized.length === 2);
  t.deepEqual(serialized[0], bigint_to_hex(2n ** 128n - 1n)); // low
  t.true(serialized[1] === bigint_to_hex(2n)); // high

  t.throws(() => serialize(['u256'], [2n ** 256n]), { message: 'Value is too large for type u256' });
});

test('serialize u128', t => {
  const serialized = serialize(['u128'], [2n ** 128n - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(2n ** 128n - 1n));

  t.throws(() => serialize(['u128'], [2n ** 128n]), { message: 'Value is too large for type u128' });
});

test('serialize u64', t => {
  const serialized = serialize(['u64'], [2n ** 64n - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(2n ** 64n - 1n));

  t.throws(() => serialize(['u64'], [2n ** 64n]), { message: 'Value is too large for type u64' });
});

test('serialize u32', t => {
  const serialized = serialize(['u32'], [2n ** 32n - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(2n ** 32n - 1n));

  t.throws(() => serialize(['u32'], [2n ** 32n]), { message: 'Value is too large for type u32' });
});

test('serialize u16', t => {
  const serialized = serialize(['u16'], [2n ** 16n - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(2n ** 16n - 1n));

  t.throws(() => serialize(['u16'], [2n ** 16n]), { message: 'Value is too large for type u16' });
});

test('serialize u8', t => {
  const serialized = serialize(['u8'], [2n ** 8n - 1n]);

  t.true(serialized.length === 1);
  t.deepEqual(serialized[0], bigint_to_hex(2n ** 8n - 1n));

  t.throws(() => serialize(['u8'], [2n ** 8n]), { message: 'Value is too large for type u8' });
});
