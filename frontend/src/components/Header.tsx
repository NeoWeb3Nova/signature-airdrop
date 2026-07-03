import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useLanguage } from '../i18n';

type HeaderProps = {
  currentPage: 'claim' | 'guide';
};

const GITHUB_REPO_URL = 'https://github.com/NeoWeb3Nova/signature-airdrop';

export function Header({ currentPage }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="header">
      <div className="brand"><div className="noggles">⌐◨-◨</div><div><strong>{t('appName')}</strong><span>{t('appSubtitle')}</span></div></div>
      <div className="header-actions">
        <nav className="app-nav" aria-label={t('navigationLabel')}>
          <a href="#claim" aria-current={currentPage === 'claim' ? 'page' : undefined}>{t('claimNav')}</a>
          <a href="#guide" aria-current={currentPage === 'guide' ? 'page' : undefined}>{t('guideNav')}</a>
        </nav>
        <a className="github-link" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          {t('githubProjectLink')}
        </a>
        <div className="language-toggle" aria-label={t('languageLabel')}>
          <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>{t('english')}</button>
          <button type="button" aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>{t('chinese')}</button>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
