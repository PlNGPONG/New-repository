// app/api/analysis/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: 'APIキー未設定' });

  try {
    const { stocks } = await request.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Web検索機能を有効化
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} }] as any 
    });

    const stockInfo = stocks.map((s: any) => `${s.name}: ${s.price}円 (${s.changePercent?.toFixed(2)}%)`).join(', ');

    const prompt = `
      # 指示
      あなたはプロの短期トレードアナリストです。以下の要件で日本株市場のレポートを作成してください。
      なお、出力文章の中にアスタリスク記号による強調は絶対に使用しないでください。見出しや強調には「」や【】を利用してください。

      # 投資前提
      - 投資資金：1,600万円
      - 投資期間：数日～2週間（短期）
      
      # 現在の市場データ
      ${stockInfo}

      # 分析ステップ
      1. 【鳥の目】最新のニュース、為替、金利、地政学リスクをWeb検索で取得し、マクロ環境を整理せよ。
      2. 【プレーヤー推定】海外投資家、CTA、事業会社の自社株買い、個人信用の需給状況を推定せよ。
      3. 【虫の目】上記を踏まえ、個別銘柄（特に半導体、銀行）のチャートと需給から買い適性を判断せよ。
      4. 【銘柄入替提案】現在の相場環境に基づき、現在のウォッチリストから外すべき銘柄と、新たに追加すべき有力なセクター・銘柄（2～3銘柄）を具体的に提案せよ。

      # 出力フォーマット（厳守）
      ## 1. サマリー
      （100字以内の総評）

      ## 2. 発注案
      | 銘柄名 | 買い適性 | エントリーゾーン | 予定ロット(数量/金額) | ターゲット | ロスカット | 想定リスク | R/R |
      | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
      | (銘柄名) | (高/中/低) | (価格帯) | (株数/万円) | (目標価格) | (LC価格) | (円換算) | (比率) |

      ## 3. アナリストコメント
      （心理・需給・外部要因の詳細）

      ## 4. 銘柄入替提案
      【除外候補】（理由）
      【新規追加候補】（銘柄名・理由）
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ success: true, analysis: text });
  } catch (error) {
    return NextResponse.json({ success: false, error: '分析エラー' });
  }
}