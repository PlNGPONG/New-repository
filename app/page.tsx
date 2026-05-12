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
  const [watchList, setWatchList] = useState<string[]>([]);
  const [excludeList, setExcludeList] = useState<string[]>([]);
  const [newTickerInput, setNewTickerInput] = useState("");
  const [newExcludeInput, setNewExcludeInput] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    const savedWatch = localStorage.getItem('watchList');
    setWatchList(savedWatch ? JSON.parse(savedWatch) : ['8035', '6857', '6594', '8306']);
    const savedExclude = localStorage.getItem('excludeList');
    setExcludeList(savedExclude ? JSON.parse(savedExclude) : []);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (watchList.length > 0) localStorage.setItem('watchList', JSON.stringify(watchList));
  }, [watchList]);

  useEffect(() => {
    localStorage.setItem('excludeList', JSON.stringify(excludeList));
  }, [excludeList]);

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
      if (result.success) {
        setStocks(result.data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error("取得失敗:", error);
    } finally {
      setIsLoadingStocks(false);
    }
  };

  useEffect(() => {
    if (user && watchList.length > 0) fetchStocks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, watchList.length]);

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
        if (result.newTickers?.length > 0) {
          setWatchList(prev => [...new Set([...prev, ...result.newTickers])]);
        }
      } else {
        setAnalysisError(result.error || "分析失敗");
      }
    } catch (error) {
      setAnalysisError("通信失敗");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const kpiSymbols = ['N225', 'NI225', 'TOPIX', 'USDJPY', 'SOX'];
  const watchListStocks = stocks.filter(stock => !kpiSymbols.includes(stock.ticker));

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      {user ? (
        <div className="flex flex-col min-h-screen">
          <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-800">日本株投資サポート</h1>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">更新: {lastUpdated || '---'}</span>
              <button onClick={fetchStocks} disabled={isLoadingStocks} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <svg className={`w-4 h-4 text-slate-600 ${isLoadingStocks ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M2.1 12a9 9 0 0115.1-6.9L20 9m-8 11a9 9 0 01-7.1-3.1L4 15"></path></svg>
              </button>
              <button onClick={() => signOut(auth)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md">ログアウト</button>
            </div>
          </header>

          <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {kpiSymbols.map(ticker => {
                const s = stocks.find(st => st.ticker === ticker);
                return (
                  <div key={ticker} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center h-24">
                    <span className="text-xs font-medium text-slate-500 mb-1">{s?.name.replace('(Live)', '') || ticker}</span>
                    <span className="text-lg font-bold text-slate-800">{s?.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '---'}</span>
                    <span className={`text-xs font-medium ${(s?.change ?? 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {(s?.change ?? 0) > 0 ? '+' : ''}{s?.change?.toFixed(2) || '---'} ({(s?.changePercent ?? 0) > 0 ? '+' : ''}{s?.changePercent?.toFixed(2) || '---'}%)
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">除外リスト（買い推奨制限）</h3>
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="コード" value={newExcludeInput} onChange={e => setNewExcludeInput(e.target.value)} className="border border-slate-300 px-3 py-1.5 text-sm rounded-md flex-1"/>
                  <button onClick={() => { if(newExcludeInput) { setExcludeList([...excludeList, newExcludeInput]); setNewExcludeInput(""); } }} className="bg-slate-200 px-4 py-1.5 text-sm rounded-md">追加</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {excludeList.map(t => (
                    <span key={t} className="bg-red-50 text-red-600 border border-red-200 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      {t} <button onClick={() => setExcludeList(prev => prev.filter(x => x !== t))}>×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-700">Source Input</h3>
                  <button onClick={() => setShowSourceInput(!showSourceInput)} className="text-xs text-blue-600">{showSourceInput ? '閉じる' : '追加'}</button>
                </div>
                {showSourceInput && <textarea value={referenceText} onChange={(e) => setReferenceText(e.target.value)} placeholder="ニュースなどを貼付" className="w-full border border-slate-300 rounded-md p-3 text-sm min-h-[80px]"/>}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-base font-bold text-slate-800">本日のシナリオ分析</h2>
                  <div className="flex gap-2">
                    <button onClick={() => handleAnalysis('quick')} disabled={isLoadingAnalysis} className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-md">クイック</button>
                    <button onClick={() => handleAnalysis('deep')} disabled={isLoadingAnalysis} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-md">じっくり</button>
                  </div>
                </div>
                <div className="p-6 flex-1 min-h-[400px]">
                  {isLoadingAnalysis ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-sm font-medium">Geminiがグローバル市場を精査中...</p>
                    </div>
                  ) : analysisError ? (
                    <p className="text-red-500">{analysisError}</p>
                  ) : (
                    <div className="prose prose-slate max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        table: ({node, ...props}) => <div className="overflow-x-auto"><table className="w-full border-collapse border border-slate-300 my-4 text-xs bg-white" {...props} /></div>,
                        th: ({node, ...props}) => <th className="border border-slate-300 bg-slate-100 px-3 py-2 font-bold" {...props} />,
                        td: ({node, ...props}) => <td className="border border-slate-300 px-3 py-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-6 mb-3 border-b pb-1" {...props} />,
                      }}>{analysis || "分析を開始してください。"}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-fit">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-800">ウォッチリスト</h2>
                  <span className="text-[10px] text-slate-400">自動更新対応</span>
                </div>
                <div className="px-4 py-3 border-b flex gap-2 bg-white">
                  <input type="text" placeholder="コード" value={newTickerInput} onChange={e => setNewTickerInput(e.target.value)} className="border px-3 py-1 text-sm rounded-md flex-1"/>
                  <button onClick={() => { if(newTickerInput) { setWatchList([...watchList, newTickerInput]); setNewTickerInput(""); } }} className="bg-emerald-50 text-emerald-700 px-3 py-1 text-sm rounded-md font-bold">追加</button>
                </div>
                <div className="overflow-auto max-h-[600px]">
                  <ul className="divide-y">
                    {watchListStocks.map(s => (
                      <li key={s.ticker} className="px-4 py-3 hover:bg-slate-50 flex justify-between items-center group">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">{s.ticker}</span>
                          <span className="text-sm font-bold text-slate-800">{s.name.replace('(Live)', '')}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-sm font-bold block">{s.price?.toLocaleString() || '---'}</span>
                            <span className={`text-[10px] font-medium ${(s.change ?? 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {(s.change ?? 0) > 0 ? '+' : ''}{s.changePercent?.toFixed(2)}%
                            </span>
                          </div>
                          <button onClick={() => setWatchList(prev => prev.filter(t => t !== s.ticker))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white p-10 max-w-md w-full rounded-2xl shadow-xl text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-8">投資サポート</h2>
            <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-3">
              Googleでログイン
            </button>
          </div>
        </div>
      )}
    </div>
  );
}