// app/api/stocks/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const fallbackData = [
    { ticker: '8035', name: '東京エレクトロン', price: 42150, change: 450, changePercent: 1.08 },
    { ticker: '6857', name: 'アドバンテスト', price: 7840, change: 125, changePercent: 1.62 },
    { ticker: 'KIOXIA', name: 'キオクシアHD', price: null, change: null, changePercent: null, note: 'IPO準備中' },
    { ticker: '6594', name: 'ニデック', price: 7210, change: -35, changePercent: -0.48 },
    { ticker: '8306', name: '三菱UFJ', price: 1825.5, change: 12.0, changePercent: 0.66 }
  ];

  try {
    const symbols = ['8035.T', '8306.T']; 
    const liveDataList = [];

    for (const symbol of symbols) {
      // パッケージを使わず、Yahooファイナンスの公開APIを直接叩く
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, {
        cache: 'no-store' // 常に最新のデータを取得する設定
      });
      
      if (!res.ok) {
        console.warn(`${symbol} のデータ取得に失敗しました`);
        continue;
      }
      
      const data = await res.json();
      if (!data.chart || !data.chart.result || !data.chart.result[0]) {
        continue;
      }

      // 取得したJSONデータから株価を抽出
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose;
      const change = price - prevClose;
      const changePercent = (change / prevClose) * 100;
      
      liveDataList.push({
        ticker: symbol.replace('.T', ''),
        name: symbol === '8035.T' ? '東京エレクトロン(Live)' : '三菱UFJ(Live)',
        price: Math.round(price * 10) / 10,
        change: Math.round(change * 10) / 10,
        changePercent: Math.round(changePercent * 100) / 100,
      });
    }

    const finalData = fallbackData.map(fallback => {
      const live = liveDataList.find(l => l.ticker === fallback.ticker);
      return live ? live : fallback;
    });

    return NextResponse.json({ success: true, data: finalData });

  } catch (error) {
    console.error("株価データ取得エラー:", error);
    return NextResponse.json({ success: true, data: fallbackData });
  }
}