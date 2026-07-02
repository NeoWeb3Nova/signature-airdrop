import { Header } from './components/Header';
import { ClaimPanel } from './components/ClaimPanel';
import { LanguageProvider, useLanguage } from './i18n';

export function App() {
  return (
    <LanguageProvider>
      <LocalizedApp />
    </LanguageProvider>
  );
}

function LocalizedApp() {
  const { t } = useLanguage();

  return (
    <main>
      <Header />
      <ClaimPanel />
      <footer>{t('footer')}</footer>
    </main>
  );
}
