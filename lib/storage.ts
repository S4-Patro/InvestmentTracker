export type InvestmentCategory =
  | 'mutual_fund_sip'
  | 'mutual_fund_lumpsum'
  | 'gold'
  | 'stock'
  | 'ppf'
  | 'nps'
  | 'epf'
  | 'fd'
  | 'rd'
  | 'bond'
  | 'chit_fund'
  | 'other';

export type AssetClass = 'equity' | 'debt' | 'gold' | 'hybrid' | 'other';

export interface SIP {
  id: string;
  name: string;          // Fund/scheme name
  amount: number;        // Monthly SIP amount
  startDate: string;     // ISO date
  sipDate: number;       // Day of month (1-28)
  category: InvestmentCategory;
  assetClass: AssetClass;
  ticker?: string;       // For price lookup (stocks/ETFs)
  units?: number;        // Manually tracked units if needed
  currentNav?: number;   // Last known NAV/price
  notes?: string;
}

export interface ManualInvestment {
  id: string;
  name: string;
  category: InvestmentCategory;
  assetClass: AssetClass;
  amount: number;        // Amount invested
  date: string;          // ISO date of investment
  units?: number;        // Units purchased (for MF/stocks/gold)
  buyPrice?: number;     // Price per unit at purchase
  ticker?: string;       // For live price fetch
  currentPrice?: number; // Last fetched price
  maturityDate?: string; // For FDs/bonds/RDs
  maturityAmount?: number; // Expected maturity value
  interestRate?: number; // Annual % for FD/RD/bonds
  notes?: string;
}

export interface PriceCache {
  [ticker: string]: {
    price: number;
    change: number;       // % change
    fetchedAt: string;    // ISO timestamp
  };
}

export interface GoldPrice {
  pricePerGram: number;  // INR per gram (24k)
  change: number;
  fetchedAt: string;
}

export interface PortfolioData {
  sips: SIP[];
  manualInvestments: ManualInvestment[];
  priceCache: PriceCache;
  goldPrice: GoldPrice | null;
  lastUpdated: string;
}

const STORAGE_KEY = 'investos_portfolio';

export function loadPortfolio(): PortfolioData {
  if (typeof window === 'undefined') return emptyPortfolio();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPortfolio();
    return JSON.parse(raw) as PortfolioData;
  } catch {
    return emptyPortfolio();
  }
}

export function savePortfolio(data: PortfolioData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }));
}

export function emptyPortfolio(): PortfolioData {
  return {
    sips: [],
    manualInvestments: [],
    priceCache: {},
    goldPrice: null,
    lastUpdated: new Date().toISOString(),
  };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Calculation helpers ────────────────────────────────────────────────────

export function calcSIPInvested(sip: SIP): number {
  const start = new Date(sip.startDate);
  const today = new Date();
  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() >= sip.sipDate) months += 1;
  return Math.max(0, months) * sip.amount;
}

export function calcSIPCurrentValue(sip: SIP): number {
  if (sip.units && sip.currentNav) return sip.units * sip.currentNav;
  // Fallback: assume 12% CAGR on invested amount
  const invested = calcSIPInvested(sip);
  const months = invested / sip.amount;
  if (months <= 0) return 0;
  const monthlyRate = 0.12 / 12;
  return sip.amount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
}

export function calcManualCurrentValue(inv: ManualInvestment, goldPrice: GoldPrice | null): number {
  if (inv.category === 'gold' && goldPrice && inv.units) {
    return inv.units * goldPrice.pricePerGram;
  }
  if (inv.currentPrice && inv.units) return inv.units * inv.currentPrice;
  if (inv.maturityAmount && inv.interestRate && inv.maturityDate) {
    // Simple accrued value for FD/bonds
    const start = new Date(inv.date).getTime();
    const end = new Date(inv.maturityDate).getTime();
    const now = Date.now();
    const elapsed = Math.min(now - start, end - start);
    const total = end - start;
    const accrued = elapsed / total;
    return inv.amount + (inv.maturityAmount - inv.amount) * accrued;
  }
  return inv.amount;
}

export function xirr(invested: number, currentValue: number, years: number): number {
  if (invested <= 0 || years <= 0) return 0;
  return (Math.pow(currentValue / invested, 1 / years) - 1) * 100;
}

export function sipForecast(
  monthlySIP: number,
  lumpsum: number,
  years: number,
  cagr: number
): number {
  const monthlyRate = cagr / 12;
  const months = years * 12;
  const sipFV = monthlySIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  const lumpsumFV = lumpsum * Math.pow(1 + cagr, years);
  return sipFV + lumpsumFV;
}

export const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  mutual_fund_sip: 'Mutual Fund SIP',
  mutual_fund_lumpsum: 'MF Lumpsum',
  gold: 'Gold',
  stock: 'Stock',
  ppf: 'PPF',
  nps: 'NPS',
  epf: 'EPF',
  fd: 'Fixed Deposit',
  rd: 'Recurring Deposit',
  bond: 'Bond',
  chit_fund: 'Chit Fund',
  other: 'Other',
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'Equity',
  debt: 'Debt',
  gold: 'Gold',
  hybrid: 'Hybrid',
  other: 'Other',
};

export const CATEGORY_ASSET_CLASS: Record<InvestmentCategory, AssetClass> = {
  mutual_fund_sip: 'equity',
  mutual_fund_lumpsum: 'equity',
  gold: 'gold',
  stock: 'equity',
  ppf: 'debt',
  nps: 'hybrid',
  epf: 'debt',
  fd: 'debt',
  rd: 'debt',
  bond: 'debt',
  chit_fund: 'other',
  other: 'other',
};
