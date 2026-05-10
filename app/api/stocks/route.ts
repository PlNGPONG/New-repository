// app/api/stocks/route.ts
import { NextResponse } from 'next/server';

type StockData = {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  note?: string;
};

export async function GET() {
  try {
    // 取得対象：個別銘柄（.T）と指数・為替（.T, JPY=X等）
    const symbols = [
      { ticker: 'NI225', name: '日経平均先物', y_ticker: 'NI225.T' }, // 簡易的に現物指数を参照
      { ticker: 'TOPIX', name: 'TOPIX', y_ticker: '^TPX' },
      { ticker: 'USDJPY', name: '米ドル/円', y_ticker: 'JPY=X' },
      { ticker: 'SOX', name: 'SOX指数', y_ticker: '^SOX' },
      { ticker: '8035', name: '東京エレクトロン', y_ticker: '8035.T' },
      { ticker: '6857', name: 'アドバンテスト', y_ticker: '6857.T' },
      { ticker: '6594', name: 'ニデック', y_ticker: '6594.T' },
      { ticker: '8306', name: '三菱UFJ', y_ticker: '8306.T' }
    ];

    const results = await Promise.all(symbols.map(async (s) => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.y_ticker}?interval=1d&range=1d`, { cache: 'no-store' });
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        return {
          ticker: s.ticker,
          name: s.name + "(Live)",
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