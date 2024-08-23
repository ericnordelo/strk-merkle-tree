# `@ericnordelo/strk-merkle-tree`

**A JavaScript library to generate merkle trees and merkle proofs based on [`@openzeppelin/merkle-tree`].**

Well suited for airdrops and similar mechanisms in combination with OpenZeppelin Cairo Contracts [`merkle_proof`] utilities.

[`merkle_proof`]: https://docs.openzeppelin.com/contracts-cairo
[`@openzeppelin/merkle-tree`]: https://github.com/OpenZeppelin/merkle-tree

## Quick Start

```
npm install @ericnordelo/strk-merkle-tree
```

### Building a Tree

```js
import { StandardMerkleTree } from "@ericnordelo/strk-merkle-tree";
import fs from "fs";

// (1)
const values = [
  ["0x1111111111111111111111111111111111111111", "5000000000000000000"],
  ["0x2222222222222222222222222222222222222222", "2500000000000000000"]
];

// (2)
const tree = StandardMerkleTree.of(values, ["ContractAddress", "u128"]);

// (3)
console.log('Merkle Root:', tree.root);

// (4)
fs.writeFileSync("tree.json", JSON.stringify(tree.dump()));
```

1. Get the values to include in the tree. (Note: Consider reading them from a file.)
2. Build the merkle tree. Set the types to match the values (for serialization purposes).
3. Print the merkle root. You will probably publish this value on chain in a smart contract.
4. Write a file that describes the tree. You will distribute this to users so they can generate proofs for values in the tree.

### Obtaining a Proof

Assume we're looking to generate a proof for the entry that corresponds to address `0x11...11`.

```js
import { StandardMerkleTree } from "@ericnordelo/strk-merkle-tree";
import fs from "fs";

// (1)
const tree = StandardMerkleTree.load(JSON.parse(fs.readFileSync("tree.json", "utf8")));

// (2)
for (const [i, v] of tree.entries()) {
  if (v[0] === '0x1111111111111111111111111111111111111111') {
    // (3)
    const proof = tree.getProof(i);
    console.log('Value:', v);
    console.log('Proof:', proof);
  }
}
```

1. Load the tree from the description that was generated previously.
2. Loop through the entries to find the one you're interested in.
3. Generate the proof using the index of the entry.

In practice this might be done in a frontend application prior to submitting the proof on-chain, with the address looked up being that of the connected wallet.

### Validating a Proof in Cairo

Once the proof has been generated, it can be validated in Cairo using [`openzeppelin_merkle_proof`] as in the following example:

```javascript
#[starknet::contract]
pub mod Verifier {
    use openzeppelin_utils::cryptography::merkle_proof::verify;
    use openzeppelin_utils::cryptography::hashes::PedersenCHasher;
    use core::hash::{HashStateTrait, HashStateExTrait};
    use core::pedersen::{PedersenTrait, pedersen};
    use starknet::ContractAddress;

    #[storage]
    struct Storage {
        Verifier_root: felt252
    }

    #[constructor]
    fn constructor(ref self: ContractState, root: felt252) {
        self.Verifier_root.write(root);
    }

    #[generate_trait]
    #[abi(per_item)]
    impl ExternalImpl of ExternalTrait {
        #[external(v0)]
        fn verify(
            self: @ContractState, proof: Span<felt252>, address: ContractAddress, value: u128
        ) {
            // Leaves hashes and internal nodes hashes are computed differently
            // to avoid second pre-image attacks.
            let leaf_hash = _leaf_hash(address, value);

            assert(
                verify::<PedersenCHasher>(proof, leaf_hash, self.Verifier_root.read()),
                'Verifier: invalid proof'
            );
        }
    }

    fn _leaf_hash(address: ContractAddress, value: u128) -> felt252 {
        // Opinionated leaf hash function
        let hash_state = PedersenTrait::new(0);
        pedersen(0, hash_state.update_with(address).update_with(value).update_with(2).finalize())
    }
}
```

1. Store the tree root in your contract.
2. Compute the [leaf hash](#leaf-hash) for the provided `address` and `value` serialized values.
3. Verify it using [`merkle_proof`]'s `verify` function.
4. Use the verification to make further operations on the contract. (Consider you may want to add a mechanism to prevent reuse of a leaf).

## Standard Merkle Trees

This library works on "standard" merkle trees designed for Starknet smart contracts. We have defined them with a few characteristics that make them secure and good for on-chain verification.

- The tree is shaped as a [complete binary tree](https://xlinux.nist.gov/dads/HTML/completeBinaryTree.html).
- The leaves are sorted.
- The leaves are the result of serializing a series of values.
- The hash used is Pedersen by default.
- The leaves are double-hashed[^1] to prevent [second preimage attacks].

[second preimage attacks]: https://flawed.net.nz/2018/02/21/attacking-merkle-trees-with-a-second-preimage-attack/

## Simple Merkle Trees

The library also supports "simple" merkle trees, which are a simplified version of the standard ones. They are designed to be more flexible and accept arbitrary `felt252` data as leaves. It keeps the same tree shape and internal pair hashing algorithm.

As opposed to standard trees, leaves are not double-hashed. Instead they are hashed in pairs inside the tree. This is useful to override the leaf hashing algorithm and use a different one prior to building the tree.

Users of tooling that produced trees without double leaf hashing can use this feature to build a representation of the tree in JavaScript. We recommend this approach exclusively for trees that are already built on-chain. Otherwise the standard tree may be a better fit.

```typescript
import { SimpleMerkleTree } from '@ericnordelo/strk-merkle-tree';
import { hash } from 'starknet';

// (1)
const tree = SimpleMerkleTree.of([
  hash.computePoseidonHashOnElements([1, 2]),
  hash.computePoseidonHashOnElements([3, 4])
]);

// (2)
// ...
```

1. Use a custom leaf hashing algorithm to produce `felt252` values for the tree.
2. The Simple Merkle Tree share the same API as Standard Merkle Tree.

## Advanced usage

### Leaf Hash

The Standard Merkle Tree uses an opinionated double leaf hashing algorithm. For example, a leaf in the tree with value `[addr, value]` can be computed in Cairo as follows:

```javascript
let leaf_hash = pedersen(0, hash_state
  .update_with(addr)
  .update_with(value)
  .update(2)
  .finalize()
)
```

This is an opinionated design that we believe will offer the best out of the box experience for most users. However, there are advanced use case where a different leaf hashing algorithm may be needed. For those, the `SimpleMerkleTree` can be used to build a tree with custom leaf hashing.

### Leaf ordering

Each leaf of a merkle tree can be proven individually. The relative ordering of leaves is mostly irrelevant when the only objective is to prove the inclusion of individual leaves in the tree. Proving multiple leaves at once is however a little bit more difficult.

This library proposes a mechanism to prove (and verify) that sets of leaves are included in the tree. These "multiproofs" can also be verified onchain using the implementation available in `openzeppelin_utils`. This mechanism requires the leaves to be ordered respective to their position in the tree. For example, if the tree leaves are (in hex form) `[ 0xAA...AA, 0xBB...BB, 0xCC...CC, 0xDD...DD]`, then you'd be able to prove `[0xBB...BB, 0xDD...DD]` as a subset of the leaves, but not `[0xDD...DD, 0xBB...BB]`.

Since this library knows the entire tree, you can generate a multiproof with the requested leaves in any order. The library will re-order them so that they appear inside the proof in the correct order. The `MultiProof` object returned by `tree.getMultiProof(...)` will have the leaves ordered according to their position in the tree, and not in the order in which you provided them.

By default, the library orders the leaves according to their hash when building the tree. This is so that a smart contract can build the hashes of a set of leaves and order them correctly without any knowledge of the tree itself. Said differently, it is simpler for a smart contract to process a multiproof for leaves that it rebuilt itself if the corresponding tree is ordered.

However, some trees are constructed iteratively from unsorted data, causing the leaves to be unsorted as well. For this library to be able to represent such trees, the call to `StandardMerkleTree.of` includes an option to disable sorting. Using that option, the leaves are kept in the order in which they were provided. Note that this option has no effect on your ability to generate and verify proofs and multiproofs in JavaScript, but that it may introduce challenges when verifying multiproofs onchain. We recommend only using it for building a representation of trees that are built (onchain) using an iterative process.

## API & Examples

> **Note**
> Consider reading the array of elements from a CSV file for easy interoperability with spreadsheets or other data processing pipelines.

> **Note**
> By default, leaves are sorted according to their hash. This is done so that multiproof generated by the library can more easily be verified onchain. This can be disabled using the optional third argument. See the [Leaf ordering](#leaf-ordering) section for more details.

### `StandardMerkleTree`

```typescript
import { StandardMerkleTree } from "@ericnordelo/strk-merkle-tree";
```

#### `StandardMerkleTree.of`

```typescript
const tree = StandardMerkleTree.of([[alice, '100'], [bob, '200']], ['ContractAddress', 'u8'], options);
```

Creates a standard merkle tree out of an array of the elements in the tree, along with their types for serialization.

#### `StandardMerkleTree.load`

```typescript
StandardMerkleTree.load(JSON.parse(fs.readFileSync('tree.json', 'utf8')));
```

Loads the tree from a description previously returned by `tree.dump`.

#### `StandardMerkleTree.verify`

```typescript
const verified = StandardMerkleTree.verify(root, ['ContractAddress', 'u8'], [alice, '100'], proof);
```

Returns a boolean that is `true` when the proof verifies that the value is contained in the tree given only the proof, merkle root, and encoding.

#### `StandardMerkleTree.verifyMultiProof`

```typescript
const isValid = StandardMerkleTree.verifyMultiProof(root, leafEncoding, multiproof);
```

Returns a boolean that is `true` when the multiproof verifies that all the values are contained in the tree given only the multiproof, merkle root, and leaf encoding.

### `SimpleMerkleTree`

```typescript
import { SimpleMerkleTree } from '@ericnordelo/strk-merkle-tree';
```

#### `SimpleMerkleTree.of`

```typescript
const tree = SimpleMerkleTree.of([hashFn('Value 1'), hashFn('Value 2')]);
```

The `hashFn` is a custom cryptographic leaf hashing algorithm that returns `felt252` values. The tree will be built using these values as leaves. The function should be different to the internal hashing pair algorithm used by the tree.

#### `SimpleMerkleTree.load`

```typescript
SimpleMerkleTree.load(JSON.parse(fs.readFileSync('tree.json', 'utf8')));
```

Same as `StandardMerkleTree.load`.

#### `SimpleMerkleTree.verify`

```typescript
const verified = SimpleMerkleTree.verify(root, hashFn('Value 1'), proof);
```

Same as `StandardMerkleTree.verify`, but using raw `felt252` values.

#### `SimpleMerkleTree.verifyMultiProof`

```typescript
const isValid = SimpleMerkleTree.verifyMultiProof(root, multiproof);
```

Same as `StandardMerkleTree.verifyMultiProof`.

### Shared API

Both `StandardMerkleTree` and `SimpleMerkleTree` share the same API, defined below.

#### Options

Allows to configure the behavior of the tree. The following options are available:

| Option       | Description                                                                       | Default |
| ------------ | --------------------------------------------------------------------------------- | ------- |
| `sortLeaves` | Enable or disable sorted leaves. Sorting is strongly recommended for multiproofs. | `true`  |

#### `tree.root`

```typescript
console.log(tree.root);
```

The root of the tree is a commitment on the values of the tree. It can be published (e.g., in a smart contract) to later prove that its values are part of the tree.

#### `tree.dump`

```typescript
fs.writeFileSync('tree.json', JSON.stringify(tree.dump()));
```

Returns a description of the merkle tree for distribution. It contains all the necessary information to reproduce the tree, find the relevant leaves, and generate proofs. You should distribute this to users in a web application or command line interface so they can generate proofs for their leaves of interest.

#### `tree.getProof`

```typescript
const proof = tree.getProof(i);
```

Returns a proof for the `i`th value in the tree. Indices refer to the position of the values in the array from which the tree was constructed.

Also accepts a value instead of an index, but this will be less efficient. It will fail if the value is not found in the tree.

```typescript
const proof = tree.getProof(value); // e.g. [alice, '100']
```

#### `tree.getMultiProof`

```typescript
const { proof, proofFlags, leaves } = tree.getMultiProof([i0, i1, ...]);
```

Returns a multiproof for the values at indices `i0, i1, ...`. Indices refer to the position of the values in the array from which the tree was constructed.

The multiproof returned contains an array with the leaves that are being proven. This array may be in a different order than that given by `i0, i1, ...`! The order returned is significant, as it is that in which the leaves must be submitted for verification (e.g., in a smart contract).

Also accepts values instead of indices, but this will be less efficient. It will fail if any of the values is not found in the tree.

```typescript
const proof = tree.getMultiProof([value1, value2]); // e.g. [[alice, '100'], [bob, '200']]
```

#### `tree.verify`

```typescript
tree.verify(i, proof);
tree.verify(value, proof); // e.g. [alice, '100']
```

Returns a boolean that is `true` when the proof verifies that the value is contained in the tree.

#### `tree.verifyMultiProof`

```typescript
tree.verifyMultiProof({ proof, proofFlags, leaves });
```

Returns a boolean that is `true` when the multi-proof verifies that the values are contained in the tree.

#### `tree.entries`

```typescript
for (const [i, v] of tree.entries()) {
  console.log('value:', v);
  console.log('proof:', tree.getProof(i));
}
```

Lists the values in the tree along with their indices, which can be used to obtain proofs.

#### `tree.render`

```typescript
console.log(tree.render());
```

Returns a visual representation of the tree that can be useful for debugging.

#### `tree.leafHash`

```typescript
const leaf = tree.leafHash(value); // e.g. [alice, '100']
```

Returns the leaf hash of the value, defined per tree type.

In case of the `StandardMerkleTree`, it corresponds to the following expression in Cairo:

```javascript
let leaf_hash = pedersen(0, hash_state
  .update_with(alice)
  .update_with(100)
  .update(2)
  .finalize()
)
```

[^1]: The underlying reason for hashing the leaves twice is to prevent using the same algorithm for hashing leaves and internal nodes. Otherwise, the concatenation of a sorted pair of internal nodes in the Merkle tree could be reinterpreted as a leaf value. See [here](https://github.com/OpenZeppelin/openzeppelin-contracts/issues/3091) for more details.
