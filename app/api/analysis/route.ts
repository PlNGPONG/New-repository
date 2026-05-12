// app/api/analysis/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: 'APIキー未設定' });

  try {
    const { stocks, mode, excludeList, referenceText } = await request.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const isDeepMode = mode === 'deep';
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: isDeepMode ? [{ googleSearch: {} }] as any : undefined
    });

    const stockInfo = stocks.map((s: any) => `${s.name}(${s.ticker}): ${s.price}円 (${s.changePercent?.toFixed(2)}%)`).join(', ');
    const excludeInfo = excludeList && excludeList.length > 0 ? excludeList.join(', ') : 'なし';

    const prompt = `
      # 指示
      あなたは超一流の短期トレードアナリストです。
      「虫の目（個別・需給）」と「鳥の目（マクロ・ニュース）」を激しく往復しながら、具体的かつ説得力のある分析を提供してください。
      出力に「**」は絶対に使用せず、見出しは【】や「」を使ってください。

      # 分析の必須条件
      - ウォッチリスト外の銘柄も積極的に発注案に含めること。
      - コメントは極めて具体的に（例：地政学リスクなら「米イラン」だけでなく具体的な場所や原油価格の閾値、FRBの具体的な発言日など）。
      - 銘柄を記載する際は必ず「銘柄名（4桁コード）」の形式にすること。

      # 投資前提
      - 資金：1,600万円 / 期間：数日～2週間
      
      # インプットデータ
      - 市場データ：${stockInfo}
      - ユーザー提供資料：${referenceText || "なし"}
      - 除外銘柄（発注禁止）：${excludeInfo}

      # モード：${isDeepMode ? '【じっくりモード：広範な調査】' : '【クイックモード：迅速な戦術調整】'}
      ${isDeepMode 
        ? '前夜のNY市場動向、VIX指数、米国債利回り、為替、原油価格、主要な地政学ニュースをWeb検索で精査し、海外投資家やCTAの行動規範に照らし合わせて分析せよ。' 
        : '現在の株価と主要指標から、即時的な需給の歪みと戦術的なエントリー可否を判断せよ。'}

      # 出力フォーマット
      ## 1. サマリー
      （100字以内の切れ味鋭い総評）

      ## 2. 発注案
      | 銘柄名(コード) | 買い適性 | エントリーゾーン | 予定ロット(数量/金額) | ターゲット | ロスカット | 想定リスク | R/R | コメント |
      | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
      | 銘柄(XXXX) | 高/中/低 | 価格 | 数/万円 | 目標 | LC | 円換算 | 比率 | 根拠 |

      ## 3. アナリスト詳細レポート
      - 【マクロ・需給】
      - 【セクター・個別】
      （具体数値や具体的なニュース名を含めて記述）

      ## 4. 銘柄入替提案
      【除外・様子見】（銘柄名・コード・理由）
      【新規追加候補】（銘柄名・コード・理由。環境に合致する多様な銘柄を提示せよ）

      回答の最後に必ず以下のJSONを出力してください。
      \`\`\`json
      { "new_tickers": ["XXXX", "YYYY"] }
      \`\`\`
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let newTickers = [];
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.new_tickers) newTickers = parsed.new_tickers;
      } catch (e) {}
    }

    const cleanText = text.replace(/```json\n[\s\S]*?\n```/, '').trim();
    return NextResponse.json({ success: true, analysis: cleanText, newTickers });
  } catch (error) {
    return NextResponse.json({ success: false, error: '分析エラー' });
  }
}