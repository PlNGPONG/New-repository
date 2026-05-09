// app/api/analysis/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'APIキーが設定されていません' });
  }

  try {
    const { stocks } = await request.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // AIに渡すプロンプト（指示文）を作成
    const stockInfo = stocks.map((s: any) => `${s.name}(${s.ticker}): ${s.price}円 (${s.changePercent}%)`).join(', ');
    
    const prompt = `
      あなたはプロの証券アナリストです。
      以下の最新の日本株市場データに基づき、本日の相場状況を150文字程度で簡潔に分析してください。
      特に半導体セクターや銀行セクターの動きに注目して、投資家が意識すべきポイントを解説してください。
      
      データ：${stockInfo}
      
      出力は親しみやすく、かつ専門的なトーンで行ってください。
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ success: true, analysis: text });

  } catch (error) {
    console.error("AI分析エラー:", error);
    return NextResponse.json({ success: false, error: '分析に失敗しました' });
  }
}