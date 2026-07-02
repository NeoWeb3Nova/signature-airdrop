export const AIRDROP_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'round', type: 'uint256' },
      { name: 'amountOrTokenId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'currentRound',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimed',
    stateMutability: 'view',
    inputs: [
      { name: 'round', type: 'uint256' },
      { name: 'tokenType', type: 'uint8' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;
