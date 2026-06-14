import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  loadPortfolio, savePortfolio, generateId, emptyPortfolio,
  calcSIPInvested, calcSIPCurrentValue, calcManualCurrentValue,
  xirr, sipForecast, CATEGORY_LABELS, CATEGORY_ASSET_CLASS,
  CATEGORY_BUBBLE, BUBBLE_META, LIABILITY_LABELS, LIABILITY_IS_INFORMAL,
  type PortfolioData, type SIP, type ManualInvestment,
  type InvestmentCategory, type BubbleCategory, type Liability, type LiabilityCategory,
} from '../lib/storage';

const fmt = (n:number) => n>=10000000?`₹${(n/10000000).toFixed(2)}Cr`:n>=100000?`₹${(n/100000).toFixed(2)}L`:n>=1000?`₹${(n/1000).toFixed(1)}K`:`₹${Math.round(n)}`;
const fmtFull = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtPct  = (n:number) => `${n>=0?'+':''}${n.toFixed(2)}%`;

type Tab = 'overview'|'portfolio'|'add'|'plan';
type AddMode = 'sip'|'manual'|'liability';

/* ══ INTRO: SQUARE CEILING PANEL LIGHTS ═══════════════════════════ */
function IntroScreen({ onEnter }: { onEnter:()=>void }) {
  const [lights, setLights] = useState([false,false,false,false,false]);
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState('');
  const [showBtn, setShowBtn] = useState(false);
  const full = 'Track every rupee.';

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    [0,1,2,3,4].forEach(i => {
      timers.push(setTimeout(() => {
        let flickers = 0;
        const maxF = 4 + Math.floor(Math.random()*4);
        const flicker = () => {
          setLights(l => { const n=[...l]; n[i]=!n[i]; return n; });
          flickers++;
          if (flickers < maxF*2) setTimeout(flicker, 50+Math.random()*140);
          else setLights(l => { const n=[...l]; n[i]=true; return n; });
        };
        flicker();
      }, 300 + i*600));
    });
    timers.push(setTimeout(() => setPhase(1), 4200));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    let i = 0;
    const iv = setInterval(() => {
      setTyped(full.slice(0,i+1)); i++;
      if (i >= full.length) { clearInterval(iv); setTimeout(()=>setShowBtn(true),300); }
    }, 65);
    return () => clearInterval(iv);
  }, [phase]);

  const anyOn = lights.some(Boolean);

  // Square panel light
  const Panel = ({ on }: { on: boolean }) => (
    <div style={{
      width: 110, height: 110,
      background: on
        ? 'linear-gradient(145deg,#f0fff0,#d4f5d4,#e8ffe8)'
        : '#0c110c',
      borderRadius: 4,
      border: `1px solid ${on ? 'rgba(180,255,160,0.5)' : '#141a14'}`,
      boxShadow: on
        ? '0 0 60px 20px rgba(160,255,120,0.25), 0 0 120px 40px rgba(74,222,128,0.12), inset 0 0 30px rgba(200,255,180,0.3)'
        : 'inset 0 0 8px rgba(0,0,0,0.5)',
      transition: 'background 0.03s, box-shadow 0.03s',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Panel grid lines */}
      <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:1 }}>
        {[0,1,2,3].map(k => (
          <div key={k} style={{ background: on ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.02)', borderRadius:2 }}/>
        ))}
      </div>
      {/* Recessed edge shadow */}
      <div style={{ position:'absolute', inset:3, border:`1px solid ${on?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.03)'}`, borderRadius:2 }}/>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, background:'#060908', display:'flex', flexDirection:'column', alignItems:'center', overflow:'hidden' }}>
      {/* Ceiling mount bar */}
      <div style={{ width:'100%', background:'#080d08', borderBottom:'2px solid #101510', padding:'20px 0 20px', display:'flex', justifyContent:'center', gap:28 }}>
        {lights.map((on,i) => <Panel key={i} on={on}/>)}
      </div>

      {/* Light cones */}
      <div style={{ position:'absolute', top:152, left:0, right:0, display:'flex', justifyContent:'center', gap:28, pointerEvents:'none' }}>
        {lights.map((on,i) => (
          <div key={i} style={{
            width:110, height: on?'65vh':0,
            background: on ? 'linear-gradient(180deg,rgba(160,255,120,0.07) 0%,transparent 100%)' : 'none',
            transition:'height 0.4s ease',
            clipPath:'polygon(5% 0%,95% 0%,100% 100%,0% 100%)',
          }}/>
        ))}
      </div>

      {/* Center content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, gap:24, marginTop:-40 }}>
        <div style={{
          fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:64,
          color: anyOn ? '#4ade80' : '#0f1a0f',
          letterSpacing:'-0.05em', userSelect:'none',
          textShadow: anyOn ? '0 0 60px rgba(74,222,128,0.7),0 0 120px rgba(74,222,128,0.3)' : 'none',
          transition:'color 0.5s,text-shadow 0.5s',
        }}>S4</div>

        {anyOn && (
          <div style={{ fontSize:80, fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, color:'transparent', WebkitTextStroke:'2px #4ade80', filter:'drop-shadow(0 0 24px rgba(74,222,128,0.6))', animation:'fadeIn 0.7s ease', userSelect:'none', lineHeight:1 }}>₹</div>
        )}

        {phase >= 1 && (
          <div style={{ fontSize:28, fontWeight:500, color:'#c8e6c0', fontFamily:"'Space Grotesk',sans-serif", letterSpacing:'-0.01em', textAlign:'center', minHeight:40 }}>
            {typed}<span style={{ opacity:showBtn?0:1, color:'#4ade80', transition:'opacity 0.3s' }}>|</span>
          </div>
        )}

        {showBtn && (
          <button onClick={onEnter} className="btn-accent" style={{ fontSize:14, padding:'13px 40px', letterSpacing:'0.05em', animation:'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
            Enter dashboard →
          </button>
        )}
      </div>

      <div style={{ position:'absolute', bottom:24, right:28, fontFamily:"'Inter',sans-serif", fontSize:10, color:'#1a2a1a', letterSpacing:'0.1em', textTransform:'uppercase' }}>Personal finance OS</div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes scaleIn{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

/* ══ FLOATING BUBBLES ════════════════════════════════════════════════ */
interface BubbleState {
  key:string; x:number; y:number; vx:number; vy:number; size:number;
  color:string; glow:string; label:string; value:number; gainPct:number;
  isCenter:boolean; isLiability?:boolean; bc?:BubbleCategory;
}

function FloatingBubbles({ portfolio, onBubbleClick }: { portfolio:PortfolioData; onBubbleClick:(bc:BubbleCategory)=>void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef   = useRef<BubbleState[]>([]);
  const rafRef       = useRef<number>(0);
  const [, setTick]  = useState(0);

  const totalLiabilities = (portfolio.liabilities||[]).reduce((s,l)=>s+l.outstandingAmount,0);

  const buildBubbles = useCallback(() => {
    const W = containerRef.current?.clientWidth||720;
    const H = containerRef.current?.clientHeight||480;
    type BC = BubbleCategory;
    const cats:BC[] = ['stocks','mutual_funds','commodities','fd_rd','retirement','govt'];
    const data:Record<BC,{invested:number;current:number}> = {
      stocks:{invested:0,current:0},mutual_funds:{invested:0,current:0},
      commodities:{invested:0,current:0},fd_rd:{invested:0,current:0},
      retirement:{invested:0,current:0},govt:{invested:0,current:0},
    };
    portfolio.sips.forEach(s => {
      const bc=CATEGORY_BUBBLE[s.category];
      data[bc].invested+=calcSIPInvested(s); data[bc].current+=calcSIPCurrentValue(s);
    });
    portfolio.manualInvestments.forEach(m => {
      const bc=CATEGORY_BUBBLE[m.category];
      data[bc].invested+=m.amount; data[bc].current+=calcManualCurrentValue(m,portfolio.goldPrice);
    });
    const totalAssets = cats.reduce((s,c)=>s+data[c].current,0);
    const netWorth = totalAssets - totalLiabilities;
    const totalInvested = cats.reduce((s,c)=>s+data[c].invested,0);
    const netGainPct = totalInvested>0?((totalAssets-totalInvested)/totalInvested)*100:0;
    const maxVal = Math.max(...cats.map(c=>data[c].current),1);
    const existing = bubblesRef.current;
    const findEx = (k:string) => existing.find(b=>b.key===k);

    // Center: net worth
    const cSize = Math.min(W,H)*0.27;
    const ex0 = findEx('center');
    const center:BubbleState = ex0||{
      key:'center',x:W/2-cSize/2,y:H/2-cSize/2,
      vx:(Math.random()-0.5)*0.25,vy:(Math.random()-0.5)*0.25,
      size:cSize,color:'#4ade80',glow:'rgba(74,222,128,0.35)',
      label:'Net Worth',value:netWorth,gainPct:netGainPct,isCenter:true,
    };
    center.value=netWorth; center.gainPct=netGainPct; center.size=cSize;

    // Liabilities bubble
    const lSize = totalLiabilities>0 ? Math.max(64, Math.min(120, 64+(totalLiabilities/Math.max(totalAssets,1))*120)) : 60;
    const exL = findEx('liabilities');
    const liabBubble:BubbleState = exL||{
      key:'liabilities',x:W*0.8,y:H*0.2,
      vx:(Math.random()-0.5)*0.4,vy:(Math.random()-0.5)*0.4,
      size:lSize,color:'#f87171',glow:'rgba(248,113,113,0.3)',
      label:'Liabilities',value:totalLiabilities,gainPct:0,isCenter:false,isLiability:true,
    };
    liabBubble.value=totalLiabilities; liabBubble.size=lSize;

    // Category bubbles
    const catBubbles:BubbleState[] = cats.map(bc => {
      const meta=BUBBLE_META[bc];
      const val=data[bc].current, inv=data[bc].invested;
      const gp=inv>0?((val-inv)/inv)*100:0;
      const size=val>0?80+(val/maxVal)*90:62;
      const exB=findEx(bc);
      if(exB){exB.value=val;exB.gainPct=gp;exB.size=size;return exB;}
      const angle=Math.random()*Math.PI*2;
      const dist=Math.min(W,H)*0.32;
      return{key:bc,x:W/2+Math.cos(angle)*dist-size/2,y:H/2+Math.sin(angle)*dist-size/2,vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.5,size,color:meta.color,glow:meta.glow,label:meta.label,value:val,gainPct:gp,isCenter:false,bc};
    });

    bubblesRef.current = [center, liabBubble, ...catBubbles];
  }, [portfolio, totalLiabilities]);

  useEffect(()=>{buildBubbles();},[buildBubbles]);

  useEffect(()=>{
    const animate=()=>{
      const W=containerRef.current?.clientWidth||720;
      const H=containerRef.current?.clientHeight||480;
      const bs=bubblesRef.current;
      bs.forEach(b=>{
        b.x+=b.vx; b.y+=b.vy;
        const pad=8;
        if(b.x<pad){b.x=pad;b.vx=Math.abs(b.vx);}
        if(b.x+b.size>W-pad){b.x=W-pad-b.size;b.vx=-Math.abs(b.vx);}
        if(b.y<pad){b.y=pad;b.vy=Math.abs(b.vy);}
        if(b.y+b.size>H-pad){b.y=H-pad-b.size;b.vy=-Math.abs(b.vy);}
        if(b.isCenter){
          const cx=W/2-b.size/2,cy=H/2-b.size/2;
          b.vx+=(cx-b.x)*0.0003; b.vy+=(cy-b.y)*0.0003;
        }
        const maxSpd=b.isCenter?0.35:0.65;
        const spd=Math.sqrt(b.vx*b.vx+b.vy*b.vy);
        if(spd>maxSpd){b.vx=(b.vx/spd)*maxSpd;b.vy=(b.vy/spd)*maxSpd;}
      });
      for(let i=0;i<bs.length;i++) for(let j=i+1;j<bs.length;j++){
        const a=bs[i],b2=bs[j];
        const acx=a.x+a.size/2,acy=a.y+a.size/2,bcx=b2.x+b2.size/2,bcy=b2.y+b2.size/2;
        const dx=acx-bcx,dy=acy-bcy,dist=Math.sqrt(dx*dx+dy*dy);
        const minD=(a.size+b2.size)/2+10;
        if(dist<minD&&dist>0){
          const f=(minD-dist)/minD*0.06,nx=dx/dist,ny=dy/dist;
          if(!a.isCenter){a.vx+=nx*f;a.vy+=ny*f;}
          if(!b2.isCenter){b2.vx-=nx*f;b2.vy-=ny*f;}
        }
      }
      setTick(t=>t+1);
      rafRef.current=requestAnimationFrame(animate);
    };
    rafRef.current=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);

  const bubbles=bubblesRef.current;
  return(
    <div ref={containerRef} style={{position:'relative',width:'100%',height:480,overflow:'hidden'}}>
      {bubbles.map(b=>(
        <div key={b.key} onClick={()=>!b.isCenter&&!b.isLiability&&b.bc&&onBubbleClick(b.bc)}
          style={{
            position:'absolute',left:b.x,top:b.y,width:b.size,height:b.size,
            borderRadius:'50%',
            background:`radial-gradient(circle at 38% 32%,${b.color}${b.isLiability?'18':'22'},${b.color}06)`,
            border:`${b.isCenter?2:1.5}px solid ${b.color}${b.isLiability?'44':'55'}`,
            boxShadow:`0 0 ${b.isCenter?44:22}px ${b.glow},inset 0 0 ${b.isCenter?20:10}px ${b.color}06`,
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            cursor:b.isCenter||b.isLiability?'default':'pointer',userSelect:'none',
          }}>
          <div style={{fontSize:b.isCenter?11:9,fontWeight:600,color:b.color,letterSpacing:'0.04em',textTransform:'uppercase',textAlign:'center',padding:'0 6px',lineHeight:1.2}}>
            {b.label}
          </div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:b.isCenter?Math.max(13,b.size/7):Math.max(10,b.size/8),color:b.isLiability?'#f87171':'#e2e8f0',marginTop:3,textAlign:'center',padding:'0 4px',lineHeight:1.1}}>
            {b.value>0?fmt(b.value):'—'}
          </div>
          {b.value>0&&!b.isLiability&&(
            <div style={{fontSize:9,color:b.gainPct>=0?'#4ade80':'#f87171',marginTop:2}}>
              {b.gainPct>=0?'+':''}{b.gainPct.toFixed(1)}%
            </div>
          )}
          {b.isLiability&&b.value>0&&<div style={{fontSize:9,color:'#f8717188',marginTop:2}}>outstanding</div>}
          {!b.isCenter&&!b.isLiability&&b.value===0&&<div style={{fontSize:9,color:b.color+'55',marginTop:2}}>tap to add</div>}
        </div>
      ))}
    </div>
  );
}

/* ══ BUBBLE DETAIL ══════════════════════════════════════════════════ */
function BubbleDetail({bc,portfolio,onClose,onDelete}:{bc:BubbleCategory;portfolio:PortfolioData;onClose:()=>void;onDelete:(type:'sip'|'manual',id:string)=>void}) {
  const meta=BUBBLE_META[bc];
  const items:{type:'sip'|'manual';id:string;name:string;cat:InvestmentCategory;invested:number;current:number}[]=[];
  portfolio.sips.forEach(s=>{if(CATEGORY_BUBBLE[s.category]===bc)items.push({type:'sip',id:s.id,name:s.name,cat:s.category,invested:calcSIPInvested(s),current:calcSIPCurrentValue(s)});});
  portfolio.manualInvestments.forEach(m=>{if(CATEGORY_BUBBLE[m.category]===bc)items.push({type:'manual',id:m.id,name:m.name,cat:m.category,invested:m.amount,current:calcManualCurrentValue(m,portfolio.goldPrice)});});
  const total=items.reduce((s,i)=>s+i.current,0);
  const totalInv=items.reduce((s,i)=>s+i.invested,0);
  const gain=total-totalInv,gainPct=totalInv>0?(gain/totalInv*100):0;
  return(
    <div style={{background:'#161a1e',border:`1px solid ${meta.color}44`,borderRadius:14,padding:20,marginTop:16}} className="anim-scale-in">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:meta.color,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>{meta.label}</div>
          <div style={{display:'flex',gap:16,alignItems:'baseline'}}>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:24,color:'#e2e8f0'}}>{fmt(total)}</span>
            <span style={{fontSize:12,color:gainPct>=0?'#4ade80':'#f87171'}}>{gainPct>=0?'+':''}{gainPct.toFixed(2)}% · {gain>=0?'+':''}{fmt(Math.abs(gain))}</span>
          </div>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#3d4a57',cursor:'pointer',fontSize:20}}>×</button>
      </div>
      <div style={{borderTop:'1px solid #1d2226',paddingTop:12}}>
        {items.length===0?<p style={{color:'#3d4a57',fontSize:13,textAlign:'center',padding:'20px 0'}}>No holdings in this category yet.</p>
        :items.map((item,i)=>{
          const g=item.current-item.invested,gp=item.invested>0?(g/item.invested*100):0;
          return(<div key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderBottom:i<items.length-1?'1px solid #1d2226':'none'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:13,color:'#e2e8f0'}}>{item.name}</div>
              <div style={{fontSize:10,color:'#3d4a57',marginTop:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>{CATEGORY_LABELS[item.cat]}</div>
            </div>
            <div style={{textAlign:'right',marginRight:14}}>
              <div style={{fontWeight:600,fontSize:13,fontFamily:"'Space Grotesk',sans-serif",color:'#e2e8f0'}}>{fmt(item.current)}</div>
              <div style={{fontSize:11,color:gp>=0?'#4ade80':'#f87171',marginTop:2}}>{gp>=0?'+':''}{gp.toFixed(1)}%</div>
            </div>
            <button onClick={()=>onDelete(item.type,item.id)} style={{background:'none',border:'1px solid #252b31',color:'#3d4a57',cursor:'pointer',fontSize:11,padding:'4px 10px',borderRadius:6,transition:'all 0.15s'}}
              onMouseEnter={e=>{(e.target as HTMLElement).style.color='#f87171';(e.target as HTMLElement).style.borderColor='rgba(248,113,113,0.4)'}}
              onMouseLeave={e=>{(e.target as HTMLElement).style.color='#3d4a57';(e.target as HTMLElement).style.borderColor='#252b31'}}>Delete</button>
          </div>);
        })}
      </div>
    </div>
  );
}

/* ══ FORMS ══════════════════════════════════════════════════════════ */
const ALL_CATEGORIES:{value:InvestmentCategory;label:string}[]=[
  {value:'mutual_fund_sip',label:'Mutual Fund SIP'},{value:'mutual_fund_lumpsum',label:'MF Lumpsum'},
  {value:'stock_india',label:'India Stock'},{value:'stock_us',label:'US Stock'},
  {value:'gold',label:'Gold'},{value:'silver',label:'Silver'},
  {value:'fd',label:'Fixed Deposit'},{value:'rd',label:'Recurring Deposit'},
  {value:'ppf',label:'PPF'},{value:'epf',label:'EPF'},{value:'nps',label:'NPS'},
  {value:'bond',label:'Bond / SGB'},{value:'chit_fund',label:'Chit Fund'},{value:'other',label:'Other'},
];

function Field({label,children}:{label:string;children:React.ReactNode}){
  return<div><label className="field-label">{label}</label>{children}</div>;
}

function SIPForm({onSave,onClose}:{onSave:(s:SIP)=>void;onClose:()=>void}){
  const[f,setF]=useState({name:'',amount:'',startDate:'',sipDate:'7',category:'mutual_fund_sip' as InvestmentCategory,ticker:'',units:'',currentNav:'',notes:''});
  const set=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  const submit=()=>{
    if(!f.name||!f.amount||!f.startDate)return;
    const cat=f.category;
    onSave({id:generateId(),name:f.name,amount:parseFloat(f.amount),startDate:f.startDate,sipDate:parseInt(f.sipDate)||7,category:cat,assetClass:CATEGORY_ASSET_CLASS[cat],ticker:f.ticker||undefined,units:f.units?parseFloat(f.units):undefined,currentNav:f.currentNav?parseFloat(f.currentNav):undefined,notes:f.notes||undefined});
    onClose();
  };
  return(<div style={{maxWidth:520}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}><h2 className="display" style={{fontSize:22}}>Add SIP</h2><button className="btn" onClick={onClose}>Close</button></div>
    <div style={{display:'grid',gap:20}}>
      <Field label="Fund / scheme name *"><input placeholder="e.g. Mirae Asset Flexi Cap" value={f.name} onChange={e=>set('name',e.target.value)}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Monthly amount (₹) *"><input type="number" placeholder="10000" value={f.amount} onChange={e=>set('amount',e.target.value)}/></Field>
        <Field label="SIP date (day of month)"><input type="number" min="1" max="28" placeholder="7" value={f.sipDate} onChange={e=>set('sipDate',e.target.value)}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Start date *"><input type="date" value={f.startDate} onChange={e=>set('startDate',e.target.value)}/></Field>
        <Field label="Category"><select value={f.category} onChange={e=>set('category',e.target.value)}>{ALL_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <Field label="Ticker (optional)"><input placeholder="HDFCBANK.NS" value={f.ticker} onChange={e=>set('ticker',e.target.value)}/></Field>
        <Field label="Units held"><input type="number" placeholder="0" value={f.units} onChange={e=>set('units',e.target.value)}/></Field>
        <Field label="Current NAV"><input type="number" placeholder="0" value={f.currentNav} onChange={e=>set('currentNav',e.target.value)}/></Field>
      </div>
      <Field label="Notes"><input placeholder="Any notes..." value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      <button className="btn-accent" onClick={submit}>Save SIP →</button>
    </div>
  </div>);
}

function ManualForm({onSave,onClose}:{onSave:(m:ManualInvestment)=>void;onClose:()=>void}){
  const[f,setF]=useState({name:'',category:'stock_india' as InvestmentCategory,amount:'',date:'',units:'',buyPrice:'',ticker:'',maturityDate:'',maturityAmount:'',interestRate:'',notes:''});
  const set=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  const cat=f.category;
  const isDebt=['fd','rd','bond','ppf','epf'].includes(cat);
  const isCommodity=['gold','silver'].includes(cat);
  const isStock=['stock_india','stock_us','mutual_fund_lumpsum'].includes(cat);
  const submit=()=>{
    if(!f.name||!f.amount||!f.date)return;
    onSave({id:generateId(),name:f.name,category:cat,assetClass:CATEGORY_ASSET_CLASS[cat],amount:parseFloat(f.amount),date:f.date,units:f.units?parseFloat(f.units):undefined,buyPrice:f.buyPrice?parseFloat(f.buyPrice):undefined,ticker:f.ticker||undefined,currentPrice:f.buyPrice?parseFloat(f.buyPrice):undefined,maturityDate:f.maturityDate||undefined,maturityAmount:f.maturityAmount?parseFloat(f.maturityAmount):undefined,interestRate:f.interestRate?parseFloat(f.interestRate)/100:undefined,notes:f.notes||undefined});
    onClose();
  };
  return(<div style={{maxWidth:520}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}><h2 className="display" style={{fontSize:22}}>Add investment</h2><button className="btn" onClick={onClose}>Close</button></div>
    <div style={{display:'grid',gap:20}}>
      <Field label="Name *"><input placeholder="e.g. Infosys, HDFC FD, Gold ETF" value={f.name} onChange={e=>set('name',e.target.value)}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Category *"><select value={f.category} onChange={e=>set('category',e.target.value)}>{ALL_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
        <Field label="Date *"><input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Amount invested (₹) *"><input type="number" placeholder="50000" value={f.amount} onChange={e=>set('amount',e.target.value)}/></Field>
        {(isStock||isCommodity)&&<Field label={isCommodity?'Grams purchased':'Units purchased'}><input type="number" placeholder="0" value={f.units} onChange={e=>set('units',e.target.value)}/></Field>}
        {isStock&&<Field label="Buy price per unit (₹)"><input type="number" placeholder="0" value={f.buyPrice} onChange={e=>set('buyPrice',e.target.value)}/></Field>}
      </div>
      {isStock&&<Field label="Ticker (for live prices)"><input placeholder="INFY.NS · RELIANCE.NS · AAPL · MSFT" value={f.ticker} onChange={e=>set('ticker',e.target.value)}/></Field>}
      {isDebt&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <Field label="Interest rate (%)"><input type="number" placeholder="7.5" value={f.interestRate} onChange={e=>set('interestRate',e.target.value)}/></Field>
        <Field label="Maturity date"><input type="date" value={f.maturityDate} onChange={e=>set('maturityDate',e.target.value)}/></Field>
        <Field label="Maturity amount (₹)"><input type="number" placeholder="0" value={f.maturityAmount} onChange={e=>set('maturityAmount',e.target.value)}/></Field>
      </div>}
      <Field label="Notes"><input placeholder="Any notes..." value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      <button className="btn-accent" onClick={submit}>Save investment →</button>
    </div>
  </div>);
}

function LiabilityForm({onSave,onClose}:{onSave:(l:Liability)=>void;onClose:()=>void}){
  const[f,setF]=useState({name:'',category:'other_loan' as LiabilityCategory,totalAmount:'',outstandingAmount:'',interestRate:'',emiAmount:'',startDate:'',endDate:'',notes:''});
  const set=(k:string,v:string)=>setF(p=>({...p,[k]:v}));
  const cat=f.category;
  const isInformal=LIABILITY_IS_INFORMAL[cat];
  const submit=()=>{
    if(!f.name||!f.outstandingAmount)return;
    onSave({id:generateId(),name:f.name,category:cat,totalAmount:f.totalAmount?parseFloat(f.totalAmount):parseFloat(f.outstandingAmount),outstandingAmount:parseFloat(f.outstandingAmount),interestRate:f.interestRate?parseFloat(f.interestRate)/100:undefined,emiAmount:f.emiAmount?parseFloat(f.emiAmount):undefined,startDate:f.startDate||undefined,endDate:f.endDate||undefined,notes:f.notes||undefined});
    onClose();
  };
  return(<div style={{maxWidth:520}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}><h2 className="display" style={{fontSize:22}}>Add liability</h2><button className="btn" onClick={onClose}>Close</button></div>
    <div style={{display:'grid',gap:20}}>
      <Field label="Name *"><input placeholder={isInformal?'e.g. Owe Raj for dinner, Splitwise March':'e.g. HDFC Home Loan, ICICI Car Loan'} value={f.name} onChange={e=>set('name',e.target.value)}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Category *">
          <select value={f.category} onChange={e=>set('category',e.target.value)}>
            <optgroup label="Loans">
              <option value="home_loan">Home Loan</option>
              <option value="car_loan">Car Loan</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="education_loan">Education Loan</option>
              <option value="other_loan">Other Loan</option>
            </optgroup>
            <optgroup label="Informal">
              <option value="splitwise">Splitwise</option>
              <option value="owe_friend">Owe to Friend</option>
            </optgroup>
          </select>
        </Field>
        <Field label="Outstanding amount (₹) *"><input type="number" placeholder="500000" value={f.outstandingAmount} onChange={e=>set('outstandingAmount',e.target.value)}/></Field>
      </div>
      {!isInformal&&<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <Field label="Total loan amount (₹)"><input type="number" placeholder="1000000" value={f.totalAmount} onChange={e=>set('totalAmount',e.target.value)}/></Field>
          <Field label="EMI amount (₹)"><input type="number" placeholder="25000" value={f.emiAmount} onChange={e=>set('emiAmount',e.target.value)}/></Field>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
          <Field label="Interest rate (%)"><input type="number" placeholder="8.5" value={f.interestRate} onChange={e=>set('interestRate',e.target.value)}/></Field>
          <Field label="Start date"><input type="date" value={f.startDate} onChange={e=>set('startDate',e.target.value)}/></Field>
          <Field label="End date"><input type="date" value={f.endDate} onChange={e=>set('endDate',e.target.value)}/></Field>
        </div>
      </>}
      <Field label="Notes"><input placeholder="Any notes..." value={f.notes} onChange={e=>set('notes',e.target.value)}/></Field>
      <button className="btn-accent" onClick={submit}>Save liability →</button>
    </div>
  </div>);
}

/* ══ TOOLTIP ════════════════════════════════════════════════════════ */
function DarkTooltip({active,payload,label}:{active?:boolean;payload?:{value:number;name:string}[];label?:string}){
  if(!active||!payload?.length)return null;
  return(<div style={{background:'#161a1e',border:'1px solid #252b31',borderRadius:8,padding:'10px 14px',fontSize:11}}>
    <div style={{color:'#3d4a57',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{display:'flex',gap:12,justifyContent:'space-between'}}><span style={{color:'#7a8899'}}>{p.name}</span><span style={{fontWeight:600,color:'#e2e8f0'}}>{fmt(p.value)}</span></div>)}
  </div>);
}

/* ══ MAIN APP ════════════════════════════════════════════════════════ */
export default function Home(){
  const[showIntro,setShowIntro]=useState(true);
  const[portfolio,setPortfolio]=useState<PortfolioData>(emptyPortfolio());
  const[tab,setTab]=useState<Tab>('overview');
  const[addMode,setAddMode]=useState<AddMode>('sip');
  const[activeBubble,setActiveBubble]=useState<BubbleCategory|null>(null);
  const[refreshing,setRefreshing]=useState(false);
  const[question,setQuestion]=useState('');
  const[aiAnswer,setAiAnswer]=useState('');
  const[aiLoading,setAiLoading]=useState(false);
  const[forecastYears,setForecastYears]=useState(10);
  const[forecastCagr,setForecastCagr]=useState(12);
  const[mounted,setMounted]=useState(false);

  useEffect(()=>{setMounted(true);setPortfolio(loadPortfolio());},[]);
  const save=useCallback((p:PortfolioData)=>{setPortfolio(p);savePortfolio(p);},[]);

  const sipInvested=portfolio.sips.reduce((s,x)=>s+calcSIPInvested(x),0);
  const sipCurrent=portfolio.sips.reduce((s,x)=>s+calcSIPCurrentValue(x),0);
  const manInvested=portfolio.manualInvestments.reduce((s,x)=>s+x.amount,0);
  const manCurrent=portfolio.manualInvestments.reduce((s,x)=>s+calcManualCurrentValue(x,portfolio.goldPrice),0);
  const totalAssets=sipCurrent+manCurrent;
  const totalInvested=sipInvested+manInvested;
  const totalLiabilities=(portfolio.liabilities||[]).reduce((s,l)=>s+l.outstandingAmount,0);
  const netWorth=totalAssets-totalLiabilities;
  const totalGain=totalAssets-totalInvested;
  const gainPct=totalInvested>0?(totalGain/totalInvested)*100:0;
  const monthlySIP=portfolio.sips.reduce((s,x)=>s+x.amount,0);
  const allDates=[...portfolio.sips.map(s=>new Date(s.startDate).getTime()),...portfolio.manualInvestments.map(m=>new Date(m.date).getTime())];
  const yearsInv=allDates.length?(Date.now()-Math.min(...allDates))/(1000*60*60*24*365):0;
  const xirrVal=xirr(totalInvested,totalAssets,Math.max(yearsInv,0.1));

  const growthData=Array.from({length:13},(_,i)=>{
    const back=12-i;const d=new Date();d.setMonth(d.getMonth()-back);
    return{label:d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}),Invested:Math.max(0,Math.round(totalInvested*(1-back*0.072))),Value:Math.max(0,Math.round(totalAssets*(1-back*0.052)))};
  });
  const forecastData=Array.from({length:forecastYears},(_,i)=>{
    const y=i+1;
    return{year:`Y${y}`,Bear:Math.round(sipForecast(monthlySIP,netWorth,y,(forecastCagr-4)/100)),Base:Math.round(sipForecast(monthlySIP,netWorth,y,forecastCagr/100)),Bull:Math.round(sipForecast(monthlySIP,netWorth,y,(forecastCagr+4)/100))};
  });
  const targetCorpus=forecastData[forecastYears-1]?.Base??0;

  const refreshPrices=useCallback(async()=>{
    setRefreshing(true);
    try{
      const gr=await fetch('/api/prices?type=gold');const gd=await gr.json();
      const tickers=[...portfolio.sips.map(s=>s.ticker),...portfolio.manualInvestments.map(m=>m.ticker)].filter(Boolean).join(',');
      let sd:Record<string,{price:number;change:number}>={};
      if(tickers){const r=await fetch(`/api/prices?type=stocks&tickers=${encodeURIComponent(tickers)}`);sd=await r.json();}
      const np={...portfolio};
      if(gd.pricePerGram)np.goldPrice={pricePerGram:gd.pricePerGram,change:gd.change??0,fetchedAt:new Date().toISOString()};
      np.manualInvestments=portfolio.manualInvestments.map(m=>m.ticker&&sd[m.ticker]?{...m,currentPrice:sd[m.ticker].price}:m);
      np.sips=portfolio.sips.map(s=>s.ticker&&sd[s.ticker]?{...s,currentNav:sd[s.ticker].price}:s);
      save(np);
    }catch(e){console.error(e);}
    setRefreshing(false);
  },[portfolio,save]);

  const askAI=async()=>{
    if(!question.trim())return;
    setAiLoading(true);setAiAnswer('');
    try{
      const summary=JSON.stringify({netWorth:fmtFull(netWorth),totalAssets:fmtFull(totalAssets),totalLiabilities:fmtFull(totalLiabilities),totalGain:fmtFull(totalGain),xirr:xirrVal.toFixed(1)+'%',monthlySIP:fmtFull(monthlySIP),liabilities:(portfolio.liabilities||[]).map(l=>({name:l.name,category:l.category,outstanding:l.outstandingAmount,emi:l.emiAmount})),sips:portfolio.sips.map(s=>({name:s.name,amount:s.amount,category:s.category,invested:calcSIPInvested(s),value:calcSIPCurrentValue(s)})),manual:portfolio.manualInvestments.map(m=>({name:m.name,category:m.category,amount:m.amount,value:calcManualCurrentValue(m,portfolio.goldPrice)}))});
      const res=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,portfolioSummary:summary})});
      const data=await res.json();setAiAnswer(data.answer||data.error||'No response.');
    }catch{setAiAnswer('Could not reach AI. Check ANTHROPIC_API_KEY.');}
    setAiLoading(false);
  };

  const handleDelete=(type:'sip'|'manual',id:string)=>{
    if(type==='sip')save({...portfolio,sips:portfolio.sips.filter(s=>s.id!==id)});
    else save({...portfolio,manualInvestments:portfolio.manualInvestments.filter(m=>m.id!==id)});
  };
  const handleDeleteLiability=(id:string)=>save({...portfolio,liabilities:(portfolio.liabilities||[]).filter(l=>l.id!==id)});

  if(!mounted)return null;
  if(showIntro)return<IntroScreen onEnter={()=>setShowIntro(false)}/>;

  const TABS:{key:Tab;label:string}[]=[
    {key:'overview',label:'Overview'},{key:'portfolio',label:'Portfolio'},
    {key:'add',label:'+ Add'},{key:'plan',label:'Plan & Ask AI'},
  ];

  return(<>
    <Head><title>S4 — Portfolio</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>

    <header style={{borderBottom:'1px solid #1d2226',position:'sticky',top:0,zIndex:50,background:'#0e1012ee',backdropFilter:'blur(16px)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 28px',height:52}}>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:20,color:'#4ade80',letterSpacing:'-0.04em',userSelect:'none'}}>
          S4 <span style={{fontFamily:"'Inter',sans-serif",fontWeight:400,fontSize:11,color:'#3d4a57',marginLeft:6,letterSpacing:'0.08em',textTransform:'uppercase'}}>portfolio</span>
        </div>
        <nav style={{display:'flex',gap:2}}>
          {TABS.map(({key,label})=>(
            <button key={key} onClick={()=>setTab(key)} style={{background:tab===key?'#161a1e':'none',border:tab===key?'1px solid #252b31':'1px solid transparent',color:tab===key?'#e2e8f0':'#3d4a57',borderRadius:8,padding:'5px 14px',fontSize:12,cursor:'pointer',transition:'all 0.15s',fontFamily:"'Inter',sans-serif",fontWeight:500}}>
              {label}
            </button>
          ))}
        </nav>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {portfolio.goldPrice&&<span style={{fontSize:11,color:'#f59e0b',fontFamily:"'Space Grotesk',sans-serif",fontWeight:500}}>₹{portfolio.goldPrice.pricePerGram.toLocaleString('en-IN')}/g <span style={{color:portfolio.goldPrice.change>=0?'#4ade80':'#f87171'}}>{portfolio.goldPrice.change>=0?'↑':'↓'}{Math.abs(portfolio.goldPrice.change).toFixed(1)}%</span></span>}
          <button className="btn" onClick={refreshPrices} disabled={refreshing} style={{fontSize:11}}>{refreshing?'↻ Refreshing…':'↻ Refresh prices'}</button>
        </div>
      </div>
    </header>

    <main style={{padding:'24px 28px 60px',maxWidth:1100,margin:'0 auto'}}>

      {/* ══ OVERVIEW ══ */}
      {tab==='overview'&&<div style={{display:'grid',gap:20}}>
        {/* KPI strip — now shows net worth prominently */}
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:12,paddingTop:8}}>
          <div className="card" style={{borderColor:'rgba(74,222,128,0.2)'}}>
            <div className="eyebrow" style={{marginBottom:8}}>Net Worth</div>
            <div className="display" style={{fontSize:36,color:'#4ade80'}}>{fmt(netWorth)}</div>
            <div style={{display:'flex',gap:12,marginTop:6,fontSize:11}}>
              <span style={{color:'#3d4a57'}}>Assets {fmt(totalAssets)}</span>
              {totalLiabilities>0&&<span style={{color:'#f87171'}}>− Debt {fmt(totalLiabilities)}</span>}
            </div>
          </div>
          {[
            {label:'XIRR',value:`${xirrVal.toFixed(1)}%`,sub:xirrVal>12?'↑ beats avg':'↓ below avg',good:xirrVal>12},
            {label:'Monthly SIP',value:fmt(monthlySIP),sub:`${portfolio.sips.length} SIPs`},
            {label:'Total gain',value:fmt(Math.abs(totalGain)),sub:fmtPct(gainPct),good:totalGain>=0},
            {label:'Liabilities',value:fmt(totalLiabilities),sub:`${(portfolio.liabilities||[]).length} entries`,good:false},
          ].map(k=>(
            <div key={k.label} className="card" style={{borderColor:'#1d2226'}}>
              <div className="eyebrow" style={{marginBottom:8}}>{k.label}</div>
              <div className="display" style={{fontSize:22,color:k.label==='Liabilities'&&totalLiabilities>0?'#f87171':'#e2e8f0'}}>{k.value}</div>
              {k.sub&&<div style={{fontSize:11,marginTop:6,color:k.good!==undefined?(k.good?'#4ade80':'#f87171'):'#3d4a57'}}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Floating bubbles */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div className="eyebrow" style={{marginBottom:2}}>Portfolio bubbles</div><p style={{fontSize:11,color:'#3d4a57'}}>Bubble size reflects value · click category to see holdings</p></div>
          </div>
          <FloatingBubbles portfolio={portfolio} onBubbleClick={bc=>{setActiveBubble(activeBubble===bc?null:bc);}}/>
        </div>
        {activeBubble&&<BubbleDetail bc={activeBubble} portfolio={portfolio} onClose={()=>setActiveBubble(null)} onDelete={handleDelete}/>}

        {/* Growth chart */}
        <div className="card">
          <div className="eyebrow" style={{marginBottom:16}}>Growth — 12 months</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={growthData} margin={{top:4,right:0,bottom:0,left:0}}>
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.2}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="label" tick={{fill:'#3d4a57',fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip/>}/>
              <Area type="monotone" dataKey="Invested" stroke="#252b31" strokeWidth={1} fill="none" dot={false}/>
              <Area type="monotone" dataKey="Value" stroke="#4ade80" strokeWidth={2} fill="url(#gv)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {/* ══ PORTFOLIO ══ */}
      {tab==='portfolio'&&<div style={{paddingTop:16,display:'grid',gap:28}}>
        {/* Assets */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 className="display" style={{fontSize:24,color:'#e2e8f0'}}>Assets</h2>
            <span className="eyebrow">{portfolio.sips.length+portfolio.manualInvestments.length} instruments · {fmt(totalAssets)}</span>
          </div>
          {portfolio.sips.length===0&&portfolio.manualInvestments.length===0
            ?<p style={{color:'#3d4a57',padding:'20px 0'}}>No assets yet. Go to + Add.</p>
            :<table className="ink-table">
              <thead><tr><th>Name</th><th>Category</th><th>Invested</th><th>Current</th><th>Gain/Loss</th><th>Return</th><th></th></tr></thead>
              <tbody>
                {portfolio.sips.map(sip=>{
                  const inv=calcSIPInvested(sip),cur=calcSIPCurrentValue(sip),gain=cur-inv,gp=inv>0?(gain/inv*100):0;
                  return<tr key={sip.id}><td style={{fontWeight:500}}>{sip.name}</td><td><span className={`tag ${BUBBLE_META[CATEGORY_BUBBLE[sip.category]].tag}`}>{CATEGORY_LABELS[sip.category]}</span></td><td className="mono">{fmt(inv)}</td><td className="mono">{fmt(cur)}</td><td className={`mono ${gain>=0?'up':'down'}`}>{gain>=0?'+':''}{fmt(Math.abs(gain))}</td><td className={`mono ${gain>=0?'up':'down'}`}>{fmtPct(gp)}</td>
                  <td><button style={{background:'none',border:'1px solid #252b31',color:'#3d4a57',cursor:'pointer',fontSize:11,padding:'3px 10px',borderRadius:6,transition:'all 0.15s'}} onClick={()=>handleDelete('sip',sip.id)} onMouseEnter={e=>{(e.target as HTMLElement).style.color='#f87171';(e.target as HTMLElement).style.borderColor='rgba(248,113,113,0.4)'}} onMouseLeave={e=>{(e.target as HTMLElement).style.color='#3d4a57';(e.target as HTMLElement).style.borderColor='#252b31'}}>Delete</button></td></tr>;
                })}
                {portfolio.manualInvestments.map(inv=>{
                  const cur=calcManualCurrentValue(inv,portfolio.goldPrice),gain=cur-inv.amount,gp=inv.amount>0?(gain/inv.amount*100):0;
                  return<tr key={inv.id}><td><div style={{fontWeight:500}}>{inv.name}</div>{inv.ticker&&<div style={{fontSize:10,color:'#3d4a57',marginTop:2}}>{inv.ticker}</div>}</td><td><span className={`tag ${BUBBLE_META[CATEGORY_BUBBLE[inv.category]].tag}`}>{CATEGORY_LABELS[inv.category]}</span></td><td className="mono">{fmt(inv.amount)}</td><td className="mono">{fmt(cur)}</td><td className={`mono ${gain>=0?'up':'down'}`}>{gain>=0?'+':''}{fmt(Math.abs(gain))}</td><td className={`mono ${gain>=0?'up':'down'}`}>{fmtPct(gp)}</td>
                  <td><button style={{background:'none',border:'1px solid #252b31',color:'#3d4a57',cursor:'pointer',fontSize:11,padding:'3px 10px',borderRadius:6,transition:'all 0.15s'}} onClick={()=>handleDelete('manual',inv.id)} onMouseEnter={e=>{(e.target as HTMLElement).style.color='#f87171';(e.target as HTMLElement).style.borderColor='rgba(248,113,113,0.4)'}} onMouseLeave={e=>{(e.target as HTMLElement).style.color='#3d4a57';(e.target as HTMLElement).style.borderColor='#252b31'}}>Delete</button></td></tr>;
                })}
              </tbody>
            </table>}
        </div>

        {/* Liabilities */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 className="display" style={{fontSize:24,color:'#f87171'}}>Liabilities</h2>
            <span className="eyebrow" style={{color:'#f87171'}}>{(portfolio.liabilities||[]).length} entries · {fmt(totalLiabilities)}</span>
          </div>
          {(portfolio.liabilities||[]).length===0
            ?<p style={{color:'#3d4a57',padding:'20px 0'}}>No liabilities added yet.</p>
            :<table className="ink-table">
              <thead><tr><th>Name</th><th>Type</th><th>Total</th><th>Outstanding</th><th>EMI</th><th>Interest</th><th></th></tr></thead>
              <tbody>
                {(portfolio.liabilities||[]).map(l=>(
                  <tr key={l.id}>
                    <td style={{fontWeight:500}}>{l.name}{l.notes&&<div style={{fontSize:10,color:'#3d4a57',marginTop:2}}>{l.notes}</div>}</td>
                    <td><span className="tag tag-gray">{LIABILITY_LABELS[l.category]}</span></td>
                    <td className="mono">{fmt(l.totalAmount)}</td>
                    <td className="mono down">{fmt(l.outstandingAmount)}</td>
                    <td className="mono">{l.emiAmount?fmt(l.emiAmount):'—'}</td>
                    <td className="mono">{l.interestRate?`${(l.interestRate*100).toFixed(1)}%`:'—'}</td>
                    <td><button style={{background:'none',border:'1px solid #252b31',color:'#3d4a57',cursor:'pointer',fontSize:11,padding:'3px 10px',borderRadius:6,transition:'all 0.15s'}} onClick={()=>handleDeleteLiability(l.id)} onMouseEnter={e=>{(e.target as HTMLElement).style.color='#f87171';(e.target as HTMLElement).style.borderColor='rgba(248,113,113,0.4)'}} onMouseLeave={e=>{(e.target as HTMLElement).style.color='#3d4a57';(e.target as HTMLElement).style.borderColor='#252b31'}}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      </div>}

      {/* ══ ADD ══ */}
      {tab==='add'&&<div style={{paddingTop:16}}>
        <div style={{display:'flex',gap:10,marginBottom:28}}>
          <button className={addMode==='sip'?'btn-accent':'btn-ghost'} onClick={()=>setAddMode('sip')}>Regular SIP</button>
          <button className={addMode==='manual'?'btn-accent':'btn-ghost'} onClick={()=>setAddMode('manual')}>One-time / manual</button>
          <button className={addMode==='liability'?'btn-accent':'btn-ghost'} onClick={()=>setAddMode('liability')} style={{borderColor:addMode==='liability'?'transparent':'rgba(248,113,113,0.3)',color:addMode==='liability'?'#050f08':'#f87171'}}>+ Liability / Debt</button>
        </div>
        <div className="card" style={{maxWidth:560}}>
          {addMode==='sip'&&<SIPForm onSave={sip=>{save({...portfolio,sips:[...portfolio.sips,sip]});setTab('overview');}} onClose={()=>setTab('overview')}/>}
          {addMode==='manual'&&<ManualForm onSave={inv=>{save({...portfolio,manualInvestments:[...portfolio.manualInvestments,inv]});setTab('overview');}} onClose={()=>setTab('overview')}/>}
          {addMode==='liability'&&<LiabilityForm onSave={l=>{save({...portfolio,liabilities:[...(portfolio.liabilities||[]),l]});setTab('portfolio');}} onClose={()=>setTab('overview')}/>}
        </div>
      </div>}

      {/* ══ PLAN & ASK ══ */}
      {tab==='plan'&&<div style={{paddingTop:16,display:'grid',gap:24}}>
        <div>
          <h2 className="display" style={{fontSize:28,color:'#e2e8f0',marginBottom:4}}>Forecast</h2>
          <div className="display" style={{fontSize:44,color:'#4ade80',marginBottom:4}}>{fmt(targetCorpus)}</div>
          <p style={{color:'#3d4a57',fontSize:12,marginBottom:20}}>projected net worth in {forecastYears} years at {forecastCagr}% CAGR</p>
          <div className="card" style={{marginBottom:12}}>
            <div style={{display:'flex',gap:36,flexWrap:'wrap',marginBottom:20}}>
              {[{label:'Years',val:forecastYears,min:5,max:30,set:setForecastYears,unit:'yr'},{label:'CAGR',val:forecastCagr,min:6,max:20,set:setForecastCagr,unit:'%'}].map(({label,val,min,max,set,unit})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:14}}>
                  <div className="eyebrow" style={{minWidth:44}}>{label}</div>
                  <input type="range" min={min} max={max} value={val} onChange={e=>set(+e.target.value)} style={{width:120}}/>
                  <div className="display" style={{fontSize:20,color:'#e2e8f0',minWidth:44}}>{val}{unit}</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={forecastData} margin={{top:4,right:0,bottom:0,left:0}} barGap={2}>
                <XAxis dataKey="year" tick={{fill:'#3d4a57',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis hide/>
                <Tooltip content={<DarkTooltip/>}/>
                <Bar dataKey="Bear" fill="#1d2226" radius={[3,3,0,0]}/>
                <Bar dataKey="Base" fill="#4ade80" radius={[3,3,0,0]}/>
                <Bar dataKey="Bull" fill="#86efac" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[{l:'Bear',v:forecastData[forecastYears-1]?.Bear??0,c:'#f87171'},{l:'Base',v:targetCorpus,c:'#4ade80'},{l:'Bull',v:forecastData[forecastYears-1]?.Bull??0,c:'#86efac'}].map(({l,v,c})=>(
              <div key={l} className="card" style={{textAlign:'center'}}><div className="eyebrow" style={{marginBottom:8}}>{l} case</div><div className="display" style={{fontSize:22,color:c}}>{fmt(v)}</div></div>
            ))}
          </div>
        </div>
        <div style={{borderTop:'1px solid #1d2226',paddingTop:24}}>
          <h2 className="display" style={{fontSize:24,color:'#e2e8f0',marginBottom:8}}>Ask AI</h2>
          <p style={{color:'#3d4a57',fontSize:12,marginBottom:20}}>Your full portfolio including liabilities is the context.</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
            {['What should I rebalance?','Should I pay off debt or invest more?','Am I on track?','Analyse my SIP mix'].map(q=>(
              <button key={q} className="btn-ghost" onClick={()=>setQuestion(q)}>{q}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:10,marginBottom:20}}>
            <input placeholder="Ask anything about your portfolio…" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} style={{flex:1}}/>
            <button className="btn-accent" onClick={askAI} disabled={aiLoading} style={{padding:'9px 20px',flexShrink:0}}>{aiLoading?'…':'Ask →'}</button>
          </div>
          {aiAnswer&&<div className="card" style={{borderColor:'rgba(74,222,128,0.2)'}}>
            <div style={{fontSize:10,color:'#4ade80',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:12}}>Analysis</div>
            <p style={{fontSize:14,lineHeight:1.8,whiteSpace:'pre-wrap',color:'#e2e8f0'}}>{aiAnswer}</p>
          </div>}
        </div>
      </div>}
    </main>
  </>);
}
