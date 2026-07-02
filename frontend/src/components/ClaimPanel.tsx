import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useAirdrop } from '../hooks/useAirdrop';

export function ClaimPanel() {
  const { address, isConnected, chain } = useAccount();
  const { round, setRound, eligibility, checkEligibility, claim, error, loading, hash, isPending, receipt } = useAirdrop();

  const amountLabel = eligibility?.tokenType === 'ERC20' && eligibility.amountOrTokenId
    ? `${formatUnits(BigInt(eligibility.amountOrTokenId), 18)} NDT`
    : eligibility?.tokenType === 'ERC721'
      ? '1 Nouns-style NFT'
      : '—';

  return (
    <section className="panel">
      <div className="hero-card">
        <div className="noun-face"><span>⌐</span><span>◨</span><span>-</span><span>◨</span></div>
        <h1>Claim your signed airdrop</h1>
        <p>ECDSA authorization with nonce, round isolation, contract address, and Base Sepolia chain ID baked into every signature.</p>
      </div>

      <div className="controls">
        <label>Round</label>
        <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
          <option value={1}>Round 1 · ERC-20</option>
          <option value={2}>Round 2 · ERC-721</option>
        </select>
        <button disabled={!isConnected || loading} onClick={() => address && checkEligibility(address)}>{loading ? 'Checking...' : 'Query eligibility'}</button>
        <button className="primary" disabled={!isConnected || !eligibility?.eligible || eligibility.claimed || loading || isPending} onClick={() => address && claim(address)}>
          {isPending ? 'Wallet pending...' : 'Request signature & claim'}
        </button>
      </div>

      <div className="status-grid">
        <Status label="Wallet" value={isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'} />
        <Status label="Network" value={chain?.name || '—'} />
        <Status label="Eligibility" value={eligibility ? (eligibility.eligible ? 'Eligible' : 'Not eligible') : 'Not checked'} />
        <Status label="Reward" value={amountLabel} />
        <Status label="Nonce" value={eligibility?.nonce?.toString() || '—'} />
        <Status label="Claimed" value={eligibility?.claimed ? 'Yes' : 'No'} />
      </div>

      {hash && <p className="tx">Tx: {hash}</p>}
      {receipt.isSuccess && <p className="success">Claim confirmed on Base Sepolia.</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="status"><span>{label}</span><strong>{value}</strong></div>;
}
