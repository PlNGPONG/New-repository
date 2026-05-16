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

    // 神田さんのアイデア「順次推論（Chain of Thought）」を実装
    const prompt = `
      # 指示
      あなたは超一流の短期トレードアナリストです。
      出力文章の中にアスタリスク記号による強調は絶対に使用しないでください。見出しや強調には「」や【】を利用してください。

      # 【最重要】思考と出力のプロセス（スクラッチパッド手法）
      いきなりレポートを出力することは厳禁です。必ず以下の手順で、自分用の「メモ書き（思考プロセス）」を書き出し、事実確認と論理チェックを行ってから清書（レポート）を作成してください。

      <思考プロセス>
      1. 事実の整理：各銘柄の前日終値、引け後の決算内容、PTS（夜間取引）の価格、ADRの価格をWeb検索等を用いて箇条書きで整理する。
      2. マクロと個別の切り分け：マクロ環境（SOX等）と個別材料（PTS等）が矛盾する場合、必ず個別材料（PTS）を優先して寄り付き価格を想定する。
      3. 戦術の組み立て：「前日終値での願望指値」になっていないか？明日の想定寄り付き価格に対して、ターゲットとロスカット幅のR/R（リスクリワード）が成立しているか計算する。
      4. 最終チェック：誇大表現はないか？後付けのテーマ化をしていないか？
      </思考プロセス>

      ========== (この区切り線の後に清書を出力してください)

      # 分析の絶対的ルール
      1. 【PTS・ADRの絶対反映】決算発表後の銘柄は、PTSやADRの反応をベースに翌営業日の「寄り付き想定価格」を算定し、そこからの戦術（寄り後30分待つ等）を提示せよ。前日終値での指値は禁止。
      2. 【時間軸の分離】「通常取引での下落」と「引け後の決算」「PTS反応」を絶対に混同しない。
      3. 【需給の確認】買い推奨時は「VWAP推移」「出来高」「セクター内相対強度」などの短期需給根拠を必須とする。
      4. 【絶対探索】地合いが悪くても、必ず「買い適性：高」または「中」を最低1～2銘柄発掘せよ。
      5. 銘柄記載は「銘柄名（4桁コード）」の形式を厳守。

      # 投資前提
      - 資金：1,600万円 / 期間：数日～2週間
      
      # インプットデータ
      - 市場データ：${stockInfo}
      - ユーザー提供資料：${referenceText || "なし"}
      - 除外銘柄（発注禁止）：${excludeInfo}

      # 出力フォーマット（========== の区切り線の後に以下を出力）
      ## 1. サマリー
      （100字以内の総評）

      ## 2. 発注案
      | 銘柄名(コード) | 買い適性 | エントリーゾーン | 予定ロット(数量/金額) | ターゲット | ロスカット | 想定リスク | R/R | 寄り付きシナリオ別・戦術コメント |
      | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
      | 銘柄(XXXX) | 高/中/低 | 現実的な想定価格 | 数/万円 | 目標 | LC | 円換算 | 比率 | PTS/ADRを踏まえた複数シナリオと需給根拠 |

      ## 3. アナリスト詳細レポート
      - 【鳥の目：マクロ・外部環境】（具体的なニュース名、日時、数値を明記）
      - 【虫の目：セクター・企業動向と需給】（決算内容、PTS反応、事実に基づくテーマ性）

      ## 4. 銘柄入替提案
      【除外・様子見】（銘柄・コード・理由）
      【新規追加候補】（銘柄・コード・短期需給に基づいた理由）

      回答の最後に必ずJSONブロックを出力してください。
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let newTickers: string[] = [];
    let cleanText = text;

    // 1. JSONブロックの抽出と削除
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

    // 2. AIの「思考プロセス（メモ書き）」部分を画面表示から切り捨てる
    const reportDivider = "==========";
    const dividerIndex = cleanText.indexOf(reportDivider);
    if (dividerIndex !== -1) {
      // 区切り線より後ろの部分だけをフロントエンドに返す
      cleanText = cleanText.substring(dividerIndex + reportDivider.length).trim();
    } else {
      // 万が一区切り線を忘れた場合は、<思考プロセス>の閉じタグを探す
      const thoughtEndMarker = "</思考プロセス>";
      const thoughtEndIndex = cleanText.indexOf(thoughtEndMarker);
      if (thoughtEndIndex !== -1) {
        cleanText = cleanText.substring(thoughtEndIndex + thoughtEndMarker.length).trim();
      }
    }

    return NextResponse.json({ success: true, analysis: cleanText.trim(), newTickers });
  } catch (error) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ success: false, error: '分析エラー' });
  }
}