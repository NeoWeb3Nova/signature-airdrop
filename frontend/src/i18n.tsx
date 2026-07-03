import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'zh';

export type TranslationKey = keyof typeof translations.en & keyof typeof translations.zh;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const LANGUAGE_STORAGE_KEY = 'signature-airdrop-language';

const translations = {
  en: {
    appName: 'Signature Drop',
    appSubtitle: 'Base Sepolia · Nouns style',
    navigationLabel: 'Primary navigation',
    claimNav: 'Claim',
    guideNav: 'Dev Guide',
    guideKicker: 'Developer Guide',
    guideTitle: 'Signature Airdrop Development and Deployment Guide',
    guideDescription: 'A bilingual guide covering repository structure, the signature security model, contract deployment, backend signing service, frontend release, and production verification.',
    githubProjectLink: 'View GitHub project ↗',
    languageLabel: 'Language',
    english: 'English',
    chinese: '中文',
    heroTitle: 'Claim your signed airdrop',
    heroDescription: 'ECDSA authorization with nonce, round isolation, contract address, and Base Sepolia chain ID baked into every signature.',
    roundLabel: 'Round',
    roundOne: 'Round 1 · ERC-20',
    roundTwo: 'Round 2 · ERC-721',
    checking: 'Checking...',
    queryEligibility: 'Query eligibility',
    walletPending: 'Wallet pending...',
    requestClaim: 'Request signature & claim',
    joinWhitelist: 'Join whitelist to participate',
    joinedWhitelist: 'Joined! Re-query eligibility',
    wallet: 'Wallet',
    network: 'Network',
    eligibility: 'Eligibility',
    reward: 'Reward',
    nonce: 'Nonce',
    claimed: 'Claimed',
    notConnected: 'Not connected',
    notChecked: 'Not checked',
    eligible: 'Eligible',
    notEligible: 'Not eligible',
    nftReward: '1 Nouns-style NFT',
    yes: 'Yes',
    no: 'No',
    txLabel: 'Tx',
    claimConfirmed: 'Claim confirmed on Base Sepolia.',
    footer: 'Built for Base Sepolia · Foundry contracts · Nest.js signer · Vite React frontend',
  },
  zh: {
    appName: '签名空投',
    appSubtitle: 'Base Sepolia · Nouns 风格',
    navigationLabel: '主导航',
    claimNav: '领取',
    guideNav: '开发指南',
    guideKicker: '开发指南',
    guideTitle: 'Signature Airdrop 项目开发与部署指南',
    guideDescription: '覆盖项目结构、签名安全模型、合约部署、后端签名服务、前端上线和生产验证的中英文开发指南。',
    githubProjectLink: '查看 GitHub 项目 ↗',
    languageLabel: '语言',
    english: 'English',
    chinese: '中文',
    heroTitle: '领取你的签名空投',
    heroDescription: '每个签名都内置 ECDSA 授权、nonce、防跨轮次隔离、合约地址和 Base Sepolia 链 ID。',
    roundLabel: '轮次',
    roundOne: '第 1 轮 · ERC-20',
    roundTwo: '第 2 轮 · ERC-721',
    checking: '查询中...',
    queryEligibility: '查询资格',
    walletPending: '钱包确认中...',
    requestClaim: '请求签名并领取',
    joinWhitelist: '加入白名单参与空投',
    joinedWhitelist: '已加入！请重新查询资格',
    wallet: '钱包',
    network: '网络',
    eligibility: '领取资格',
    reward: '奖励',
    nonce: 'Nonce',
    claimed: '已领取',
    notConnected: '未连接',
    notChecked: '未查询',
    eligible: '符合资格',
    notEligible: '不符合资格',
    nftReward: '1 个 Nouns 风格 NFT',
    yes: '是',
    no: '否',
    txLabel: '交易',
    claimConfirmed: '已在 Base Sepolia 上确认领取。',
    footer: '基于 Base Sepolia · Foundry 合约 · Nest.js 签名服务 · Vite React 前端构建',
  },
} as const;

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage === 'en' || storedLanguage === 'zh') return storedLanguage;

  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => translations[language][key] ?? translations.en[key],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
