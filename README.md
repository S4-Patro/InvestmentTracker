<<<<<<< HEAD
# InvestOS — Personal Investment Dashboard

A self-hosted investment tracking dashboard. All data stays in your browser (localStorage). Live gold + stock prices fetched on demand. AI insights powered by Claude.

## Features

- **SIP tracking** — add fund name, amount, start date once; dashboard auto-calculates invested amount, months running, next SIP date
- **Live gold price** — fetches real-time 24k gold price in INR/gram, updates your gold holdings value
- **Stock/ETF prices** — add a ticker (e.g. `RELIANCE.NS`, `HDFCBANK.NS`) and get live prices from Yahoo Finance
- **Manual investments** — add FDs, stocks, MF lumpsums, PPF, EPF, bonds, chit funds with full gain/loss tracking
- **Forecasting** — interactive corpus projections with bull/bear/base scenarios, adjustable CAGR and years
- **AI insights** — ask Claude anything about your portfolio (requires Anthropic API key)
- **Smart alerts** — auto-detects overweight equity, maturing FDs, milestone achievements

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Anthropic API key (for AI insights)

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> The AI insights tab won't work without this. Everything else works fine without it.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked about environment variables, add `ANTHROPIC_API_KEY`.

### Option B — GitHub + Vercel dashboard

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable: `ANTHROPIC_API_KEY = sk-ant-...`
4. Click Deploy

### Option C — Vercel drag & drop

1. Run `npm run build` locally
2. Drag the project folder to [vercel.com/new](https://vercel.com/new)

## How to use

### Adding a SIP
Go to **Add → Regular SIP**. Enter:
- Fund name (e.g. "Mirae Asset Flexi Cap")
- Monthly amount
- Start date (when you first started this SIP)
- SIP date (which day of the month it debits)

Dashboard auto-calculates how much you've put in based on months elapsed.

### Adding stocks / one-time investments
Go to **Add → One-time / manual**. For stocks:
- Add the ticker symbol (e.g. `INFY.NS` for NSE stocks, `INFY` for US)
- Hit **Refresh prices** in the header to fetch live prices

### Gold
Add gold under Manual investments with category = Gold. Enter grams purchased. Hit **Refresh prices** — dashboard fetches live INR/gram price and recalculates your gold value.

### For FDs / bonds
Enter the principal, interest rate, maturity date, and maturity amount. Dashboard calculates accrued value linearly.

## Ticker format (Yahoo Finance)
- NSE stocks: `RELIANCE.NS`, `HDFCBANK.NS`, `INFY.NS`
- BSE stocks: `RELIANCE.BO`
- Nifty 50 ETF: `NIFTYBEES.NS`
- Gold ETF: `GOLDBEES.NS`
- US stocks: `AAPL`, `MSFT`

## Data storage
All portfolio data is stored in your browser's `localStorage`. Nothing is sent to any server except:
- Price fetch requests to Yahoo Finance / metals.live (no personal data)
- Your portfolio summary to Anthropic's API when you use Ask AI

To export your data: open browser DevTools → Application → localStorage → copy `investos_portfolio`.

## Tech stack
- Next.js 14 (App Router disabled — uses pages router for simplicity)
- Recharts for visualisations
- Tailwind CSS
- TypeScript
- Anthropic Claude API for insights
=======
# InvestmentTracker
A personal investment dashboard to track net worth ( SIPs, stocks, gold, FDs) and more in one place, with live price updates, corpus forecasting, and AI-powered portfolio insights.
>>>>>>> ab125a1ba4489ba38204c74f939691dd80a8c706
