import { Header } from './components/Header';
import { ClaimPanel } from './components/ClaimPanel';

export function App() {
  return (
    <main>
      <Header />
      <ClaimPanel />
      <footer>Built for Base Sepolia · Foundry contracts · Nest.js signer · Vite React frontend</footer>
    </main>
  );
}
