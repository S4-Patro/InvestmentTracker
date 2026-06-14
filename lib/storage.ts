export type InvestmentCategory =
  | 'mutual_fund_sip'
  | 'mutual_fund_lumpsum'
  | 'gold'
  | 'stock_india'
  | 'stock_us'
  | 'ppf'
  | 'nps'
  | 'epf'
  | 'fd'
  | 'rd'
  | 'bond'
  | 'chit_fund'
  | 'other';

export type AssetClass = 'equity' | 'debt' | 'gold' | 'hybrid' | 'other';

export type BubbleCategory = 'stocks' | 'mutual_funds' | 'gold' | 'fd_rd' | 'retirement' | 'govt';

export interface SIP {
  id: string;
  name: string;
  amount: number;
  startDate: string;
  sipDate: number;
  category: InvestmentCategory;
  assetClass: AssetClass;
  ticker?: string;
  units?: number;
  currentNav?: number;
  notes?: string;
}

export interface ManualInvestment {
  id: string;
  name: string;
  category: InvestmentCategory;
  assetClass: AssetClass;
  amount: number;
  date: string;
  units?: number;
  buyPrice?: number;
  ticker?: string;
  currentPrice?: number;
  maturityDate?: string;
  maturityAmount?: number;
  interestRate?: number;
  notes?: string;
}

export interface GoldPrice {
  pricePerGram: number;
  change: number;
  fetchedAt: string;
}

export interface PortfolioData {
  sips: SIP[];
  manualInvestments: ManualInvestment[];
  priceCache: Record<string, { price: number; change: number; fetchedAt: string }>;
  goldPrice: GoldPrice | null;
  lastUpdated: string;
}

const STORAGE_KEY = 'investos_portfolio_v2';

export function loadPortfolio(): PortfolioData {
  if (typeof window === 'undefined') return emptyPortfolio();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPortfolio();
    return JSON.parse(raw) as PortfolioData;
  } catch { return emptyPortfolio(); }
}

export function savePortfolio(data: PortfolioData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }));
}

export function emptyPortfolio(): PortfolioData {
  return { sips: [], manualInvestments: [], priceCache: {}, goldPrice: null, lastUpdated: new Date().toISOString() };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function calcSIPInvested(sip: SIP): number {
  const start = new Date(sip.startDate);
  const today = new Date();
  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() >= sip.sipDate) months += 1;
  return Math.max(0, months) * sip.amount;
}

export function calcSIPCurrentValue(sip: SIP): number {
  if (sip.units && sip.currentNav) return sip.units * sip.currentNav;
  const invested = calcSIPInvested(sip);
  const months = invested / sip.amount;
  if (months <= 0) return 0;
  const r = 0.12 / 12;
  return sip.amount * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

export function calcManualCurrentValue(inv: ManualInvestment, goldPrice: GoldPrice | null): number {
  if (inv.category === 'gold' && goldPrice && inv.units) return inv.units * goldPrice.pricePerGram;
  if (inv.currentPrice && inv.units) return inv.units * inv.currentPrice;
  if (inv.maturityAmount && inv.maturityDate) {
    const start = new Date(inv.date).getTime();
    const end = new Date(inv.maturityDate).getTime();
    const now = Date.now();
    const elapsed = Math.min(now - start, end - start);
    const total = end - start;
    return inv.amount + (inv.maturityAmount - inv.amount) * (elapsed / total);
  }
  return inv.amount;
}

export function xirr(invested: number, current: number, years: number): number {
  if (invested <= 0 || years <= 0) return 0;
  return (Math.pow(current / invested, 1 / years) - 1) * 100;
}

export function sipForecast(monthly: number, lumpsum: number, years: number, cagr: number): number {
  const r = cagr / 12;
  const n = years * 12;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) + lumpsum * Math.pow(1 + cagr, years);
}

export const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  mutual_fund_sip: 'Mutual Fund SIP',
  mutual_fund_lumpsum: 'MF Lumpsum',
  gold: 'Gold',
  stock_india: 'India Stock',
  stock_us: 'US Stock',
  ppf: 'PPF',
  nps: 'NPS',
  epf: 'EPF',
  fd: 'Fixed Deposit',
  rd: 'Recurring Deposit',
  bond: 'Bond / SGB',
  chit_fund: 'Chit Fund',
  other: 'Other',
};

export const CATEGORY_ASSET_CLASS: Record<InvestmentCategory, AssetClass> = {
  mutual_fund_sip: 'equity', mutual_fund_lumpsum: 'equity',
  gold: 'gold', stock_india: 'equity', stock_us: 'equity',
  ppf: 'debt', nps: 'hybrid', epf: 'debt',
  fd: 'debt', rd: 'debt', bond: 'debt', chit_fund: 'other', other: 'other',
};

export const CATEGORY_BUBBLE: Record<InvestmentCategory, BubbleCategory> = {
  mutual_fund_sip: 'mutual_funds', mutual_fund_lumpsum: 'mutual_funds',
  gold: 'gold', stock_india: 'stocks', stock_us: 'stocks',
  ppf: 'govt', nps: 'retirement', epf: 'retirement',
  fd: 'fd_rd', rd: 'fd_rd', bond: 'govt', chit_fund: 'fd_rd', other: 'fd_rd',
};

export const BUBBLE_META: Record<BubbleCategory, { label: string; color: string; glow: string; tag: string }> = {
  stocks:       { label: 'Stocks',       color: '#4ade80', glow: 'rgba(74,222,128,0.25)',  tag: 'tag-green'  },
  mutual_funds: { label: 'Mutual Funds', color: '#60a5fa', glow: 'rgba(96,165,250,0.25)',  tag: 'tag-blue'   },
  gold:         { label: 'Gold',         color: '#f59e0b', glow: 'rgba(245,158,11,0.25)',  tag: 'tag-gold'   },
  fd_rd:        { label: 'FD / RD',      color: '#a78bfa', glow: 'rgba(167,139,250,0.25)', tag: 'tag-purple' },
  retirement:   { label: 'Retirement',   color: '#fb923c', glow: 'rgba(251,146,60,0.25)',  tag: 'tag-red'    },
  govt:         { label: 'Govt Backed',  color: '#34d399', glow: 'rgba(52,211,153,0.25)',  tag: 'tag-green'  },
};
