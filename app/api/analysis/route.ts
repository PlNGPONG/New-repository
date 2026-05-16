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

    // 実戦的な発注指示書として機能させるため、プロンプトを極限まで精緻化
    const prompt = `
      # 指示
      あなたは超一流の短期トレードアナリストです。
      「虫の目（個別・需給）」と「鳥の目（マクロ・ニュース）」を激しく往復しながら、具体的かつ実戦的な発注指示書を提供してください。
      出力文章の中にアスタリスク記号による強調は絶対に使用しないでください。見出しや強調には「」や【】を利用してください。

      # 分析の必須条件（極めて重要・厳守事項）
      1. 【PTS・ADRの反映とシナリオ別発注（最重要）】決算や重大発表の直後で、引け後PTSやADR（米国預託証券）が大きく動いている銘柄に対し、前日終値を基準とした「願望価格」での指値エントリーを絶対に提案してはならない。必ずPTS/ADRの反応を踏まえた「翌営業日の現実的な寄り付き想定価格」をベースにし、ギャップアップ・ギャップダウン等の複数シナリオに分けた発注戦術（例：〇円寄りなら寄り後30分のVWAP確認、ストップ高気配なら翌々日勝負など）をコメント欄に詳細に提示せよ。ADRを参照する場合は換算比率等も意識すること。
      2. 【ターゲット・損切りの整合性】エントリー価格をPTS等に合わせて現実的な価格（寄り付き想定価格）に更新した場合、ターゲット・ロスカット・R/Rもそれに合わせて必ず再計算せよ。前日終値をベースにした矛盾した価格設定は厳禁とする。
      3. 【時間軸と事実確認の厳格化】「決算前の下落」「決算発表内容」「PTSの反応」「翌営業日の通常取引」を明確に区別せよ。事実関係の時間軸を混同してはならない。
      4. 【誇大表現とテーマの牽強付会の禁止】「歴史的急落」「強烈な支持線」などの強い言葉は、過去何年ぶりの下落か、発行済株式数に対する明確な比率（例: 0.4%の自社株買いは下支えに過ぎない）などの定量的根拠がない限り使用禁止。また、好決算の理由（例：素材市況の改善）を、証拠なく「AI需要」などの流行テーマに無理やり結びつける「後付けテーマ化」を厳禁とする。
      5. 【需給とテクニカルの絶対確認】買いを推奨する場合は、銀行株なら日銀・金利動向などセクター特有の指標も加味しつつ、必ず「VWAPの推移」「出来高の変化」「セクター内での相対強度」など、短期的な需給の根拠を提示せよ。
      6. 【絶対探索ルール】地合いが悪くても、必ず「買い適性：高」または「中」となる銘柄を最低1～2銘柄発掘して発注案に提示せよ。
      7. 銘柄を記載する際は必ず「銘柄名（4桁コード）」の形式にすること。

      # 投資前提
      - 資金：1,600万円 / 期間：数日～2週間
      
      # インプットデータ
      - 市場データ：${stockInfo}
      - ユーザー提供資料：${referenceText || "なし"}
      - 除外銘柄（発注禁止）：${excludeInfo}

      # モード：${isDeepMode ? '【じっくりモード：広範な調査】' : '【クイックモード：迅速な戦術調整】'}
      ${isDeepMode 
        ? '前夜のNY市場動向、マクロ経済に加え、対象企業の直近の適時開示、引け後PTS動向、ADRの反応をWeb検索で精査し、明日の寄り付きのリアルな板状況を想定して戦術を立てよ。' 
        : '現在の株価と主要指標から、即時的な需給の歪みと戦術的なエントリー可否を判断せよ。'}

      # 出力フォーマット
      ## 1. サマリー
      （100字以内の切れ味鋭い総評。マクロのテーマと個別銘柄の整合性に矛盾がないように注意せよ）

      ## 2. 発注案
      | 銘柄名(コード) | 買い適性 | エントリーゾーン | 予定ロット(数量/金額) | ターゲット | ロスカット | 想定リスク | R/R | 寄り付きシナリオ別・戦術コメント |
      | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
      | 銘柄(XXXX) | 高/中/低 | 現実的な価格 | 数/万円 | 目標 | LC | 円換算 | 比率 | PTS/ADRの動向を踏まえた複数シナリオ（〇円寄りなら～）と需給・テクニカル根拠 |

      ## 3. アナリスト詳細レポート
      - 【鳥の目：マクロ・外部環境】（織り込んだ具体的なニュース名、日時、定量的数値を明記。煽り表現禁止）
      - 【虫の目：セクター・企業動向と需給】（決算内容、PTS反応、および事実に基づいたテーマ性のみを記述）

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