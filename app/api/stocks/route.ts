// app/api/stocks/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { symbols } = await request.json();

    // 常に取得する主要KPI
    const kpiSymbols = [
      { ticker: 'NI225', name: '日経平均先物', y_ticker: 'NI225.T' },
      { ticker: 'TOPIX', name: 'TOPIX', y_ticker: '^TPX' },
      { ticker: 'USDJPY', name: '米ドル/円', y_ticker: 'JPY=X' },
      { ticker: 'SOX', name: 'SOX指数', y_ticker: '^SOX' }
    ];

    // 画面から送られてきた個別銘柄（KPIと重複しないようフィルタリング）
    const userSymbols = (symbols || [])
      .filter((s: string) => !kpiSymbols.some(kpi => kpi.ticker === s))
      .map((s: string) => ({ ticker: s, name: s, y_ticker: s.endsWith('.T') ? s : `${s}.T` }));

    const allSymbols = [...kpiSymbols, ...userSymbols];

    const results = await Promise.all(allSymbols.map(async (s) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.y_ticker}?interval=1d&range=1d`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        
        if (!data.chart || !data.chart.result || !data.chart.result[0]) throw new Error('No data');
        const meta = data.chart.result[0].meta;
        
        return {
          ticker: s.ticker,
          name: s.ticker === s.name ? s.name : s.name + "(Live)",
          price: meta.regularMarketPrice,
          change: meta.regularMarketPrice - meta.chartPreviousClose,
          changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        };
      } catch (e) {
        return { ticker: s.ticker, name: s.name, price: null, change: null, changePercent: null, note: '取得失敗' };
      }
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json({ success: false, error: '全データ取得エラー' });
  }
}