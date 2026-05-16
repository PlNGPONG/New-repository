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
      model: "gemini-3-flash-preview",
      tools: isDeepMode ? [{ googleSearch: {} }] as any : undefined
    });

    const stockInfo = stocks.map((s: any) => `${s.name}(${s.ticker}): ${s.price}円 (${s.changePercent?.toFixed(2)}%)`).join(', ');
    const excludeInfo = excludeList && excludeList.length > 0 ? excludeList.join(', ') : 'なし';

    // 神田さんのご指摘を反映し、プロンプトの「分析の必須条件」を劇的に厳格化
    const prompt = `
      # 指示
      あなたは超一流の短期トレードアナリストです。
      「虫の目（個別・需給）」と「鳥の目（マクロ・ニュース）」を激しく往復しながら、具体的かつ説得力のある分析を提供してください。
      出力文章の中にアスタリスク記号による強調は絶対に使用しないでください。見出しや強調には「」や【】を利用してください。

      # 分析の必須条件（極めて重要・厳守事項）
      1. 【時間軸と事実確認の厳格化】「決算前の下落」「決算発表内容」「PTS（夜間取引）の反応」「翌営業日の通常取引」を明確に区別せよ。事実関係の時間軸を混同し、誤った因果関係を構築することはプロとして恥ずべき行為である。
      2. 【推論の適正化（オルタナデータの扱い）】企業の採用ページや人事ブログなどの動向は有益な「先行指標（事業の注力度合い）」として扱うが、それをもって「受注や利益貢献が確定した」「業績反転の確度が高い」といった論理の飛躍・断定は絶対に避けること。
      3. 【需給とテクニカルの絶対確認】短期（数日〜2週間）トレードにおいて、ファンダメンタルズの良さだけでは買いの理由にならない。買いを推奨する場合は、必ず「VWAP（出来高加重平均価格）の推移」「出来高の変化」「前日高値のブレイク」「決算後のアク抜け感」「セクター内での相対強度」など、短期的な需給とプライスアクションの根拠を提示せよ。
      4. 【個別リスクの精査】株価下落の理由を安易に「マクロ環境（SOX指数の連れ安など）」に帰結させず、個社特有のガバナンス問題、品質不正、固有の需給悪化などの個別リスクを厳しく精査し、コメントやロスカット基準に反映させよ。
      5. 【絶対探索ルール】地合いが悪くても、他セクターや個別材料株を検索し、必ず「買い適性：高」または「中」となる銘柄を最低1～2銘柄発掘して発注案に提示せよ。
      6. 銘柄を記載する際は必ず「銘柄名（4桁コード）」の形式にすること。

      # 投資前提
      - 資金：1,600万円 / 期間：数日～2週間
      
      # インプットデータ
      - 市場データ：${stockInfo}
      - ユーザー提供資料：${referenceText || "なし"}
      - 除外銘柄（発注禁止）：${excludeInfo}

      # モード：${isDeepMode ? '【じっくりモード：広範な調査】' : '【クイックモード：迅速な戦術調整】'}
      ${isDeepMode 
        ? '前夜のNY市場動向、マクロ経済指標に加え、対象企業の直近の適時開示や採用動向をWeb検索で精査し、裏側の仮説を立てよ。ただし、最終的な買い判断は必ず短期の「需給とプライスアクション」に落とし込むこと。' 
        : '現在の株価と主要指標から、即時的な需給の歪みと戦術的なエントリー可否を判断せよ。'}

      # 出力フォーマット
      ## 1. サマリー
      （100字以内の切れ味鋭い総評。マクロのテーマと個別銘柄の整合性に矛盾がないように注意せよ）

      ## 2. 発注案
      | 銘柄名(コード) | 買い適性 | エントリーゾーン | 予定ロット(数量/金額) | ターゲット | ロスカット | 想定リスク | R/R | コメント |
      | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
      | 銘柄(XXXX) | 高/中/低 | 価格 | 数/万円 | 目標 | LC | 円換算 | 比率 | 根拠（需給・テクニカル・VWAP等の短期指標を必ず含めること） |

      ## 3. アナリスト詳細レポート
      - 【鳥の目：マクロ・外部環境】（織り込んだ具体的なニュース名、日時、数値を明記）
      - 【虫の目：セクター・企業動向と需給】（採用動向などの仮説と、実際の短期需給・チャートの事実を明確に分けて記述）

      ## 4. 銘柄入替提案
      【除外・様子見】（銘柄名・コード・具体的な理由。時間軸を正確に記載）
      【新規追加候補】（銘柄名・コード・短期需給に基づいた具体的な理由）

      回答の最後に必ずJSONブロックを出力してください。
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let newTickers: string[] = [];
    let cleanText = text;

    const jsonMarker = "```json";
    const startIndex = text.indexOf(jsonMarker);
    if (startIndex !== -1) {
      const jsonContent = text.substring(startIndex + jsonMarker.length);
      const endIndex = jsonContent.indexOf("```");
      if (endIndex !== -1) {
        try {
          const jsonString = jsonContent.substring(0, endIndex).trim();
          const parsed = JSON.parse(jsonString);
          if (parsed.new_tickers) newTickers = parsed.new_tickers;
          cleanText = text.substring(0, startIndex) + text.substring(startIndex + jsonMarker.length + endIndex + 3);
        } catch (e) {
          console.error("JSON Parse Error");
        }
      }
    }

    return NextResponse.json({ success: true, analysis: cleanText.trim(), newTickers });
  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ success: false, error: '分析エラー' });
  }
}