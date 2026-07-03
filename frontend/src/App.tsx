import { Header } from './components/Header';
import { ClaimPanel } from './components/ClaimPanel';
import { DevelopmentGuide } from './components/DevelopmentGuide';
import { LanguageProvider, useLanguage } from './i18n';
import { useEffect, useState } from 'react';

type Page = 'claim' | 'guide';

function getCurrentPage(): Page {
  if (typeof window === 'undefined') return 'claim';
  return window.location.hash === '#guide' ? 'guide' : 'claim';
}

export function App() {
  return (
    <LanguageProvider>
      <LocalizedApp />
    </LanguageProvider>
  );
}

function LocalizedApp() {
  const { t } = useLanguage();
  const [page, setPage] = useState<Page>(getCurrentPage);

  useEffect(() => {
    const syncPage = () => setPage(getCurrentPage());
    window.addEventListener('hashchange', syncPage);
    return () => window.removeEventListener('hashchange', syncPage);
  }, []);

  return (
    <main>
      <Header currentPage={page} />
      {page === 'guide' ? <DevelopmentGuide /> : <ClaimPanel />}
      <footer>{t('footer')}</footer>
    </main>
  );
}
