// app/api/stocks/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.STOCK_API_KEY;

  // 万が一APIが制限された場合の安全用データ
  const fallbackData = [
    { ticker: '8035', name: '東京エレクトロン', price: 42150, change: 450, changePercent: 1.08 },
    { ticker: '6857', name: 'アドバンテスト', price: 7840, change: 125, changePercent: 1.62 },
    { ticker: 'KIOXIA', name: 'キオクシアHD', price: null, change: null, changePercent: null, note: 'IPO準備中' },
    { ticker: '6594', name: 'ニデック', price: 7210, change: -35, changePercent: -0.48 },
    { ticker: '8306', name: '三菱UFJ', price: 1825.5, change: 12.0, changePercent: 0.66 }
  ];

  if (!apiKey) {
    console.log("APIキーが未設定のため、フォールバックデータを返します。");
    return NextResponse.json({ success: true, data: fallbackData });
  }

  try {
    // 実際にAlpha Vantageからデータを取得する銘柄（無料枠を考慮し、代表的な2銘柄のみリアルタイム取得）
    // ※Alpha Vantageは日本の銘柄コードの後に .TOK をつけます。
    const symbols = ['8035.TOK', '8306.TOK']; 
    const liveDataList = [];

    for (const symbol of symbols) {
      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
      const data = await response.json();
      
      // API制限（1日25回等）に引っかかった場合は、エラーを出さずにフォールバックへ逃がす
      if (data.Information || !data['Global Quote'] || Object.keys(data['Global Quote']).length === 0) {
        console.warn(`${symbol} のデータ取得で制限またはエラー発生。`);
        continue;
      }

      const quote = data['Global Quote'];
      liveDataList.push({
        ticker: symbol.replace('.TOK', ''),
        name: symbol === '8035.TOK' ? '東京エレクトロン(Live)' : '三菱UFJ(Live)',
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      });
    }

    // リアルタイム取得に成功した銘柄があれば、フォールバックデータを上書きする
    const finalData = fallbackData.map(fallback => {
      const live = liveDataList.find(l => l.ticker === fallback.ticker);
      return live ? live : fallback;
    });

    return NextResponse.json({ success: true, data: finalData });

  } catch (error) {
    console.error("株価データ取得エラー:", error);
    // エラーで画面を真っ白にさせないための安全設計
    return NextResponse.json({ success: true, data: fallbackData });
  }
}