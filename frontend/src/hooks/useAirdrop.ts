import { useCallback, useState } from 'react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { AIRDROP_ABI } from '../abi/airdrop';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
export const AIRDROP_ADDRESS = (import.meta.env.VITE_AIRDROP_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

export type Eligibility = {
  eligible: boolean;
  round: number;
  tokenType?: 'ERC20' | 'ERC721';
  amountOrTokenId?: string;
  nonce?: number;
  claimed?: boolean;
};

type SignResponse = Eligibility & { signature: `0x${string}`; contractAddress: string; chainId: string };

export function useAirdrop() {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [round, setRound] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const checkEligibility = useCallback(async (address: string, requestedRound = round) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/eligibility?address=${address}&round=${requestedRound}`);
      const json = await res.json();
      setEligibility(json);
      return json as Eligibility;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Eligibility check failed';
      setError(message); throw e;
    } finally { setLoading(false); }
  }, [round]);

  const claim = useCallback(async (address: string, requestedRound = round) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/sign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, round: requestedRound }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Signature request failed');
      const signed = json as SignResponse;
      writeContract({
        address: AIRDROP_ADDRESS,
        abi: AIRDROP_ABI,
        functionName: 'claim',
        args: [BigInt(signed.round), BigInt(signed.amountOrTokenId || '0'), BigInt(signed.nonce || 0), signed.signature],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Claim failed';
      setError(message); throw e;
    } finally { setLoading(false); }
  }, [round, writeContract]);

  return { round, setRound, eligibility, checkEligibility, claim, error, loading, hash, isPending, receipt };
}
