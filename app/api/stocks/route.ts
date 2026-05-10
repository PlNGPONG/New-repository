// app/api/stocks/route.ts
import { NextResponse } from 'next/server';

// 頻出する日本株の日本語名辞書（必要に応じて自由に書き足せます）
const defaultNames: Record<string, string> = {
  '8035': '東京エレクトロン', '6857': 'アドバンテスト', '6594': 'ニデック', '8306': '三菱UFJ',
  '9984': 'ソフトバンクG', '7203': 'トヨタ自動車', '6920': 'レーザーテック', '1570': '日経レバ',
  '9107': '川崎汽船', '9101': '日本郵船', '8058': '三菱商事', '8031': '三井物産',
  '8411': 'みずほFG', '8316': '三井住友FG', '7011': '三菱重工', '6758': 'ソニーG',
  '9983': 'ファストリ', '6861': 'キーエンス', '6098': 'リクルートHD', '4063': '信越化学',
  '8001': '伊藤忠商事', '4568': '第一三共', '6702': '富士通', '6902': 'デンソー',
  '8766': '東京海上HD', '6501': '日立製作所', '7741': 'HOYA', '4502': '武田薬品',
  '3382': 'セブン&アイ', '6981': '村田製作所', '7267': 'ホンダ', '7751': 'キヤノン',
  '6503': '三菱電機', '8053': '住友商事', '8002': '丸紅', '3436': 'SUMCO',
  '6146': 'ディスコ', '7735': 'スクリーンHD', '6723': 'ルネサス'
};

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

    // 画面から送られてきた個別銘柄
    const userSymbols = (symbols || [])
      .filter((s: string) => !kpiSymbols.some(kpi => kpi.ticker === s))
      .map((s: string) => ({ ticker: s, y_ticker: s.endsWith('.T') ? s : `${s}.T` }));

    // 辞書と照らし合わせて名前を付与（エラー解消のため us に型を明記）
    const allSymbols = [
      ...kpiSymbols, 
      ...userSymbols.map((us: { ticker: string; y_ticker: string }) => ({ ...us, name: defaultNames[us.ticker] || us.ticker }))
    ];

    // 後続のエラーを未然に防ぐため、s にも型を明記
    const results = await Promise.all(allSymbols.map(async (s: { ticker: string; name: string; y_ticker: string }) => {
      try {
        // 株価データの取得
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.y_ticker}?interval=1d&range=1d`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        
        if (!data.chart || !data.chart.result || !data.chart.result[0]) throw new Error('No data');
        const meta = data.chart.result[0].meta;

        // 辞書にないマニアックな銘柄の場合、Yahooの検索APIを使って裏側で企業名を探す
        let finalName = s.name;
        if (finalName === s.ticker) {
          try {
            const searchRes = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${s.y_ticker}`);
            const searchData = await searchRes.json();
            if (searchData.quotes && searchData.quotes.length > 0) {
              // 取得できた企業名（英語表記など）を採用
              finalName = searchData.quotes[0].shortname || searchData.quotes[0].longname || s.ticker;
            }
          } catch (e) {
            // 検索にも失敗した場合は仕方なくティッカー番号を表示
          }
        }
        
        return {
          ticker: s.ticker,
          name: finalName,
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