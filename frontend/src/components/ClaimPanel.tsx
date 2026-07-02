import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useAirdrop } from '../hooks/useAirdrop';
import { useLanguage } from '../i18n';

export function ClaimPanel() {
  const { address, isConnected, chain } = useAccount();
  const { round, setRound, eligibility, checkEligibility, claim, error, loading, hash, isPending, receipt } = useAirdrop();
  const { t } = useLanguage();

  const amountLabel = eligibility?.tokenType === 'ERC20' && eligibility.amountOrTokenId
    ? `${formatUnits(BigInt(eligibility.amountOrTokenId), 18)} NDT`
    : eligibility?.tokenType === 'ERC721'
      ? t('nftReward')
      : '—';

  return (
    <section className="panel">
      <div className="hero-card">
        <div className="noun-face"><span>⌐</span><span>◨</span><span>-</span><span>◨</span></div>
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroDescription')}</p>
      </div>

      <div className="controls">
        <label>{t('roundLabel')}</label>
        <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
          <option value={1}>{t('roundOne')}</option>
          <option value={2}>{t('roundTwo')}</option>
        </select>
        <button disabled={!isConnected || loading} onClick={() => address && checkEligibility(address)}>{loading ? t('checking') : t('queryEligibility')}</button>
        <button className="primary" disabled={!isConnected || !eligibility?.eligible || eligibility.claimed || loading || isPending} onClick={() => address && claim(address)}>
          {isPending ? t('walletPending') : t('requestClaim')}
        </button>
      </div>

      <div className="status-grid">
        <Status label={t('wallet')} value={isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : t('notConnected')} />
        <Status label={t('network')} value={chain?.name || '—'} />
        <Status label={t('eligibility')} value={eligibility ? (eligibility.eligible ? t('eligible') : t('notEligible')) : t('notChecked')} />
        <Status label={t('reward')} value={amountLabel} />
        <Status label={t('nonce')} value={eligibility?.nonce?.toString() || '—'} />
        <Status label={t('claimed')} value={eligibility?.claimed ? t('yes') : t('no')} />
      </div>

      {hash && <p className="tx">{t('txLabel')}: {hash}</p>}
      {receipt.isSuccess && <p className="success">{t('claimConfirmed')}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="status"><span>{label}</span><strong>{value}</strong></div>;
}
