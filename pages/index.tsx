import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  loadPortfolio, savePortfolio, generateId, emptyPortfolio,
  calcSIPInvested, calcSIPCurrentValue, calcManualCurrentValue,
  xirr, sipForecast, CATEGORY_LABELS, CATEGORY_ASSET_CLASS, CATEGORY_BUBBLE, BUBBLE_META,
  type PortfolioData, type SIP, type ManualInvestment, type InvestmentCategory, type BubbleCategory,
} from '../lib/storage';

/* ─── Formatters ── */
const fmt = (n: number) =>
  n >= 10000000 ? `₹${(n/10000000).toFixed(2)}Cr`
  : n >= 100000 ? `₹${(n/100000).toFixed(2)}L`
  : n >= 1000   ? `₹${(n/1000).toFixed(1)}K`
  : `₹${Math.round(n)}`;
const fmtFull = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtPct  = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

type Tab = 'overview' | 'holdings' | 'sips' | 'forecast' | 'ask' | 'add';
type AddMode = 'sip' | 'manual';

/* ══ INTRO SCREEN ══════════════════════════════════════════════════ */
function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'orbs' | 'text' | 'button'>('orbs');
  const [typedText, setTypedText] = useState('');
  const [showBtn, setShowBtn] = useState(false);
  const fullText = 'Track every rupee.';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Orb { x: number; y: number; r: number; vx: number; vy: number; color: string; alpha: number; flickerSpeed: number; flickerOffset: number; }
    const colors = ['#4ade80','#22c55e','#86efac','#60a5fa','#34d399','#a78bfa'];
    const orbs: Orb[] = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 60 + Math.random() * 120,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.04 + Math.random() * 0.1,
      flickerSpeed: 0.01 + Math.random() * 0.03,
      flickerOffset: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#141618';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = canvas.width + o.r;
        if (o.x > canvas.width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = canvas.height + o.r;
        if (o.y > canvas.height + o.r) o.y = -o.r;
        const flicker = o.alpha * (0.6 + 0.4 * Math.sin(frame * o.flickerSpeed + o.flickerOffset));
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grad.addColorStop(0, o.color + Math.round(flicker * 255).toString(16).padStart(2,'0'));
        grad.addColorStop(1, o.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      });
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Rupee symbol drift
  const [rupeePos, setRupeePos] = useState({ x: -80, y: 0, opacity: 0 });
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('text');
      setRupeePos({ x: 0, y: 0, opacity: 1 });
    }, 2200);
    return () => clearTimeout(t1);
  }, []);

  // Typewriter
  useEffect(() => {
    if (phase !== 'text') return;
    let i = 0;
    const iv = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) {
        clearInterval(iv);
        setTimeout(() => setShowBtn(true), 400);
      }
    }, 60);
    return () => clearInterval(iv);
  }, [phase]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 32 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Floating rupee */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: `translate(calc(-50% + ${rupeePos.x}px), -50%)`,
        opacity: rupeePos.opacity,
        transition: 'all 1.8s cubic-bezier(0.16,1,0.3,1)',
        fontSize: 110,
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        color: 'transparent',
        WebkitTextStroke: '1.5px #4ade80',
        filter: 'drop-shadow(0 0 30px rgba(74,222,128,0.5))',
        userSelect: 'none',
        lineHeight: 1,
        marginTop: -60,
      }}>₹</div>

      {/* Text + button */}
      <div style={{ position: 'relative', textAlign: 'center', marginTop: 80 }}>
        {phase !== 'orbs' && (
          <div style={{ fontSize: 28, fontWeight: 500, color: '#e2e8f0', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em', minHeight: 40 }}>
            {typedText}<span style={{ opacity: showBtn ? 0 : 1, transition: 'opacity 0.3s', color: '#4ade80' }}>|</span>
          </div>
        )}
        {showBtn && (
          <button onClick={onEnter} className="btn-accent" style={{
            marginTop: 32, fontSize: 14, padding: '13px 36px',
            animation: 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
            letterSpacing: '0.06em',
          }}>
            Enter dashboard →
          </button>
        )}
      </div>

      {/* S4 monogram bottom left */}
      <div style={{
        position: 'absolute', bottom: 28, left: 32,
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: 22,
        color: '#4ade80',
        letterSpacing: '-0.04em',
        opacity: 0.7,
      }}>S4</div>
    </div>
  );
}

/* ══ BUBBLE OVERVIEW ═══════════════════════════════════════════════ */
function BubbleOverview({ portfolio }: { portfolio: PortfolioData }) {
  const [active, setActive] = useState<BubbleCategory | null>(null);

  const bubbleData: Record<BubbleCategory, { invested: number; current: number; items: { name: string; invested: number; current: number; cat: InvestmentCategory }[] }> = {
    stocks: { invested: 0, current: 0, items: [] },
    mutual_funds: { invested: 0, current: 0, items: [] },
    gold: { invested: 0, current: 0, items: [] },
    fd_rd: { invested: 0, current: 0, items: [] },
    retirement: { invested: 0, current: 0, items: [] },
    govt: { invested: 0, current: 0, items: [] },
  };

  portfolio.sips.forEach(s => {
    const bc = CATEGORY_BUBBLE[s.category];
    const inv = calcSIPInvested(s);
    const cur = calcSIPCurrentValue(s);
    bubbleData[bc].invested += inv;
    bubbleData[bc].current  += cur;
    bubbleData[bc].items.push({ name: s.name, invested: inv, current: cur, cat: s.category });
  });
  portfolio.manualInvestments.forEach(m => {
    const bc = CATEGORY_BUBBLE[m.category];
    const inv = m.amount;
    const cur = calcManualCurrentValue(m, portfolio.goldPrice);
    bubbleData[bc].invested += inv;
    bubbleData[bc].current  += cur;
    bubbleData[bc].items.push({ name: m.name, invested: inv, current: cur, cat: m.category });
  });

  const totalCurrent = Object.values(bubbleData).reduce((s, b) => s + b.current, 0);
  const maxVal = Math.max(...Object.values(bubbleData).map(b => b.current), 1);

  // Size: min 80px, max 170px based on value
  const getSize = (val: number) => 80 + (val / maxVal) * 90;

  const categories = Object.keys(bubbleData) as BubbleCategory[];

  return (
    <div>
      {/* Bubble grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', padding: '32px 0 24px' }}>
        {categories.map(bc => {
          const data = bubbleData[bc];
          const meta = BUBBLE_META[bc];
          const size = getSize(data.current);
          const pct = totalCurrent > 0 ? (data.current / totalCurrent * 100) : 0;
          const gain = data.current - data.invested;
          const gainPct = data.invested > 0 ? (gain / data.invested * 100) : 0;
          const isActive = active === bc;

          return (
            <div key={bc} onClick={() => setActive(isActive ? null : bc)}
              style={{
                width: size, height: size,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${meta.color}22, ${meta.color}08)`,
                border: `1.5px solid ${isActive ? meta.color : meta.color + '44'}`,
                boxShadow: isActive ? `0 0 32px ${meta.glow}, 0 0 8px ${meta.glow}` : `0 0 16px ${meta.glow}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                userSelect: 'none',
                flexShrink: 0,
              }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: meta.color, letterSpacing: '0.04em', textAlign: 'center', padding: '0 8px', lineHeight: 1.2 }}>{meta.label}</div>
              <div style={{ fontSize: data.current > 0 ? Math.max(11, Math.min(16, size / 8)) : 11, fontWeight: 700, color: '#e2e8f0', fontFamily: "'Space Grotesk',sans-serif", marginTop: 4 }}>
                {data.current > 0 ? fmt(data.current) : '—'}
              </div>
              {data.current > 0 && (
                <div style={{ fontSize: 10, color: gainPct >= 0 ? '#4ade80' : '#f87171', marginTop: 2 }}>
                  {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                </div>
              )}
              {pct > 0 && (
                <div style={{ fontSize: 10, color: meta.color + 'aa', marginTop: 1 }}>{pct.toFixed(0)}%</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded panel */}
      {active && (() => {
        const data = bubbleData[active];
        const meta = BUBBLE_META[active];
        const gain = data.current - data.invested;
        const gainPct = data.invested > 0 ? (gain / data.invested * 100) : 0;
        return (
          <div style={{
            background: '#1c1f23',
            border: `1px solid ${meta.color}44`,
            borderRadius: 14,
            padding: 20,
            marginTop: 8,
            animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: `0 0 24px ${meta.glow}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: meta.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{meta.label}</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: '#e2e8f0' }}>{fmt(data.current)}</span>
                  <span style={{ fontSize: 12, color: gainPct >= 0 ? '#4ade80' : '#f87171' }}>{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}% · {gain >= 0 ? '+' : ''}{fmt(Math.abs(gain))}</span>
                </div>
              </div>
              <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ borderTop: '1px solid #2a2f36', paddingTop: 12 }}>
              {data.items.length === 0 ? (
                <p style={{ color: '#4a5568', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No holdings in this category yet.</p>
              ) : (
                data.items.map((item, i) => {
                  const g = item.current - item.invested;
                  const gp = item.invested > 0 ? (g / item.invested * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < data.items.length - 1 ? '1px solid #22262b' : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#e2e8f0' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>{CATEGORY_LABELS[item.cat]}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, fontFamily: "'Space Grotesk',sans-serif", color: '#e2e8f0' }}>{fmt(item.current)}</div>
                        <div style={{ fontSize: 11, color: gp >= 0 ? '#4ade80' : '#f87171', marginTop: 2 }}>{gp >= 0 ? '+' : ''}{gp.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ══ FORMS ══════════════════════════════════════════════════════════ */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="field-label">{label}</label>{children}</div>;
}

function SIPForm({ onSave, onClose }: { onSave: (s: SIP) => void; onClose: () => void }) {
  const [f, setF] = useState({ name:'', amount:'', startDate:'', sipDate:'7', category:'mutual_fund_sip' as InvestmentCategory, ticker:'', units:'', currentNav:'', notes:'' });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.name || !f.amount || !f.startDate) return;
    const cat = f.category;
    onSave({ id:generateId(), name:f.name, amount:parseFloat(f.amount), startDate:f.startDate, sipDate:parseInt(f.sipDate)||7, category:cat, assetClass:CATEGORY_ASSET_CLASS[cat], ticker:f.ticker||undefined, units:f.units?parseFloat(f.units):undefined, currentNav:f.currentNav?parseFloat(f.currentNav):undefined, notes:f.notes||undefined });
    onClose();
  };
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h2 className="display" style={{ fontSize:22 }}>Add SIP</h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <div style={{ display:'grid', gap:20 }}>
        <Field label="Fund / scheme name *"><input placeholder="e.g. Mirae Asset Flexi Cap" value={f.name} onChange={e=>set('name',e.target.value)}/></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Monthly amount (₹) *"><input type="number" placeholder="10000" value={f.amount} onChange={e=>set('amount',e.target.value)}/></Field>
          <Field label="SIP date (day of month)"><input type="number" min="1" max="28" placeholder="7" value={f.sipDate} onChange={e=>set('sipDate',e.target.value)}/></Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Start date *"><input type="date" value={f.startDate} onChange={e=>set('startDate',e.target.value)}/></Field>
          <Field label="Category">
            <select value={f.category} onChange={e=>set('category',e.target.value)}>
              <option value="mutual_fund_sip">Mutual Fund SIP</option>
              <option value="stock_india">India Stock SIP</option>
              <option value="stock_us">US Stock SIP</option>
              <option value="gold">Gold SIP</option>
              <option value="nps">NPS</option>
            </select>
          </Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          <Field label="Ticker (optional)"><input placeholder="HDFCBANK.NS" value={f.ticker} onChange={e=>set('ticker',e.target.value)}/></Field>
          <Field label="Units held"><input type="number" placeholder="0" value={f.units} onChange={e=>set('units',e.target.value)}/></Field>
          <Field label="Current NAV"><input type="number" placeholder="0" value={f.currentNav} onChange={e=>set('currentNav',e.target.value)}/></Field>
        </div>
        <Field label="Notes"><input placeholder="Any notes..." value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
        <button className="btn-accent" onClick={submit}>Save SIP →</button>
      </div>
    </div>
  );
}

function ManualForm({ onSave, onClose }: { onSave: (m: ManualInvestment) => void; onClose: () => void }) {
  const [f, setF] = useState({ name:'', category:'stock_india' as InvestmentCategory, amount:'', date:'', units:'', buyPrice:'', ticker:'', maturityDate:'', maturityAmount:'', interestRate:'', notes:'' });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const cat = f.category;
  const isDebt  = ['fd','rd','bond','ppf','epf'].includes(cat);
  const isGold  = cat === 'gold';
  const isStock = ['stock_india','stock_us','mutual_fund_lumpsum'].includes(cat);
  const submit = () => {
    if (!f.name || !f.amount || !f.date) return;
    onSave({ id:generateId(), name:f.name, category:cat, assetClass:CATEGORY_ASSET_CLASS[cat], amount:parseFloat(f.amount), date:f.date, units:f.units?parseFloat(f.units):undefined, buyPrice:f.buyPrice?parseFloat(f.buyPrice):undefined, ticker:f.ticker||undefined, currentPrice:f.buyPrice?parseFloat(f.buyPrice):undefined, maturityDate:f.maturityDate||undefined, maturityAmount:f.maturityAmount?parseFloat(f.maturityAmount):undefined, interestRate:f.interestRate?parseFloat(f.interestRate)/100:undefined, notes:f.notes||undefined });
    onClose();
  };
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h2 className="display" style={{ fontSize:22 }}>Add investment</h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <div style={{ display:'grid', gap:20 }}>
        <Field label="Name *"><input placeholder="e.g. Infosys, HDFC FD, SGB 2023" value={f.name} onChange={e=>set('name',e.target.value)}/></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Category *">
            <select value={f.category} onChange={e=>set('category',e.target.value)}>
              <option value="stock_india">India Stock</option>
              <option value="stock_us">US Stock</option>
              <option value="mutual_fund_lumpsum">MF Lumpsum</option>
              <option value="gold">Gold</option>
              <option value="fd">Fixed Deposit</option>
              <option value="rd">Recurring Deposit</option>
              <option value="ppf">PPF</option>
              <option value="epf">EPF</option>
              <option value="nps">NPS</option>
              <option value="bond">Bond / SGB</option>
              <option value="chit_fund">Chit Fund</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date *"><input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Amount invested (₹) *"><input type="number" placeholder="50000" value={f.amount} onChange={e=>set('amount',e.target.value)}/></Field>
          {(isStock||isGold) && <Field label={isGold?'Grams purchased':'Units purchased'}><input type="number" placeholder="0" value={f.units} onChange={e=>set('units',e.target.value)}/></Field>}
          {isStock && <Field label="Buy price per unit (₹)"><input type="number" placeholder="0" value={f.buyPrice} onChange={e=>set('buyPrice',e.target.value)}/></Field>}
        </div>
        {isStock && <Field label="Ticker (for live prices)"><input placeholder="INFY.NS · RELIANCE.NS · AAPL" value={f.ticker} onChange={e=>set('ticker',e.target.value)}/></Field>}
        {isDebt && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
            <Field label="Interest rate (%)"><input type="number" placeholder="7.5" value={f.interestRate} onChange={e=>set('interestRate',e.target.value)}/></Field>
            <Field label="Maturity date"><input type="date" value={f.maturityDate} onChange={e=>set('maturityDate',e.target.value)}/></Field>
            <Field label="Maturity amount (₹)"><input type="number" placeholder="0" value={f.maturityAmount} onChange={e=>set('maturityAmount',e.target.value)}/></Field>
          </div>
        )}
        <Field label="Notes"><input placeholder="Any notes..." value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
        <button className="btn-accent" onClick={submit}>Save investment →</button>
      </div>
    </div>
  );
}

/* ══ TOOLTIP ═══════════════════════════════════════════════════════ */
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#1c1f23', border:'1px solid #2a2f36', borderRadius:8, padding:'10px 14px', fontSize:11 }}>
      <div style={{ color:'#4a5568', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', gap:12, justifyContent:'space-between' }}>
          <span style={{ color:'#8892a4' }}>{p.name}</span>
          <span style={{ fontWeight:600, color:'#e2e8f0' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ══ MAIN APP ═══════════════════════════════════════════════════════ */
export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioData>(emptyPortfolio());
  const [tab, setTab] = useState<Tab>('overview');
  const [addMode, setAddMode] = useState<AddMode>('sip');
  const [refreshing, setRefreshing] = useState(false);
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [forecastYears, setForecastYears] = useState(10);
  const [forecastCagr,  setForecastCagr]  = useState(12);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); setPortfolio(loadPortfolio()); }, []);
  const save = useCallback((p: PortfolioData) => { setPortfolio(p); savePortfolio(p); }, []);

  /* ── Aggregates ── */
  const sipInvested = portfolio.sips.reduce((s,x) => s + calcSIPInvested(x), 0);
  const sipCurrent  = portfolio.sips.reduce((s,x) => s + calcSIPCurrentValue(x), 0);
  const manInvested = portfolio.manualInvestments.reduce((s,x) => s + x.amount, 0);
  const manCurrent  = portfolio.manualInvestments.reduce((s,x) => s + calcManualCurrentValue(x, portfolio.goldPrice), 0);
  const totalInvested = sipInvested + manInvested;
  const totalCurrent  = sipCurrent  + manCurrent;
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const monthlySIP    = portfolio.sips.reduce((s,x) => s + x.amount, 0);
  const allDates = [...portfolio.sips.map(s=>new Date(s.startDate).getTime()), ...portfolio.manualInvestments.map(m=>new Date(m.date).getTime())];
  const yearsInvested = allDates.length ? (Date.now()-Math.min(...allDates))/(1000*60*60*24*365) : 0;
  const xirrVal = xirr(totalInvested, totalCurrent, Math.max(yearsInvested, 0.1));

  const growthData = Array.from({length:13},(_,i)=>{
    const back=12-i; const d=new Date(); d.setMonth(d.getMonth()-back);
    return { label:d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}), Invested:Math.max(0,Math.round(totalInvested*(1-back*0.072))), Value:Math.max(0,Math.round(totalCurrent*(1-back*0.052))) };
  });

  const forecastData = Array.from({length:forecastYears},(_,i)=>{
    const y=i+1;
    return { year:`Y${y}`, Bear:Math.round(sipForecast(monthlySIP,totalCurrent,y,(forecastCagr-4)/100)), Base:Math.round(sipForecast(monthlySIP,totalCurrent,y,forecastCagr/100)), Bull:Math.round(sipForecast(monthlySIP,totalCurrent,y,(forecastCagr+4)/100)) };
  });
  const targetCorpus = forecastData[forecastYears-1]?.Base ?? 0;

  const alerts: string[] = [];
  if (totalCurrent > 0) {
    const equityVal = portfolio.sips.filter(s=>s.assetClass==='equity').reduce((s,x)=>s+calcSIPCurrentValue(x),0) + portfolio.manualInvestments.filter(m=>m.assetClass==='equity').reduce((s,x)=>s+calcManualCurrentValue(x,portfolio.goldPrice),0);
    if (equityVal/totalCurrent > 0.8) alerts.push('Equity above 80% — consider adding debt or gold');
  }
  portfolio.manualInvestments.forEach(m=>{
    if (!m.maturityDate) return;
    const days=Math.ceil((new Date(m.maturityDate).getTime()-Date.now())/86400000);
    if (days>0&&days<60) alerts.push(`${m.name} matures in ${days} days — plan reinvestment`);
  });

  /* ── Refresh prices ── */
  const refreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      const goldRes = await fetch('/api/prices?type=gold');
      const goldData = await goldRes.json();
      const tickers = [...portfolio.sips.map(s=>s.ticker), ...portfolio.manualInvestments.map(m=>m.ticker)].filter(Boolean).join(',');
      let stockData: Record<string,{price:number;change:number}> = {};
      if (tickers) { const r = await fetch(`/api/prices?type=stocks&tickers=${encodeURIComponent(tickers)}`); stockData = await r.json(); }
      const np = { ...portfolio };
      if (goldData.pricePerGram) np.goldPrice = { pricePerGram:goldData.pricePerGram, change:goldData.change??0, fetchedAt:new Date().toISOString() };
      np.manualInvestments = portfolio.manualInvestments.map(m => m.ticker&&stockData[m.ticker] ? {...m,currentPrice:stockData[m.ticker].price} : m);
      np.sips = portfolio.sips.map(s => s.ticker&&stockData[s.ticker] ? {...s,currentNav:stockData[s.ticker].price} : s);
      save(np);
    } catch(e) { console.error(e); }
    setRefreshing(false);
  }, [portfolio, save]);

  /* ── AI ── */
  const askAI = async () => {
    if (!question.trim()) return;
    setAiLoading(true); setAiAnswer('');
    try {
      const summary = JSON.stringify({ totalInvested:fmtFull(totalInvested), totalCurrent:fmtFull(totalCurrent), totalGain:fmtFull(totalGain), xirr:xirrVal.toFixed(1)+'%', monthlySIP:fmtFull(monthlySIP), sips:portfolio.sips.map(s=>({name:s.name,amount:s.amount,category:s.category,invested:calcSIPInvested(s),value:calcSIPCurrentValue(s)})), manual:portfolio.manualInvestments.map(m=>({name:m.name,category:m.category,amount:m.amount,value:calcManualCurrentValue(m,portfolio.goldPrice)})), goldPrice:portfolio.goldPrice?.pricePerGram });
      const res = await fetch('/api/ask', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({question,portfolioSummary:summary}) });
      const data = await res.json();
      setAiAnswer(data.answer || data.error || 'No response.');
    } catch { setAiAnswer('Could not reach AI. Check ANTHROPIC_API_KEY.'); }
    setAiLoading(false);
  };

  if (!mounted) return null;
  if (showIntro) return <IntroScreen onEnter={() => setShowIntro(false)} />;

  const isEmpty = portfolio.sips.length === 0 && portfolio.manualInvestments.length === 0;

  const TABS: {key:Tab;label:string}[] = [
    {key:'overview',label:'Overview'},{key:'holdings',label:'Holdings'},{key:'sips',label:'SIPs'},
    {key:'forecast',label:'Forecast'},{key:'ask',label:'Ask AI'},{key:'add',label:'+ Add'},
  ];

  return (
    <>
      <Head><title>S4 — InvestOS</title><meta name="viewport" content="width=device-width, initial-scale=1"/></Head>

      {/* ── Header ── */}
      <header style={{ borderBottom:'1px solid #22262b', position:'sticky', top:0, zIndex:50, background:'#141618ee', backdropFilter:'blur(16px)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:54 }}>
          {/* S4 monogram */}
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:20, color:'#4ade80', letterSpacing:'-0.04em', cursor:'default', userSelect:'none' }}>
            S4
            <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:400, fontSize:11, color:'#4a5568', marginLeft:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>portfolio</span>
          </div>
          {/* Nav */}
          <nav style={{ display:'flex', gap:2 }}>
            {TABS.map(({key,label}) => (
              <button key={key} onClick={() => setTab(key)} style={{ background:tab===key?'#1c1f23':'none', border:tab===key?'1px solid #2a2f36':'1px solid transparent', color:tab===key?'#e2e8f0':'#4a5568', borderRadius:8, padding:'5px 14px', fontSize:12, cursor:'pointer', transition:'all 0.15s', fontFamily:"'Inter',sans-serif", fontWeight:500 }}>
                {label}
              </button>
            ))}
          </nav>
          {/* Right */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {portfolio.goldPrice && (
              <span style={{ fontSize:11, color:'#f59e0b', fontFamily:"'Space Grotesk',sans-serif", fontWeight:500 }}>
                ₹{portfolio.goldPrice.pricePerGram.toLocaleString('en-IN')}/g
                <span style={{ marginLeft:4, color:portfolio.goldPrice.change>=0?'#4ade80':'#f87171' }}>{portfolio.goldPrice.change>=0?'↑':'↓'}{Math.abs(portfolio.goldPrice.change).toFixed(1)}%</span>
              </span>
            )}
            <button className="btn" onClick={refreshPrices} disabled={refreshing} style={{ fontSize:11 }}>
              {refreshing ? '↻ Refreshing…' : '↻ Refresh prices'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding:'28px 32px 60px', maxWidth:1160, margin:'0 auto' }}>

        {/* ── Empty state ── */}
        {isEmpty && tab !== 'add' && (
          <div style={{ textAlign:'center', padding:'100px 0' }}>
            <div style={{ fontSize:60, marginBottom:20 }}>₹</div>
            <h1 className="display" style={{ fontSize:36, marginBottom:12, color:'#e2e8f0' }}>Start tracking your wealth</h1>
            <p style={{ color:'#4a5568', marginBottom:32 }}>Add your first SIP or investment to get started</p>
            <button className="btn-accent" onClick={() => setTab('add')}>Add first investment →</button>
          </div>
        )}

        {/* ══ OVERVIEW ══ */}
        {tab === 'overview' && !isEmpty && (
          <div style={{ display:'grid', gap:20 }}>
            {/* Hero */}
            <div style={{ padding:'8px 0 4px' }}>
              <div className="eyebrow" style={{ marginBottom:10 }}>Total portfolio value</div>
              <div className="display" style={{ fontSize:56, color:'#e2e8f0', marginBottom:8 }}>
                {fmt(totalCurrent)}
              </div>
              <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                <span style={{ color:'#4a5568', fontSize:13 }}>Invested {fmt(totalInvested)}</span>
                <span style={{ fontSize:13, fontWeight:500, color:totalGain>=0?'#4ade80':'#f87171' }}>
                  {totalGain>=0?'↑':'↓'} {fmt(Math.abs(totalGain))} ({fmtPct(gainPct)})
                </span>
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                {label:'XIRR', value:`${xirrVal.toFixed(1)}%`, sub:xirrVal>12?'↑ beats avg':'↓ below avg', good:xirrVal>12},
                {label:'Monthly SIP', value:fmt(monthlySIP), sub:`${portfolio.sips.length} active SIPs`},
                {label:'Total gain', value:fmt(Math.abs(totalGain)), sub:fmtPct(gainPct), good:totalGain>=0},
                {label:'Holdings', value:String(portfolio.sips.length+portfolio.manualInvestments.length), sub:'instruments'},
              ].map(k => (
                <div key={k.label} className="card" style={{ borderColor:'#22262b' }}>
                  <div className="eyebrow" style={{ marginBottom:8 }}>{k.label}</div>
                  <div className="display" style={{ fontSize:26, color:'#e2e8f0' }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize:11, marginTop:6, color:k.good!==undefined?(k.good?'#4ade80':'#f87171'):'#4a5568' }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* Alerts */}
            {alerts.map((a,i) => (
              <div key={i} style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:'10px 16px', fontSize:13, color:'#f59e0b', display:'flex', gap:10 }}>
                <span>⚠</span>{a}
              </div>
            ))}

            {/* Bubble overview */}
            <div className="card">
              <div className="eyebrow" style={{ marginBottom:4 }}>Portfolio by category</div>
              <p style={{ fontSize:12, color:'#4a5568', marginBottom:8 }}>Bubble size = value · click to expand</p>
              <BubbleOverview portfolio={portfolio} />
            </div>

            {/* Growth chart */}
            <div className="card">
              <div className="eyebrow" style={{ marginBottom:16 }}>Growth — 12 months</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={growthData} margin={{top:4,right:0,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{fill:'#4a5568',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Area type="monotone" dataKey="Invested" stroke="#2a2f36" strokeWidth={1} fill="none" dot={false}/>
                  <Area type="monotone" dataKey="Value" stroke="#4ade80" strokeWidth={2} fill="url(#gv)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══ HOLDINGS ══ */}
        {tab === 'holdings' && (
          <div style={{ paddingTop:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 className="display" style={{ fontSize:28, color:'#e2e8f0' }}>Holdings</h2>
              <span className="eyebrow">{portfolio.sips.length+portfolio.manualInvestments.length} instruments</span>
            </div>
            <table className="ink-table">
              <thead><tr><th>Name</th><th>Category</th><th>Invested</th><th>Current</th><th>Gain/Loss</th><th>Return</th><th></th></tr></thead>
              <tbody>
                {portfolio.sips.map(sip => {
                  const inv=calcSIPInvested(sip), cur=calcSIPCurrentValue(sip), gain=cur-inv, gp=inv>0?(gain/inv*100):0;
                  return <tr key={sip.id}>
                    <td style={{fontWeight:500}}>{sip.name}</td>
                    <td><span className={`tag ${BUBBLE_META[CATEGORY_BUBBLE[sip.category]].tag}`}>{CATEGORY_LABELS[sip.category]}</span></td>
                    <td className="mono">{fmt(inv)}</td><td className="mono">{fmt(cur)}</td>
                    <td className={`mono ${gain>=0?'up':'down'}`}>{gain>=0?'+':''}{fmt(Math.abs(gain))}</td>
                    <td className={`mono ${gain>=0?'up':'down'}`}>{fmtPct(gp)}</td>
                    <td><button style={{background:'none',border:'none',cursor:'pointer',color:'#2a2f36',fontSize:16}} onClick={()=>save({...portfolio,sips:portfolio.sips.filter(s=>s.id!==sip.id)})}>×</button></td>
                  </tr>;
                })}
                {portfolio.manualInvestments.map(inv => {
                  const cur=calcManualCurrentValue(inv,portfolio.goldPrice), gain=cur-inv.amount, gp=inv.amount>0?(gain/inv.amount*100):0;
                  return <tr key={inv.id}>
                    <td><div style={{fontWeight:500}}>{inv.name}</div>{inv.ticker&&<div style={{fontSize:10,color:'#4a5568',fontFamily:'monospace',marginTop:2}}>{inv.ticker}</div>}</td>
                    <td><span className={`tag ${BUBBLE_META[CATEGORY_BUBBLE[inv.category]].tag}`}>{CATEGORY_LABELS[inv.category]}</span></td>
                    <td className="mono">{fmt(inv.amount)}</td><td className="mono">{fmt(cur)}</td>
                    <td className={`mono ${gain>=0?'up':'down'}`}>{gain>=0?'+':''}{fmt(Math.abs(gain))}</td>
                    <td className={`mono ${gain>=0?'up':'down'}`}>{fmtPct(gp)}</td>
                    <td><button style={{background:'none',border:'none',cursor:'pointer',color:'#2a2f36',fontSize:16}} onClick={()=>save({...portfolio,manualInvestments:portfolio.manualInvestments.filter(m=>m.id!==inv.id)})}>×</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
            {isEmpty && <p style={{color:'#4a5568',padding:'40px 0',textAlign:'center'}}>No holdings yet.</p>}
          </div>
        )}

        {/* ══ SIPS ══ */}
        {tab === 'sips' && (
          <div style={{ paddingTop:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 className="display" style={{ fontSize:28, color:'#e2e8f0' }}>SIPs</h2>
              <button className="btn-accent" style={{ padding:'8px 16px', fontSize:12 }} onClick={()=>{setTab('add');setAddMode('sip')}}>+ Add SIP</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
              {portfolio.sips.map(sip => {
                const inv=calcSIPInvested(sip), cur=calcSIPCurrentValue(sip);
                const months=Math.max(0,Math.round(inv/sip.amount));
                const next=new Date(); next.setDate(sip.sipDate); if(next<=new Date()) next.setMonth(next.getMonth()+1);
                const meta=BUBBLE_META[CATEGORY_BUBBLE[sip.category]];
                return (
                  <div key={sip.id} className="card" style={{ borderColor:meta.color+'33' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                      <div><div style={{fontWeight:500,fontSize:14,marginBottom:6}}>{sip.name}</div><span className={`tag ${meta.tag}`}>{CATEGORY_LABELS[sip.category]}</span></div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:20, color:meta.color }}>{fmt(sip.amount)}</div>
                        <div style={{ fontSize:11, color:'#4a5568' }}>/month</div>
                      </div>
                    </div>
                    <div className="divider"/>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {[{l:'Invested',v:fmt(inv)},{l:'Current',v:fmt(cur)},{l:'Months',v:String(months)},{l:'Next SIP',v:next.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}].map(({l,v})=>(
                        <div key={l}><div className="eyebrow" style={{marginBottom:2}}>{l}</div><div className="mono" style={{fontWeight:500,fontSize:13}}>{v}</div></div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {portfolio.sips.length===0 && <p style={{color:'#4a5568',padding:'40px 0'}}>No SIPs yet.</p>}
            </div>
          </div>
        )}

        {/* ══ FORECAST ══ */}
        {tab === 'forecast' && (
          <div style={{ paddingTop:20 }}>
            <div style={{ marginBottom:24 }}>
              <h2 className="display" style={{ fontSize:28, color:'#e2e8f0', marginBottom:8 }}>Forecast</h2>
              <div className="display" style={{ fontSize:48, color:'#4ade80' }}>{fmt(targetCorpus)}</div>
              <p style={{ color:'#4a5568', fontSize:13, marginTop:6 }}>projected corpus in {forecastYears} years at {forecastCagr}% CAGR</p>
            </div>
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ display:'flex', gap:40, flexWrap:'wrap', marginBottom:20 }}>
                {[{label:'Years',val:forecastYears,min:5,max:30,set:setForecastYears,unit:'yr'},{label:'CAGR',val:forecastCagr,min:6,max:20,set:setForecastCagr,unit:'%'}].map(({label,val,min,max,set,unit})=>(
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div className="eyebrow" style={{ minWidth:50 }}>{label}</div>
                    <input type="range" min={min} max={max} value={val} onChange={e=>set(+e.target.value)} style={{width:130}}/>
                    <div className="display" style={{ fontSize:22, color:'#e2e8f0', minWidth:50 }}>{val}{unit}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={forecastData} margin={{top:4,right:0,bottom:0,left:0}} barGap={2}>
                  <XAxis dataKey="year" tick={{fill:'#4a5568',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Bar dataKey="Bear" fill="#22262b" radius={[3,3,0,0]}/>
                  <Bar dataKey="Base" fill="#4ade80" radius={[3,3,0,0]}/>
                  <Bar dataKey="Bull" fill="#86efac" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[{l:'Bear case',v:forecastData[forecastYears-1]?.Bear??0,c:'#f87171'},{l:'Base case',v:targetCorpus,c:'#4ade80'},{l:'Bull case',v:forecastData[forecastYears-1]?.Bull??0,c:'#86efac'}].map(({l,v,c})=>(
                <div key={l} className="card" style={{ textAlign:'center' }}>
                  <div className="eyebrow" style={{ marginBottom:8 }}>{l}</div>
                  <div className="display" style={{ fontSize:24, color:c }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ASK AI ══ */}
        {tab === 'ask' && (
          <div style={{ paddingTop:20, maxWidth:640 }}>
            <h2 className="display" style={{ fontSize:28, color:'#e2e8f0', marginBottom:8 }}>Ask AI</h2>
            <p style={{ color:'#4a5568', marginBottom:28, fontSize:13 }}>Your full portfolio is the context. Ask anything.</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
              {['What should I rebalance?','Am I on track?','What\'s dragging returns?','Analyse my SIP mix'].map(q=>(
                <button key={q} className="btn-ghost" onClick={()=>setQuestion(q)}>{q}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:24 }}>
              <input placeholder="Ask anything about your portfolio…" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} style={{ flex:1 }}/>
              <button className="btn-accent" onClick={askAI} disabled={aiLoading} style={{ padding:'9px 20px', flexShrink:0 }}>{aiLoading?'…':'Ask →'}</button>
            </div>
            {aiAnswer && (
              <div className="card" style={{ borderColor:'#4ade8033' }}>
                <div style={{ fontSize:11, color:'#4ade80', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>Analysis</div>
                <p style={{ fontSize:14, lineHeight:1.8, whiteSpace:'pre-wrap', color:'#e2e8f0' }}>{aiAnswer}</p>
              </div>
            )}
          </div>
        )}

        {/* ══ ADD ══ */}
        {tab === 'add' && (
          <div style={{ paddingTop:20 }}>
            <div style={{ display:'flex', gap:10, marginBottom:28 }}>
              <button className={addMode==='sip'?'btn-accent':'btn-ghost'} onClick={()=>setAddMode('sip')}>Regular SIP</button>
              <button className={addMode==='manual'?'btn-accent':'btn-ghost'} onClick={()=>setAddMode('manual')}>One-time / manual</button>
            </div>
            <div className="card" style={{ maxWidth:560 }}>
              {addMode==='sip' && <SIPForm onSave={sip=>{save({...portfolio,sips:[...portfolio.sips,sip]});setTab('sips');}} onClose={()=>setTab('overview')}/>}
              {addMode==='manual' && <ManualForm onSave={inv=>{save({...portfolio,manualInvestments:[...portfolio.manualInvestments,inv]});setTab('holdings');}} onClose={()=>setTab('overview')}/>}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
