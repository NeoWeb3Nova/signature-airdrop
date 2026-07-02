import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="header">
      <div className="brand"><div className="noggles">⌐◨-◨</div><div><strong>Signature Drop</strong><span>Base Sepolia · Nouns style</span></div></div>
      <ConnectButton />
    </header>
  );
}
