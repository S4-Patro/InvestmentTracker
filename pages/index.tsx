import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  loadPortfolio, savePortfolio, generateId, emptyPortfolio,
  calcSIPInvested, calcSIPCurrentValue, calcManualCurrentValue,
  xirr, sipForecast, CATEGORY_LABELS, CATEGORY_ASSET_CLASS,
  type PortfolioData, type SIP, type ManualInvestment,
  type InvestmentCategory,
} from '../lib/storage';

/* ─── Formatters ────────────────────────────────────────────────── */
const fmt = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr`
  : n >= 100000  ? `₹${(n / 100000).toFixed(2)} L`
  : n >= 1000    ? `₹${(n / 1000).toFixed(1)} K`
  : `₹${Math.round(n)}`;

const fmtFull = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtPct  = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

/* ─── Nav tabs ──────────────────────────────────────────────────── */
type Tab = 'overview' | 'holdings' | 'sips' | 'forecast' | 'ask' | 'add';
type AddMode = 'sip' | 'manual';

/* ─── SIP Form ──────────────────────────────────────────────────── */
function SIPForm({ onSave, onClose }: { onSave: (s: SIP) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: '', amount: '', startDate: '', sipDate: '7',
    category: 'mutual_fund_sip' as InvestmentCategory,
    ticker: '', units: '', currentNav: '', notes: '',
  });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    if (!f.name || !f.amount || !f.startDate) return;
    const cat = f.category as InvestmentCategory;
    onSave({
      id: generateId(), name: f.name,
      amount: parseFloat(f.amount), startDate: f.startDate,
      sipDate: parseInt(f.sipDate) || 7,
      category: cat, assetClass: CATEGORY_ASSET_CLASS[cat],
      ticker:     f.ticker     || undefined,
      units:      f.units      ? parseFloat(f.units)      : undefined,
      currentNav: f.currentNav ? parseFloat(f.currentNav) : undefined,
      notes:      f.notes      || undefined,
    });
    onClose();
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 540 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
        <h2 className="display" style={{ fontSize: 24 }}>Add SIP</h2>
        <button className="btn btn-sm" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'grid', gap: 24 }}>
        <Field label="Fund / scheme name *">
          <input placeholder="e.g. Mirae Asset Flexi Cap" value={f.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Field label="Monthly amount (₹) *">
            <input type="number" placeholder="10000" value={f.amount} onChange={e => set('amount', e.target.value)} />
          </Field>
          <Field label="SIP date (day of month)">
            <input type="number" min="1" max="28" placeholder="7" value={f.sipDate} onChange={e => set('sipDate', e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Field label="Start date *">
            <input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} />
          </Field>
          <Field label="Category">
            <select value={f.category} onChange={e => set('category', e.target.value)}>
              <option value="mutual_fund_sip">Mutual Fund SIP</option>
              <option value="stock">Stock SIP</option>
              <option value="gold">Gold SIP</option>
              <option value="nps">NPS</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <Field label="Ticker (optional)">
            <input placeholder="HDFCBANK.NS" value={f.ticker} onChange={e => set('ticker', e.target.value)} />
          </Field>
          <Field label="Units held">
            <input type="number" placeholder="0" value={f.units} onChange={e => set('units', e.target.value)} />
          </Field>
          <Field label="Current NAV">
            <input type="number" placeholder="0" value={f.currentNav} onChange={e => set('currentNav', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <input placeholder="Any notes..." value={f.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="rule" />
        <button className="btn btn-ink" onClick={submit}>Save SIP →</button>
      </div>
    </div>
  );
}

/* ─── Manual Investment Form ────────────────────────────────────── */
function ManualForm({ onSave, onClose }: { onSave: (m: ManualInvestment) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: '', category: 'stock' as InvestmentCategory,
    amount: '', date: '', units: '', buyPrice: '',
    ticker: '', maturityDate: '', maturityAmount: '',
    interestRate: '', notes: '',
  });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const cat = f.category as InvestmentCategory;
  const isDebt  = ['fd', 'rd', 'bond', 'ppf', 'epf'].includes(cat);
  const isGold  = cat === 'gold';
  const isStock = ['stock', 'mutual_fund_lumpsum'].includes(cat);

  const submit = () => {
    if (!f.name || !f.amount || !f.date) return;
    onSave({
      id: generateId(), name: f.name, category: cat,
      assetClass: CATEGORY_ASSET_CLASS[cat],
      amount: parseFloat(f.amount), date: f.date,
      units:          f.units          ? parseFloat(f.units)          : undefined,
      buyPrice:       f.buyPrice       ? parseFloat(f.buyPrice)       : undefined,
      ticker:         f.ticker         || undefined,
      currentPrice:   f.buyPrice       ? parseFloat(f.buyPrice)       : undefined,
      maturityDate:   f.maturityDate   || undefined,
      maturityAmount: f.maturityAmount ? parseFloat(f.maturityAmount) : undefined,
      interestRate:   f.interestRate   ? parseFloat(f.interestRate) / 100 : undefined,
      notes:          f.notes          || undefined,
    });
    onClose();
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 540 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
        <h2 className="display" style={{ fontSize: 24 }}>Add investment</h2>
        <button className="btn btn-sm" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'grid', gap: 24 }}>
        <Field label="Name *">
          <input placeholder="e.g. Infosys, SGB 2023, HDFC FD" value={f.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Field label="Category *">
            <select value={f.category} onChange={e => set('category', e.target.value)}>
              <option value="stock">Stock</option>
              <option value="mutual_fund_lumpsum">MF Lumpsum</option>
              <option value="gold">Gold</option>
              <option value="fd">Fixed Deposit</option>
              <option value="rd">Recurring Deposit</option>
              <option value="ppf">PPF</option>
              <option value="epf">EPF</option>
              <option value="nps">NPS</option>
              <option value="bond">Bond</option>
              <option value="chit_fund">Chit Fund</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date of investment *">
            <input type="date" value={f.date} onChange={e => set('date', e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Field label="Amount invested (₹) *">
            <input type="number" placeholder="50000" value={f.amount} onChange={e => set('amount', e.target.value)} />
          </Field>
          {(isStock || isGold) && (
            <Field label={isGold ? 'Grams purchased' : 'Units purchased'}>
              <input type="number" placeholder="0" value={f.units} onChange={e => set('units', e.target.value)} />
            </Field>
          )}
          {isStock && (
            <Field label="Buy price per unit (₹)">
              <input type="number" placeholder="0" value={f.buyPrice} onChange={e => set('buyPrice', e.target.value)} />
            </Field>
          )}
        </div>
        {isStock && (
          <Field label="Ticker symbol (for live prices)">
            <input placeholder="e.g. INFY.NS, RELIANCE.NS" value={f.ticker} onChange={e => set('ticker', e.target.value)} />
          </Field>
        )}
        {isDebt && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            <Field label="Interest rate (%)">
              <input type="number" placeholder="7.5" value={f.interestRate} onChange={e => set('interestRate', e.target.value)} />
            </Field>
            <Field label="Maturity date">
              <input type="date" value={f.maturityDate} onChange={e => set('maturityDate', e.target.value)} />
            </Field>
            <Field label="Maturity amount (₹)">
              <input type="number" placeholder="0" value={f.maturityAmount} onChange={e => set('maturityAmount', e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="Notes">
          <input placeholder="e.g. HDFC Bank FD, auto-renew..." value={f.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="rule" />
        <button className="btn btn-ink" onClick={submit}>Save investment →</button>
      </div>
    </div>
  );
}

/* ─── Recharts custom tooltip ───────────────────────────────────── */
function InkTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A1A18', padding: '10px 14px',
      fontSize: 11, color: '#F7F4EE',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontSize: 10, color: '#8A8880', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <span style={{ color: '#8A8880' }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main App ──────────────────────────────────────────────────── */
export default function Home() {
  const [portfolio, setPortfolio] = useState<PortfolioData>(emptyPortfolio());
  const [tab, setTab]             = useState<Tab>('overview');
  const [addMode, setAddMode]     = useState<AddMode>('sip');
  const [refreshing, setRefreshing] = useState(false);
  const [question, setQuestion]   = useState('');
  const [aiAnswer, setAiAnswer]   = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [forecastYears, setForecastYears] = useState(10);
  const [forecastCagr,  setForecastCagr]  = useState(12);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); setPortfolio(loadPortfolio()); }, []);

  const save = useCallback((p: PortfolioData) => {
    setPortfolio(p);
    savePortfolio(p);
  }, []);

  /* ── Aggregates ──────────────────────────────────────────────── */
  const sipInvested  = portfolio.sips.reduce((s, x) => s + calcSIPInvested(x), 0);
  const sipCurrent   = portfolio.sips.reduce((s, x) => s + calcSIPCurrentValue(x), 0);
  const manInvested  = portfolio.manualInvestments.reduce((s, x) => s + x.amount, 0);
  const manCurrent   = portfolio.manualInvestments.reduce((s, x) => s + calcManualCurrentValue(x, portfolio.goldPrice), 0);
  const totalInvested = sipInvested + manInvested;
  const totalCurrent  = sipCurrent  + manCurrent;
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const monthlySIP    = portfolio.sips.reduce((s, x) => s + x.amount, 0);

  const allDates = [
    ...portfolio.sips.map(s => new Date(s.startDate).getTime()),
    ...portfolio.manualInvestments.map(m => new Date(m.date).getTime()),
  ];
  const yearsInvested = allDates.length
    ? (Date.now() - Math.min(...allDates)) / (1000 * 60 * 60 * 24 * 365)
    : 0;
  const xirrVal = xirr(totalInvested, totalCurrent, Math.max(yearsInvested, 0.1));

  /* Allocation */
  type AssetClass = 'equity' | 'debt' | 'gold' | 'hybrid' | 'other';
  const alloc: Record<AssetClass, number> = { equity: 0, debt: 0, gold: 0, hybrid: 0, other: 0 };
  portfolio.sips.forEach(s => { alloc[s.assetClass as AssetClass] += calcSIPCurrentValue(s); });
  portfolio.manualInvestments.forEach(m => { alloc[m.assetClass as AssetClass] += calcManualCurrentValue(m, portfolio.goldPrice); });

  /* Growth chart (12-month backcast) */
  const growthData = Array.from({ length: 13 }, (_, i) => {
    const back = 12 - i;
    const d = new Date(); d.setMonth(d.getMonth() - back);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    return {
      label,
      Invested: Math.max(0, Math.round(totalInvested  * (1 - back * 0.072))),
      Value:    Math.max(0, Math.round(totalCurrent   * (1 - back * 0.052))),
    };
  });

  /* Forecast */
  const forecastData = Array.from({ length: forecastYears }, (_, i) => {
    const y = i + 1;
    return {
      year: `Y${y}`,
      Bear: Math.round(sipForecast(monthlySIP, totalCurrent, y, (forecastCagr - 4) / 100)),
      Base: Math.round(sipForecast(monthlySIP, totalCurrent, y, forecastCagr / 100)),
      Bull: Math.round(sipForecast(monthlySIP, totalCurrent, y, (forecastCagr + 4) / 100)),
    };
  });
  const targetCorpus = forecastData[forecastYears - 1]?.Base ?? 0;

  /* Alerts */
  const alerts: string[] = [];
  if (totalCurrent > 0 && alloc.equity / totalCurrent > 0.8)
    alerts.push('Equity above 80% of portfolio — consider adding debt or gold.');
  if (totalCurrent > 0 && alloc.gold === 0)
    alerts.push('No gold allocation — a 5–10% position can reduce volatility.');
  portfolio.manualInvestments.forEach(m => {
    if (!m.maturityDate) return;
    const days = Math.ceil((new Date(m.maturityDate).getTime() - Date.now()) / 86400000);
    if (days > 0 && days < 60)
      alerts.push(`${m.name} matures in ${days} days — plan reinvestment.`);
  });

  /* ── Live price refresh ──────────────────────────────────────── */
  const refreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      const goldRes  = await fetch('/api/prices?type=gold');
      const goldData = await goldRes.json();

      const tickers = [
        ...portfolio.sips.map(s => s.ticker),
        ...portfolio.manualInvestments.map(m => m.ticker),
      ].filter(Boolean).join(',');

      let stockData: Record<string, { price: number; change: number }> = {};
      if (tickers) {
        const r = await fetch(`/api/prices?type=stocks&tickers=${encodeURIComponent(tickers)}`);
        stockData = await r.json();
      }

      const np = { ...portfolio };
      if (goldData.pricePerGram)
        np.goldPrice = { pricePerGram: goldData.pricePerGram, change: goldData.change ?? 0, fetchedAt: new Date().toISOString() };

      np.manualInvestments = portfolio.manualInvestments.map(m =>
        m.ticker && stockData[m.ticker] ? { ...m, currentPrice: stockData[m.ticker].price } : m
      );
      np.sips = portfolio.sips.map(s =>
        s.ticker && stockData[s.ticker] ? { ...s, currentNav: stockData[s.ticker].price } : s
      );
      save(np);
    } catch (e) { console.error(e); }
    setRefreshing(false);
  }, [portfolio, save]);

  /* ── AI Ask ──────────────────────────────────────────────────── */
  const askAI = async () => {
    if (!question.trim()) return;
    setAiLoading(true); setAiAnswer('');
    try {
      const summary = JSON.stringify({
        totalInvested: fmtFull(totalInvested), totalCurrent: fmtFull(totalCurrent),
        totalGain: fmtFull(totalGain), xirr: xirrVal.toFixed(1) + '%',
        monthlySIP: fmtFull(monthlySIP), allocation: alloc,
        sips: portfolio.sips.map(s => ({ name: s.name, amount: s.amount, category: s.category, invested: calcSIPInvested(s), value: calcSIPCurrentValue(s) })),
        manual: portfolio.manualInvestments.map(m => ({ name: m.name, category: m.category, amount: m.amount, value: calcManualCurrentValue(m, portfolio.goldPrice) })),
        goldPrice: portfolio.goldPrice?.pricePerGram,
      });
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, portfolioSummary: summary }),
      });
      const data = await res.json();
      setAiAnswer(data.answer || data.error || 'No response.');
    } catch { setAiAnswer('Could not reach AI. Check ANTHROPIC_API_KEY in .env.local'); }
    setAiLoading(false);
  };

  if (!mounted) return null;
  const isEmpty = portfolio.sips.length === 0 && portfolio.manualInvestments.length === 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',  label: 'Overview'  },
    { key: 'holdings',  label: 'Holdings'  },
    { key: 'sips',      label: 'SIPs'      },
    { key: 'forecast',  label: 'Forecast'  },
    { key: 'ask',       label: 'Ask AI'    },
    { key: 'add',       label: '+ Add'     },
  ];

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <Head>
        <title>InvestOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* ── Masthead ────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid #1A1A18',
        position: 'sticky', top: 0, zIndex: 50,
        background: '#F7F4EE',
      }}>
        {/* Top strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', height: 48,
          borderBottom: '1px solid var(--subtle)',
        }}>
          <span className="eyebrow" style={{ color: 'var(--warm)' }}>Personal finance</span>
          <span style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>
            Invest<span style={{ color: 'var(--accent)' }}>OS</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {portfolio.goldPrice && (
              <span className="eyebrow">
                Gold ₹{portfolio.goldPrice.pricePerGram.toLocaleString('en-IN')}/g
                <span style={{ color: portfolio.goldPrice.change >= 0 ? 'var(--up)' : 'var(--down)', marginLeft: 6 }}>
                  {fmtPct(portfolio.goldPrice.change)}
                </span>
              </span>
            )}
            <button className="btn btn-sm" onClick={refreshPrices} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh prices'}
            </button>
          </div>
        </div>
        {/* Nav strip */}
        <nav style={{ display: 'flex', padding: '0 40px', gap: 0 }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px',
                fontFamily: 'var(--f-body)',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tab === key ? 'var(--ink)' : 'var(--warm)',
                borderBottom: tab === key ? '2px solid var(--ink)' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      <main style={{ padding: '0 40px 60px', maxWidth: 1160, margin: '0 auto' }}>

        {/* ── Empty state ──────────────────────────────────────── */}
        {isEmpty && tab !== 'add' && (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Getting started</div>
            <h1 className="display" style={{ fontSize: 48, marginBottom: 16 }}>Your portfolio<br />awaits its first entry.</h1>
            <p style={{ color: 'var(--warm)', marginBottom: 32 }}>Add a SIP or investment to start tracking your journey.</p>
            <button className="btn btn-ink" onClick={() => setTab('add')}>Add first investment →</button>
          </div>
        )}

        {/* ══ OVERVIEW ══════════════════════════════════════════ */}
        {tab === 'overview' && !isEmpty && (
          <>
            {/* The headline number */}
            <div style={{ padding: '40px 0 28px' }}>
              <div className="rule" style={{ marginBottom: 20 }} />
              <div className="eyebrow" style={{ marginBottom: 12 }}>Total portfolio value</div>
              <div className="display" style={{ fontSize: 72, marginBottom: 8 }}>
                {fmt(totalCurrent)}
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <span style={{ color: 'var(--warm)', fontSize: 13 }}>
                  Invested {fmt(totalInvested)}
                </span>
                <span className={totalGain >= 0 ? 'up' : 'down'} style={{ fontSize: 13, fontWeight: 500 }}>
                  {totalGain >= 0 ? '↑' : '↓'} {fmt(Math.abs(totalGain))} ({fmtPct(gainPct)})
                </span>
              </div>
            </div>

            {/* KPI grid — 4 cols separated by vertical rules */}
            <div className="rule" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr 1px 1fr', gap: 0 }}>
              {[
                { label: 'XIRR',         value: `${xirrVal.toFixed(1)}%`, sub: xirrVal > 12 ? '↑ beats Nifty avg' : '↓ below Nifty avg', up: xirrVal > 12 },
                { label: 'Monthly SIP',  value: fmt(monthlySIP),   sub: `${portfolio.sips.length} active SIPs` },
                { label: 'Total gain',   value: fmt(totalGain),    sub: fmtPct(gainPct), up: totalGain >= 0 },
                { label: 'Instruments',  value: String(portfolio.sips.length + portfolio.manualInvestments.length), sub: 'across all categories' },
              ].flatMap((k, i) => [
                <div key={i} style={{ padding: '24px 0', paddingRight: 24, paddingLeft: i === 0 ? 0 : 24 }}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value display" style={{ fontSize: 32 }}>{k.value}</div>
                  {k.sub && (
                    <div style={{ fontSize: 11, marginTop: 6, color: k.up !== undefined ? (k.up ? 'var(--up)' : 'var(--down)') : 'var(--warm)' }}>
                      {k.sub}
                    </div>
                  )}
                </div>,
                i < 3 ? <div key={`vr${i}`} className="rule-v" /> : null,
              ])}
            </div>
            <div className="rule" />

            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--subtle)' }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Signals</div>
                {alerts.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--subtle)' }}>
                    <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', minWidth: 16 }}>—</span>
                    <span style={{ fontSize: 13 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Growth chart */}
            <div style={{ padding: '32px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
                <div className="eyebrow">Portfolio growth — 12 months</div>
                <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--warm)' }}>
                  <span>— Invested</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>— Value</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={growthData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1A1A18" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#1A1A18" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: '#8A8880', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<InkTooltip />} />
                  <Area type="monotone" dataKey="Invested" stroke="#D4CFC6" strokeWidth={1} fill="none" dot={false} />
                  <Area type="monotone" dataKey="Value"    stroke="#1A1A18" strokeWidth={2} fill="url(#fillValue)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Allocation bars */}
            <div className="rule" />
            <div style={{ padding: '28px 0' }}>
              <div className="eyebrow" style={{ marginBottom: 20 }}>Allocation</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24 }}>
                {(['equity', 'debt', 'gold', 'hybrid', 'other'] as const).map((cls, i) => {
                  const val = alloc[cls];
                  const pct = totalCurrent > 0 ? val / totalCurrent * 100 : 0;
                  return (
                    <div key={cls}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>{cls}</div>
                      <div style={{ background: 'var(--subtle)', height: 3, marginBottom: 8, overflow: 'hidden' }}>
                        <div
                          className="alloc-bar"
                          style={{ width: `${pct}%`, animationDelay: `${i * 0.1}s` }}
                        />
                      </div>
                      <div className="display" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
                      <div style={{ fontSize: 11, color: 'var(--warm)', marginTop: 2 }}>{fmt(val)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══ HOLDINGS ══════════════════════════════════════════ */}
        {tab === 'holdings' && (
          <div style={{ paddingTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
              <h2 className="display" style={{ fontSize: 32 }}>Holdings</h2>
              <span className="eyebrow">{portfolio.sips.length + portfolio.manualInvestments.length} instruments</span>
            </div>
            <div className="rule" />
            <table className="ink-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Invested</th>
                  <th>Current value</th>
                  <th>Gain / Loss</th>
                  <th>Return</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {portfolio.sips.map(sip => {
                  const inv = calcSIPInvested(sip);
                  const cur = calcSIPCurrentValue(sip);
                  const gain = cur - inv;
                  const gPct = inv > 0 ? (gain / inv) * 100 : 0;
                  return (
                    <tr key={sip.id}>
                      <td style={{ fontWeight: 500 }}>{sip.name}</td>
                      <td><span className="tag tag-muted">{CATEGORY_LABELS[sip.category]}</span></td>
                      <td className="mono">{fmt(inv)}</td>
                      <td className="mono">{fmt(cur)}</td>
                      <td className={`mono ${gain >= 0 ? 'up' : 'down'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</td>
                      <td className={`mono ${gain >= 0 ? 'up' : 'down'}`}>{fmtPct(gPct)}</td>
                      <td>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm)', fontSize: 16 }}
                          onClick={() => save({ ...portfolio, sips: portfolio.sips.filter(s => s.id !== sip.id) })}>×</button>
                      </td>
                    </tr>
                  );
                })}
                {portfolio.manualInvestments.map(inv => {
                  const cur  = calcManualCurrentValue(inv, portfolio.goldPrice);
                  const gain = cur - inv.amount;
                  const gPct = inv.amount > 0 ? (gain / inv.amount) * 100 : 0;
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 500 }}>
                        {inv.name}
                        {inv.ticker && <span className="mono" style={{ fontSize: 10, color: 'var(--warm)', marginLeft: 8 }}>{inv.ticker}</span>}
                      </td>
                      <td><span className="tag tag-muted">{CATEGORY_LABELS[inv.category]}</span></td>
                      <td className="mono">{fmt(inv.amount)}</td>
                      <td className="mono">{fmt(cur)}</td>
                      <td className={`mono ${gain >= 0 ? 'up' : 'down'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</td>
                      <td className={`mono ${gain >= 0 ? 'up' : 'down'}`}>{fmtPct(gPct)}</td>
                      <td>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm)', fontSize: 16 }}
                          onClick={() => save({ ...portfolio, manualInvestments: portfolio.manualInvestments.filter(m => m.id !== inv.id) })}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isEmpty && <p style={{ color: 'var(--warm)', padding: '40px 0' }}>No holdings yet.</p>}
          </div>
        )}

        {/* ══ SIPS ══════════════════════════════════════════════ */}
        {tab === 'sips' && (
          <div style={{ paddingTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
              <h2 className="display" style={{ fontSize: 32 }}>SIPs</h2>
              <button className="btn" onClick={() => { setTab('add'); setAddMode('sip'); }}>+ Add SIP</button>
            </div>
            <div className="rule" />

            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: '1px solid var(--subtle)' }}>
              {[
                { label: 'Total monthly SIP', value: fmt(monthlySIP) },
                { label: 'Active SIPs',        value: String(portfolio.sips.length) },
                { label: 'Invested via SIPs',  value: fmt(sipInvested) },
              ].map((k, i) => (
                <div key={i} style={{ padding: '20px 0', paddingRight: 24, paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? '1px solid var(--subtle)' : 'none' }}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="display" style={{ fontSize: 28 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* SIP cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24, paddingTop: 32 }}>
              {portfolio.sips.map(sip => {
                const inv = calcSIPInvested(sip);
                const cur = calcSIPCurrentValue(sip);
                const months = Math.max(0, Math.round(inv / sip.amount));
                const next = new Date();
                next.setDate(sip.sipDate);
                if (next <= new Date()) next.setMonth(next.getMonth() + 1);
                return (
                  <div key={sip.id} style={{ borderTop: '2px solid var(--ink)', paddingTop: 20 }}>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>{CATEGORY_LABELS[sip.category]}</div>
                    <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{sip.name}</div>
                    <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 28, color: 'var(--accent)', marginBottom: 16 }}>
                      {fmt(sip.amount)}<span style={{ fontSize: 13, fontFamily: 'var(--f-body)', color: 'var(--warm)', fontWeight: 400 }}>/month</span>
                    </div>
                    <div className="rule-subtle" style={{ marginBottom: 16 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { l: 'Invested',      v: fmt(inv) },
                        { l: 'Current value', v: fmt(cur) },
                        { l: 'Months running',v: String(months) },
                        { l: 'Next SIP',      v: next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
                      ].map(({ l, v }) => (
                        <div key={l}>
                          <div className="eyebrow" style={{ marginBottom: 2 }}>{l}</div>
                          <div className="mono" style={{ fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {portfolio.sips.length === 0 && (
                <div style={{ color: 'var(--warm)', paddingTop: 20 }}>No SIPs yet. <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => { setTab('add'); setAddMode('sip'); }}>Add one →</button></div>
              )}
            </div>
          </div>
        )}

        {/* ══ FORECAST ══════════════════════════════════════════ */}
        {tab === 'forecast' && (
          <div style={{ paddingTop: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
              <h2 className="display" style={{ fontSize: 32 }}>Forecast</h2>
              <span className="eyebrow">Based on current SIPs + corpus</span>
            </div>
            <div className="rule" />

            {/* Target number */}
            <div style={{ padding: '32px 0', borderBottom: '1px solid var(--subtle)' }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Projected corpus in {forecastYears} years (base case)</div>
              <div className="display" style={{ fontSize: 64 }}>{fmt(targetCorpus)}</div>
              <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--warm)' }}>Bear <span className="mono" style={{ color: 'var(--down)' }}>{fmt(forecastData[forecastYears - 1]?.Bear ?? 0)}</span></span>
                <span style={{ fontSize: 13, color: 'var(--warm)' }}>Bull <span className="mono up">{fmt(forecastData[forecastYears - 1]?.Bull ?? 0)}</span></span>
              </div>
            </div>

            {/* Controls */}
            <div style={{ padding: '24px 0', borderBottom: '1px solid var(--subtle)', display: 'flex', gap: 48 }}>
              {[
                { label: 'Years to project', val: forecastYears, min: 5, max: 30, set: setForecastYears, unit: 'yr' },
                { label: 'Expected CAGR',    val: forecastCagr,  min: 6, max: 20, set: setForecastCagr,  unit: '%' },
              ].map(({ label, val, min, max, set, unit }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="eyebrow" style={{ minWidth: 120 }}>{label}</div>
                  <input type="range" min={min} max={max} value={val} onChange={e => set(+e.target.value)} style={{ width: 140 }} />
                  <div className="display" style={{ fontSize: 24, minWidth: 52 }}>{val}{unit}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div style={{ paddingTop: 32 }}>
              <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--warm)', marginBottom: 16 }}>
                <span style={{ color: '#C0BBB2' }}>■ Bear</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>■ Base</span>
                <span style={{ color: '#8A8880' }}>■ Bull</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={forecastData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2}>
                  <XAxis dataKey="year" tick={{ fill: '#8A8880', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<InkTooltip />} />
                  <Bar dataKey="Bear" fill="#D4CFC6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Base" fill="#1A1A18" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Bull" fill="#8A8880" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* SIP impact */}
            <div style={{ padding: '28px 0', borderTop: '1px solid var(--subtle)' }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>SIP impact — what ₹5,000 more per month does</div>
              <div style={{ display: 'flex', gap: 40 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--warm)', marginBottom: 4 }}>Current trajectory</div>
                  <div className="display" style={{ fontSize: 28 }}>{fmt(targetCorpus)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--warm)', fontSize: 20 }}>→</div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--warm)', marginBottom: 4 }}>With ₹5,000 more/month</div>
                  <div className="display up" style={{ fontSize: 28 }}>
                    {fmt(sipForecast(monthlySIP + 5000, totalCurrent, forecastYears, forecastCagr / 100))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ASK AI ════════════════════════════════════════════ */}
        {tab === 'ask' && (
          <div style={{ paddingTop: 32, maxWidth: 640 }}>
            <h2 className="display" style={{ fontSize: 32, marginBottom: 8 }}>Ask your portfolio</h2>
            <p style={{ color: 'var(--warm)', marginBottom: 32, fontSize: 13 }}>
              The AI has full visibility into your investments, SIPs, allocation, and returns.
            </p>
            <div className="rule" style={{ marginBottom: 32 }} />

            {/* Quick prompts */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
              {[
                'What should I rebalance?',
                'Am I on track for retirement?',
                "What's dragging my returns?",
                'Analyse my SIP mix',
              ].map(q => (
                <button key={q} className="btn btn-sm" onClick={() => setQuestion(q)}>{q}</button>
              ))}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 32 }}>
              <div style={{ flex: 1 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Your question</div>
                <input
                  placeholder="Ask anything about your portfolio…"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && askAI()}
                />
              </div>
              <button className="btn btn-ink" onClick={askAI} disabled={aiLoading} style={{ flexShrink: 0 }}>
                {aiLoading ? 'Thinking…' : 'Ask →'}
              </button>
            </div>

            {/* Answer */}
            {aiAnswer && (
              <>
                <div className="rule" style={{ marginBottom: 24 }} />
                <div className="eyebrow" style={{ marginBottom: 12 }}>Analysis</div>
                <p style={{ fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{aiAnswer}</p>
              </>
            )}
            {isEmpty && (
              <p style={{ color: 'var(--warm)', fontSize: 13 }}>Add investments first so the AI has data to analyse.</p>
            )}
          </div>
        )}

        {/* ══ ADD ═══════════════════════════════════════════════ */}
        {tab === 'add' && (
          <div style={{ paddingTop: 32 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 36 }}>
              <button
                className={`btn ${addMode === 'sip' ? 'btn-ink' : ''}`}
                onClick={() => setAddMode('sip')}
              >
                Regular SIP
              </button>
              <button
                className={`btn ${addMode === 'manual' ? 'btn-ink' : ''}`}
                onClick={() => setAddMode('manual')}
              >
                One-time / manual
              </button>
            </div>
            <div className="rule" style={{ marginBottom: 36 }} />
            {addMode === 'sip' && (
              <SIPForm
                onSave={sip => { save({ ...portfolio, sips: [...portfolio.sips, sip] }); setTab('sips'); }}
                onClose={() => setTab('overview')}
              />
            )}
            {addMode === 'manual' && (
              <ManualForm
                onSave={inv => { save({ ...portfolio, manualInvestments: [...portfolio.manualInvestments, inv] }); setTab('holdings'); }}
                onClose={() => setTab('overview')}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
