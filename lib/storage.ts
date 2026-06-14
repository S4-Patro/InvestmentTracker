export type InvestmentCategory =
  | 'mutual_fund_sip' | 'mutual_fund_lumpsum'
  | 'gold' | 'silver'
  | 'stock_india' | 'stock_us'
  | 'ppf' | 'nps' | 'epf'
  | 'fd' | 'rd' | 'bond' | 'chit_fund' | 'other';

export type LiabilityCategory =
  | 'home_loan' | 'car_loan' | 'personal_loan' | 'education_loan' | 'other_loan'
  | 'splitwise' | 'owe_friend';

export type AssetClass = 'equity' | 'debt' | 'gold' | 'silver' | 'hybrid' | 'other';
export type BubbleCategory = 'stocks' | 'mutual_funds' | 'commodities' | 'fd_rd' | 'retirement' | 'govt';

export interface SIP {
  id: string; name: string; amount: number; startDate: string; sipDate: number;
  category: InvestmentCategory; assetClass: AssetClass;
  ticker?: string; units?: number; currentNav?: number; notes?: string;
}

export interface ManualInvestment {
  id: string; name: string; category: InvestmentCategory; assetClass: AssetClass;
  amount: number; date: string;
  units?: number; buyPrice?: number; ticker?: string; currentPrice?: number;
  maturityDate?: string; maturityAmount?: number; interestRate?: number; notes?: string;
}

export interface Liability {
  id: string;
  name: string;                    // e.g. "HDFC Home Loan", "Owe Raj ₹5K"
  category: LiabilityCategory;
  totalAmount: number;             // original / total owed
  outstandingAmount: number;       // current outstanding
  interestRate?: number;           // annual % (for loans)
  emiAmount?: number;              // monthly EMI
  startDate?: string;
  endDate?: string;                // loan end / expected repayment date
  notes?: string;
}

export interface GoldPrice { pricePerGram: number; change: number; fetchedAt: string; }

export interface PortfolioData {
  sips: SIP[];
  manualInvestments: ManualInvestment[];
  liabilities: Liability[];
  priceCache: Record<string, { price: number; change: number; fetchedAt: string }>;
  goldPrice: GoldPrice | null;
  lastUpdated: string;
}

const KEY = 'investos_v4';
export function loadPortfolio(): PortfolioData {
  if (typeof window === 'undefined') return emptyPortfolio();
  try { const r = localStorage.getItem(KEY); return r ? { ...emptyPortfolio(), ...JSON.parse(r) } : emptyPortfolio(); } catch { return emptyPortfolio(); }
}
export function savePortfolio(d: PortfolioData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify({ ...d, lastUpdated: new Date().toISOString() }));
}
export function emptyPortfolio(): PortfolioData {
  return { sips: [], manualInvestments: [], liabilities: [], priceCache: {}, goldPrice: null, lastUpdated: new Date().toISOString() };
}
export function generateId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export function calcSIPInvested(s: SIP): number {
  const start = new Date(s.startDate); const today = new Date();
  let m = (today.getFullYear()-start.getFullYear())*12+(today.getMonth()-start.getMonth());
  if (today.getDate() >= s.sipDate) m++;
  return Math.max(0,m)*s.amount;
}
export function calcSIPCurrentValue(s: SIP): number {
  if (s.units && s.currentNav) return s.units*s.currentNav;
  const inv = calcSIPInvested(s); const m = inv/s.amount; if (m<=0) return 0;
  const r = 0.12/12; return s.amount*((Math.pow(1+r,m)-1)/r)*(1+r);
}
export function calcManualCurrentValue(m: ManualInvestment, g: GoldPrice|null): number {
  if ((m.category==='gold'||m.category==='silver') && g && m.units) return m.units*g.pricePerGram;
  if (m.currentPrice && m.units) return m.units*m.currentPrice;
  if (m.maturityAmount && m.maturityDate) {
    const s=new Date(m.date).getTime(), e=new Date(m.maturityDate).getTime(), n=Date.now();
    return m.amount+(m.maturityAmount-m.amount)*(Math.min(n-s,e-s)/(e-s));
  }
  return m.amount;
}
export function xirr(inv: number, cur: number, yrs: number) {
  if (inv<=0||yrs<=0) return 0; return (Math.pow(cur/inv,1/yrs)-1)*100;
}
export function sipForecast(monthly: number, lump: number, yrs: number, cagr: number) {
  const r=cagr/12, n=yrs*12;
  return monthly*((Math.pow(1+r,n)-1)/r)*(1+r)+lump*Math.pow(1+cagr,yrs);
}

export const CATEGORY_LABELS: Record<InvestmentCategory,string> = {
  mutual_fund_sip:'Mutual Fund SIP', mutual_fund_lumpsum:'MF Lumpsum',
  gold:'Gold', silver:'Silver', stock_india:'India Stock', stock_us:'US Stock',
  ppf:'PPF', nps:'NPS', epf:'EPF', fd:'Fixed Deposit', rd:'Recurring Deposit',
  bond:'Bond / SGB', chit_fund:'Chit Fund', other:'Other',
};

export const LIABILITY_LABELS: Record<LiabilityCategory,string> = {
  home_loan:'Home Loan', car_loan:'Car Loan', personal_loan:'Personal Loan',
  education_loan:'Education Loan', other_loan:'Other Loan',
  splitwise:'Splitwise', owe_friend:'Owe to Friend',
};

export const LIABILITY_IS_INFORMAL: Record<LiabilityCategory,boolean> = {
  home_loan:false, car_loan:false, personal_loan:false, education_loan:false, other_loan:false,
  splitwise:true, owe_friend:true,
};

export const CATEGORY_ASSET_CLASS: Record<InvestmentCategory,AssetClass> = {
  mutual_fund_sip:'equity', mutual_fund_lumpsum:'equity',
  gold:'gold', silver:'silver', stock_india:'equity', stock_us:'equity',
  ppf:'debt', nps:'hybrid', epf:'debt', fd:'debt', rd:'debt', bond:'debt', chit_fund:'other', other:'other',
};
export const CATEGORY_BUBBLE: Record<InvestmentCategory,BubbleCategory> = {
  mutual_fund_sip:'mutual_funds', mutual_fund_lumpsum:'mutual_funds',
  gold:'commodities', silver:'commodities', stock_india:'stocks', stock_us:'stocks',
  ppf:'govt', nps:'retirement', epf:'retirement', fd:'fd_rd', rd:'fd_rd', bond:'govt', chit_fund:'fd_rd', other:'fd_rd',
};
export const BUBBLE_META: Record<BubbleCategory,{label:string;color:string;glow:string;tag:string}> = {
  stocks:      {label:'Stocks',       color:'#4ade80', glow:'rgba(74,222,128,0.3)',  tag:'tag-green'},
  mutual_funds:{label:'Mutual Funds', color:'#60a5fa', glow:'rgba(96,165,250,0.3)',  tag:'tag-blue'},
  commodities: {label:'Commodities',  color:'#f59e0b', glow:'rgba(245,158,11,0.3)',  tag:'tag-gold'},
  fd_rd:       {label:'FD / RD',      color:'#a78bfa', glow:'rgba(167,139,250,0.3)', tag:'tag-purple'},
  retirement:  {label:'Retirement',   color:'#fb923c', glow:'rgba(251,146,60,0.3)',  tag:'tag-orange'},
  govt:        {label:'Govt Backed',  color:'#34d399', glow:'rgba(52,211,153,0.3)',  tag:'tag-teal'},
};
