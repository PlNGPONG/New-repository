// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { auth, provider } from "../lib/firebase";
import { signInWithPopup, signOut, User } from "firebase/auth";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Stock = {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  note?: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  
  // 動的なリスト管理ステート
  const [watchList, setWatchList] = useState<string[]>([]);
  const [excludeList, setExcludeList] = useState<string[]>([]);
  const [newTickerInput, setNewTickerInput] = useState("");
  const [newExcludeInput, setNewExcludeInput] = useState("");
  
  // UI関連ステート
  const [referenceText, setReferenceText] = useState("");
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>("");

  // 初期ロード：ブラウザの保存領域からリストを復元
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    const savedWatchList = localStorage.getItem('watchList');
    if (savedWatchList) {
      setWatchList(JSON.parse(savedWatchList));
    } else {
      setWatchList(['8035', '6857', '6594', '8306']); // 初期銘柄
    }

    const savedExcludeList = localStorage.getItem('excludeList');
    if (savedExcludeList) {
      setExcludeList(JSON.parse(savedExcludeList));
    }

    return () => unsubscribe();
  }, []);

  // リストが変更されたら保存領域を更新
  useEffect(() => {
    if (watchList.length > 0) localStorage.setItem('watchList', JSON.stringify(watchList));
  }, [watchList]);

  useEffect(() => {
    localStorage.setItem('excludeList', JSON.stringify(excludeList));
  }, [excludeList]);

  // 株価データの取得関数
  const fetchStocks = async () => {
    if (watchList.length === 0) return;
    setIsLoadingStocks(true);
    try {
      const response = await fetch('/api/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: watchList }),
      });
      const result = await response.json();
      if (result.success) setStocks(result.data);
    } catch (error) {
      console.error("株価データの取得に失敗しました:", error);
    } finally {
      setIsLoadingStocks(false);
    }
  };

  // ユーザーログイン時、またはウォッチリスト増減時に株価を再取得
  useEffect(() => {
    if (user && watchList.length > 0) {
      fetchStocks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, watchList.length]);

  // AI分析の実行関数
  const handleAnalysis = async (mode: 'deep' | 'quick') => {
    if (stocks.length === 0) return;
    setIsLoadingAnalysis(true);
    setAnalysisError("");
    
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks, mode, excludeList, referenceText }),
      });
      const result = await response.json();
      
      if (result.success) {
        setAnalysis(result.analysis);
        
        // AIが提案した新規銘柄を自動的にウォッチリストに追加
        if (result.newTickers && result.newTickers.length > 0) {
          setWatchList(prev => {
            const updated = [...new Set([...prev, ...result.newTickers])];
            return updated;
          });
        }
      } else {
        setAnalysisError(result.error || "分析データの生成に失敗しました");
      }
    } catch (error) {
      console.error("AI分析の取得に失敗しました:", error);
      setAnalysisError("サーバーとの通信に失敗しました");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    setWatchList(prev => prev.filter(t => t !== ticker));
  };

  const handleRemoveExclude = (ticker: string) => {
    setExcludeList(prev => prev.filter(t => t !== ticker));
  };

  const kpiSymbols = ['NI225', 'TOPIX', 'USDJPY', 'SOX'];
  const watchListStocks = stocks.filter(stock => !kpiSymbols.includes(stock.ticker));

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      {user ? (
        <div className="flex flex-col min-h-screen">
          {/* ヘッダーエリア */}
          <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">日本株投資サポート</h1>
            <div className="flex items-center gap-4">
              {user.photoURL && (
                <img src={user.photoURL} alt="プロフィール" className="w-9 h-9 rounded-full ring-2 ring-slate-100" />
              )}
              <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.displayName}</span>
              <button onClick={() => signOut(auth)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors">
                ログアウト
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
            
            {/* KPIカード */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpiSymbols.map(ticker => {
                const stock = stocks.find(s => s.ticker === ticker);
                return (
                  <div key={ticker} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center h-24">
                    {stock ? (
                      <>
                        <span className="text-xs font-medium text-slate-500 mb-1">{stock.name.replace('(Live)', '')}</span>
                        <span className="text-xl font-bold text-slate-800">
                          {stock.price !== null ? stock.price.toLocaleString(undefined, { minimumFractionDigits: ticker === 'USDJPY' ? 2 : 0, maximumFractionDigits: 2 }) : '---'}
                        </span>
                        <span className={`text-sm font-medium mt-1 ${(stock.change ?? 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {(stock.change ?? 0) > 0 ? '+' : ''}{stock.change !== null ? stock.change.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '---'} 
                          ({(stock.changePercent ?? 0) > 0 ? '+' : ''}{stock.changePercent !== null ? stock.changePercent.toFixed(2) : '---'}%)
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400">取得中...</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* コントロールパネル */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">除外リスト（分析・監視のみ、買い推奨を行わない）</h3>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    placeholder="銘柄コード(例: 9984)" 
                    value={newExcludeInput} 
                    onChange={e => setNewExcludeInput(e.target.value)} 
                    className="border border-slate-300 px-3 py-1.5 text-sm rounded-md flex-1"
                  />
                  <button 
                    // ここがエラーの原因でした（newExcludeList → excludeList に修正）
                    onClick={() => { if(newExcludeInput) { setExcludeList([...excludeList, newExcludeInput]); setNewExcludeInput(""); } }} 
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 text-sm rounded-md font-medium"
                  >追加</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {excludeList.map(ticker => (
                    <span key={ticker} className="bg-red-50 text-red-600 border border-red-200 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      {ticker} <button onClick={() => handleRemoveExclude(ticker)} className="font-bold ml-1 hover:text-red-800">×</button>
                    </span>
                  ))}
                  {excludeList.length === 0 && <span className="text-xs text-slate-400">登録なし</span>}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-700">Source Input（ニュースや仮説のテキスト入力）</h3>
                  <button onClick={() => setShowSourceInput(!showSourceInput)} className="text-xs text-blue-600 hover:underline">
                    {showSourceInput ? '閉じる' : 'Add Source'}
                  </button>
                </div>
                {showSourceInput ? (
                  <textarea 
                    value={referenceText}
                    onChange={(e) => setReferenceText(e.target.value)}
                    placeholder="ここに日銀の発表内容や気になるニュースのテキストを貼り付けると、AIが考慮して分析します。"
                    className="w-full border border-slate-300 rounded-md p-3 text-sm min-h-[80px]"
                  />
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-md p-3 text-sm text-slate-400 cursor-pointer" onClick={() => setShowSourceInput(true)}>
                    ここをクリックして参考テキストを追加...
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 左側：AIシナリオ分析 */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                    本日のシナリオ分析
                  </h2>
                  <div className="flex gap-2">
                    <button onClick={() => handleAnalysis('quick')} disabled={isLoadingAnalysis} className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-md transition-colors shadow-sm">
                      クイックモード実行
                    </button>
                    <button onClick={() => handleAnalysis('deep')} disabled={isLoadingAnalysis} className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm">
                      じっくりモード実行
                    </button>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  {isLoadingAnalysis ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-sm">Geminiが市場を分析中...</p>
                      <p className="text-xs mt-2 text-slate-300">※じっくりモードは検索を含むため十数秒かかります</p>
                    </div>
                  ) : analysisError ? (
                    <div className="flex-1 bg-red-50 rounded-lg border border-red-100 p-8 flex flex-col items-center justify-center text-red-500 min-h-[400px]">
                      <p className="text-base font-bold mb-2">エラーが発生しました</p>
                      <p className="text-sm text-center">{analysisError}</p>
                    </div>
                  ) : analysis ? (
                    <div className="flex-1 bg-blue-50/30 rounded-lg p-6 text-slate-700 text-sm overflow-auto min-h-[400px]">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => <div className="overflow-x-auto"><table className="w-full border-collapse border border-slate-300 my-4 bg-white text-xs" {...props} /></div>,
                          th: ({node, ...props}) => <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-bold text-slate-800" {...props} />,
                          td: ({node, ...props}) => <td className="border border-slate-300 px-3 py-2 text-slate-700" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold text-slate-800 mt-6 mb-3 border-b border-slate-200 pb-1" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-base font-bold text-slate-800 mt-5 mb-2" {...props} />,
                          p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
                        }}
                      >
                        {analysis}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex-1 bg-slate-50 rounded-lg border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                      <p className="text-sm text-center">
                        右上のボタンからモードを選んで分析を開始してください。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右側：個別銘柄ウォッチリスト */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-fit max-h-[800px]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                    ウォッチリスト
                  </h2>
                </div>
                
                {/* 銘柄追加フォーム */}
                <div className="px-4 py-3 border-b border-slate-100 bg-white flex gap-2">
                  <input 
                    type="text" 
                    placeholder="銘柄コード(追加)" 
                    value={newTickerInput} 
                    onChange={e => setNewTickerInput(e.target.value)} 
                    className="border border-slate-300 px-3 py-1.5 text-sm rounded-md flex-1"
                  />
                  <button 
                    onClick={() => { if(newTickerInput) { setWatchList([...watchList, newTickerInput]); setNewTickerInput(""); } }} 
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-1.5 text-sm rounded-md font-bold transition-colors"
                  >追加</button>
                </div>

                <div className="p-0 flex-1 overflow-auto">
                  <ul className="divide-y divide-slate-100">
                    {isLoadingStocks ? (
                      <li className="px-6 py-8 text-center text-slate-500 text-sm">株価データを取得中...</li>
                    ) : (
                      watchListStocks.map((stock) => (
                        <li key={stock.ticker} className="px-4 py-3 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                          <div>
                            <span className="text-xs font-bold text-slate-500 block mb-0.5">{stock.ticker}</span>
                            <span className="text-sm font-bold text-slate-800">{stock.name.replace('(Live)', '')}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              {stock.price !== null ? (
                                <>
                                  <span className="text-sm font-bold text-slate-800 block">{stock.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                  <span className={`text-xs font-medium ${(stock.change ?? 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {(stock.change ?? 0) > 0 ? '+' : ''}{stock.change !== null ? stock.change.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '---'} ({(stock.changePercent ?? 0) > 0 ? '+' : ''}{stock.changePercent !== null ? stock.changePercent.toFixed(2) : '---'}%)
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">{stock.note}</span>
                              )}
                            </div>
                            <button onClick={() => handleRemoveTicker(stock.ticker)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

            </div>
          </main>
        </div>
      ) : (
        /* 未ログイン時の画面 */
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-slate-100 -z-10"></div>
          <div className="bg-white p-10 max-w-md w-full rounded-2xl shadow-xl border border-slate-100 text-center relative z-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-200">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">投資サポートへようこそ</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              最新の相場シナリオと個別銘柄の動向をダッシュボードで確認するには、Googleアカウントでログインしてください。
            </p>
            <button 
              onClick={handleLogin} 
              className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Googleで安全にログイン
            </button>
          </div>
        </div>
      )}
    </div>
  );
}