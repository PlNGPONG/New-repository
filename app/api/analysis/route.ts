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
    
    // ① モデルをご指定の「gemini-3-flash-preview」に変更
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      tools: isDeepMode ? [{ googleSearch: {} }] as any : undefined
    });

    const stockInfo = stocks.map((s: any) => `${s.name}(${s.ticker}): ${s.price}円 (${s.changePercent?.toFixed(2)}%)`).join(', ');
    const excludeInfo = excludeList && excludeList.length > 0 ? excludeList.join(', ') : 'なし';

    // ②③ 分析の深さと具体性を強制するプロンプトの大幅改修
    const prompt = `
      # 指示
      あなたは超一流の短期トレードアナリストです。
      「虫の目（個別・需給）」と「鳥の目（マクロ・ニュース）」を激しく往復しながら、具体的かつ説得力のある分析を提供してください。
      出力文章の中にアスタリスク記号による強調は絶対に使用しないでください。見出しや強調には「」や【】を利用してください。

      # 分析の必須条件（極めて重要）
      1. 【具体性の徹底】「地政学リスクの高まり」「インフレ懸念」といった曖昧な表現は禁止します。必ず「いつ」「誰が」「何を」した報道（例：〇月〇日の〇〇通信の報道における〇〇発言、昨晩発表の米CPIの具体的な数値など）を織り込んでいるのか、情報の鮮度と具体明細を明記してください。情勢変化の前提を明確にするためです。
      2. 【カタリストの意識】数日～2週間のリターンを最大化するため、直近2週間以内に控える重要イベント（決算発表、米雇用統計、日銀・FRB会合など）の日程を必ず意識し、それに向けた資金動向を分析に組み込んでください。
      3. ウォッチリスト外の銘柄も積極的に発注案に含めること。
      4. 銘柄を記載する際は必ず「銘柄名（4桁コード）」の形式にすること。

      # 投資前提
      - 資金：1,600万円 / 期間：数日～2週間
      
      # インプットデータ
      - 市場データ：${stockInfo}
      - ユーザー提供資料：${referenceText || "なし"}
      - 除外銘柄（発注禁止）：${excludeInfo}

      # モード：${isDeepMode ? '【じっくりモード：広範な調査】' : '【クイックモード：迅速な戦術調整】'}
      ${isDeepMode 
        ? '前夜のNY市場動向、VIX指数、米国債利回り、為替、原油価格、主要な地政学・政治ニュースをWeb検索で具体的に精査し、海外投資家やCTAの行動規範、および直近のカタリスト（イベント日程）に照らし合わせて分析せよ。' 
        : '現在の株価と主要指標から、即時的な需給の歪みと戦術的なエントリー可否を判断せよ。'}

      # 出力フォーマット
      ## 1. サマリー
      （100字以内の切れ味鋭い総評。ここでも曖昧さを排除し、中核となる具体的な事象を記載すること）

      ## 2. 発注案
      | 銘柄名(コード) | 買い適性 | エントリーゾーン | 予定ロット(数量/金額) | ターゲット | ロスカット | 想定リスク | R/R | コメント |
      | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
      | 銘柄(XXXX) | 高/中/低 | 価格 | 数/万円 | 目標 | LC | 円換算 | 比率 | 根拠（具体的な事象や数値を交えて） |

      ## 3. アナリスト詳細レポート
      - 【鳥の目：マクロ・外部環境】（織り込んだ具体的なニュース名、日時、数値、および直近のイベントスケジュールを明記）
      - 【虫の目：セクター・個別需給】（テクニカル、需給動向、価格の歪み）

      ## 4. 銘柄入替提案
      【除外・様子見】（銘柄名・コード・具体的な理由）
      【新規追加候補】（銘柄名・コード・具体的な理由。環境に合致する多様な銘柄を提示せよ）

      回答の最後に必ず以下のJSONを出力してください。
      \`\`\`json
      { "new_tickers": ["XXXX", "YYYY"] }
      \`\`\`
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let newTickers = [];
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*
```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.new_tickers) newTickers = parsed.new_tickers;
      } catch (e) {}
    }

    const cleanText = text.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
    return NextResponse.json({ success: true, analysis: cleanText, newTickers });
  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ success: false, error: '分析エラー' });
  }
}