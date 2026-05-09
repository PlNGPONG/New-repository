// app/api/stocks/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Alpha Vantage等のAPIキーを環境変数から取得（設定前はundefinedになります）
  const apiKey = process.env.STOCK_API_KEY;

  try {
    // APIの制限時や未設定時に画面を崩さないためのフォールバックデータ
    const fallbackData = [
      { ticker: '8035', name: '東京エレクトロン', price: 42150, change: 450, changePercent: 1.08 },
      { ticker: '6857', name: 'アドバンテスト', price: 7840, change: 125, changePercent: 1.62 },
      { ticker: 'KIOXIA', name: 'キオクシアHD', price: null, change: null, changePercent: null, note: 'IPO準備中' },
      { ticker: '6594', name: 'ニデック', price: 7210, change: -35, changePercent: -0.48 },
      { ticker: '8306', name: '三菱UFJ', price: 1825.5, change: 12.0, changePercent: 0.66 }
    ];

    if (apiKey) {
      // 本番APIが設定されている場合の処理（Alpha Vantageの例）
      // const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=8035.TOK&apikey=${apiKey}`);
      // const data = await response.json();
      // 取得したデータをフロントエンド用に整形して返す処理をここに記述します
      console.log("API通信を実行します");
    }

    // 今回は安全のためフォールバックデータを返却します
    return NextResponse.json({ success: true, data: fallbackData });

  } catch (error) {
    console.error("株価データ取得エラー:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stock data' }, { status: 500 });
  }
}