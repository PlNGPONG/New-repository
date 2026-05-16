// app/api/analysis/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// 1. JSON Schemaの厳密な定義（型の強制）
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    evidence: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ticker: { type: SchemaType.STRING },
          name: { type: SchemaType.STRING },
          closePrice: { type: SchemaType.NUMBER, nullable: true },
          ptsPrice: { type: SchemaType.NUMBER, nullable: true },
          ptsTime: { type: SchemaType.STRING, nullable: true },
          ptsSourceTitle: { type: SchemaType.STRING, nullable: true },
          ptsSourceUrl: { type: SchemaType.STRING, nullable: true },
          adrPrice: { type: SchemaType.NUMBER, nullable: true },
          adrCurrency: { type: SchemaType.STRING, nullable: true },
          adrRatio: { type: SchemaType.STRING, nullable: true },
          adrJpyPrice: { type: SchemaType.NUMBER, nullable: true },
          adrSourceUrl: { type: SchemaType.STRING, nullable: true },
          earningsFacts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          unsupportedClaims: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["ticker"],
      },
    },
    orders: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ticker: { type: SchemaType.STRING },
          name: { type: SchemaType.STRING },
          buyRating: { type: SchemaType.STRING, description: "高, 中, 低, または 見送り" },
          entryType: { type: SchemaType.STRING, description: "fixed, conditional, または avoid" },
          entryLow: { type: SchemaType.NUMBER, nullable: true },
          entryHigh: { type: SchemaType.NUMBER, nullable: true },
          entryPlan: { type: SchemaType.STRING, description: "戦術のテキスト説明" },
          lotAmountYen: { type: SchemaType.NUMBER, nullable: true },
          lotPlan: { type: SchemaType.STRING },
          target: { type: SchemaType.STRING },
          stopLoss: { type: SchemaType.STRING },
          riskYen: { type: SchemaType.NUMBER, nullable: true },
          rr: { type: SchemaType.NUMBER, nullable: true },
          scenarioComment: { type: SchemaType.STRING },
        },
        required: ["ticker", "name", "buyRating", "entryType", "entryPlan"],
      },
    },
    report: {
      type: SchemaType.OBJECT,
      properties: {
        macro: { type: SchemaType.STRING },
        micro: { type: SchemaType.STRING },
      },
      required: ["macro", "micro"],
    },
    newTickers: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["summary", "evidence", "orders", "report", "newTickers"],
};

// 2. TypeScriptによるハード・バリデーション
function validateOrder(order: any, evidenceList: any[], excludeList: string[] = []) {
  const warnings: string[] = [];
  const ev = evidenceList.find((e: any) => e.ticker === order.ticker);

  if (!ev) {
    return [`${order.ticker}: 証拠データが存在しない銘柄の発注案です。`];
  }

  // 除外リストのチェック
  const excluded = excludeList.some((x) =>
    [order.ticker, order.name].filter(Boolean).some((v) =>
      String(v).toLowerCase().includes(String(x).toLowerCase())
    )
  );
  if (excluded) {
    warnings.push(`${order.ticker}: 除外リストに含まれている銘柄です。発注案に入れてはいけません。`);
  }

  // 出典URLの必須チェック
  if (ev.ptsPrice && !ev.ptsSourceUrl) {
    warnings.push(`${order.ticker}: PTS価格があるのに出典URLがありません。`);
  }
  if (ev.adrPrice && (!ev.adrRatio || !ev.adrJpyPrice || !ev.adrSourceUrl)) {
    warnings.push(`${order.ticker}: ADR価格の換算条件または出典URLが不足しています。`);
  }

  // 乖離率と固定指値の矛盾チェック（神田ロジック）
  const postMarketPrice = ev.ptsPrice ?? ev.adrJpyPrice ?? null;
  if (postMarketPrice && ev.closePrice) {
    const gapRate = (postMarketPrice - ev.closePrice) / ev.closePrice;
    if (Math.abs(gapRate) >= 0.05 && order.entryType === "fixed") {
      warnings.push(
        `${order.ticker}: 引け後価格が終値比${(gapRate * 100).toFixed(1)}%乖離しています。固定価格エントリー（fixed）ではなく、寄り後VWAP確認型などの条件付きエントリー（conditional）にしてください。`
      );
    }
  }

  // 資金管理の絶対ルール
  if (order.lotAmountYen && order.lotAmountYen > 6000000) {
    warnings.push(`${order.ticker}: 1銘柄の投入額が600万円超です。資金1600万円に対する集中投資として過大です。`);
  }
  if (order.riskYen && order.riskYen > 320000) {
    warnings.push(`${order.ticker}: 1銘柄の想定リスクが資金1600万円の2%（32万円）を超えています。`);
  }
  if (order.buyRating === "高" && order.rr !== null && order.rr < 1.5) {
    warnings.push(`${order.ticker}: リスクリワード（R/R）が1.5未満なのに買い適性が「高」に設定されています。`);
  }

  return warnings;
}

// 3. JSONをMarkdownに変換（アスタリスク不使用、表現の適正化）
function jsonToMarkdown(data: any) {
  let md = `## 1. サマリー\n${data.summary}\n\n`;
  
  md += `## 2. 発注案\n`;
  md += `| 銘柄名(コード) | 買い適性 | エントリーゾーン | 予定ロット | ターゲット | ロスカット | R/R | 寄り付きシナリオ別・戦術コメント |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  data.orders.forEach((o: any) => {
    md += `| ${o.name}(${o.ticker}) | ${o.buyRating} | ${o.entryPlan} | ${o.lotPlan} | ${o.target} | ${o.stopLoss} | ${o.rr || '-'} | ${o.scenarioComment} |\n`;
  });

  md += `\n## 3. アナリスト詳細レポート\n`;
  md += `- 【鳥の目：マクロ・外部環境】\n  ${data.report.macro}\n`;
  md += `- 【虫の目：セクター・企業動向と需給】\n  ${data.report.micro}\n`;

  md += `\n## 4. エビデンス・チェック（AI収集情報・機械チェック）\n`;
  data.evidence.forEach((e: any) => {
    const ptsInfo = e.ptsPrice ? `${e.ptsPrice}円 (時刻: ${e.ptsTime || '不明'}, 出典: ${e.ptsSourceTitle || 'なし'})` : '確認できず';
    const adrInfo = e.adrJpyPrice ? `${e.adrJpyPrice}円 (比率: ${e.adrRatio || '不明'}, 出典: ${e.adrSourceUrl ? 'あり' : 'なし'})` : '確認できず';
    md += `- 【${e.ticker}】: PTS[${ptsInfo}], ADR円換算[${adrInfo}]\n`;
  });

  return md;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: 'APIキー未設定' });

  try {
    const { stocks, mode, excludeList, referenceText } = await request.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    const isDeepMode = mode === 'deep';
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      tools: isDeepMode ? [{ googleSearch: {} }] as any : undefined,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const stockInfo = stocks.map((s: any) => `${s.name}(${s.ticker}): 参考価格 ${s.price}円`).join(', ');
    const excludeInfo = excludeList && excludeList.length > 0 ? excludeList.join(', ') : 'なし';

    const basePrompt = `
      あなたは短期トレード用の発注レポートを作成するAIです。
      価格・PTS・ADR/ADS・決算数値について、出典URLや時刻が確認できない数字を捏造してはならない。

      【禁止事項】
      - PTS価格やADR価格を推測して作ること。
      - 引け後材料（PTS等）で大きく動いているのに、参考価格近辺をエントリー価格として流用すること。
      - ターゲットがエントリー価格を下回る発注案を出すこと。
      - R/Rを計算せずに雰囲気で書くこと。

      【発注ルール】
      1. 決算発表後の銘柄は、PTSまたはADR/ADSの確認結果を evidence に記載せよ。URLや時刻が不明な場合は「確認できず」とする。
      2. PTSまたはADR/ADSが参考価格から大きく乖離している場合、エントリーゾーンは「固定価格（fixed）」ではなく「条件型戦術（conditional）」（例：寄り後VWAP回復確認など）とせよ。
      3. 発注案は evidence に存在する事実だけを使うこと。
      4. 条件を満たす銘柄がない、または相場環境が著しく悪い場合は、無理に買い候補を作らず、買い適性を「見送り（avoid）」とし現金待機を推奨してよい。
      5. 除外リストに含まれる銘柄は絶対に発注案に含めないこと。

      市場データ（参考価格）: ${stockInfo}
      ユーザーからのSource Input: ${referenceText || "なし"}
      除外リスト（発注禁止）: ${excludeInfo}
    `;

    let parsedData: any = null;
    let finalWarnings: string[] = [];

    // 自己修復ループ（最大2回）
    for (let attempt = 0; attempt < 2; attempt++) {
      const currentPrompt = attempt === 0 
        ? basePrompt 
        : `以下の発注案にはシステム検証エラーがあります。エラーを全て解消して、再度JSONを出力してください。固定価格が否定された場合は条件付き戦術（conditional）に変更してください。\n\n検証エラー:\n${finalWarnings.join('\n')}\n\n前回出力:\n${JSON.stringify(parsedData)}`;

      const result = await model.generateContent(currentPrompt);
      const responseText = result.response.text();
      
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        throw new Error("JSONのパースに失敗しました");
      }

      finalWarnings = [];
      parsedData.orders.forEach((order: any) => {
        const warnings = validateOrder(order, parsedData.evidence, excludeList || []);
        finalWarnings = finalWarnings.concat(warnings);
      });

      if (finalWarnings.length === 0) break;
      console.log(`Validation attempt ${attempt + 1} failed:`, finalWarnings);
    }

    // 修復後にもエラーが残っていた場合の強制フォールバック処理
    if (finalWarnings.length > 0) {
      parsedData.orders = parsedData.orders.map((o: any) => ({
        ...o,
        buyRating: "見送り",
        entryType: "avoid",
        entryPlan: "システム検証エラーが残存したため強制見送り",
        scenarioComment: `【警告】以下の検証エラーが解消されませんでした: ${finalWarnings.join(" / ")}`
      }));
    }

    const finalMarkdown = jsonToMarkdown(parsedData);

    return NextResponse.json({ 
      success: true, 
      analysis: finalMarkdown, 
      newTickers: parsedData.newTickers || [] 
    });

  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ success: false, error: '分析またはシステムバリデーションにて深刻なエラーが発生しました。' });
  }
}