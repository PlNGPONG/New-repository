// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { auth, provider } from "../lib/firebase";
import { signInWithPopup, signOut, User } from "firebase/auth";

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
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchStocks = async () => {
      setIsLoadingStocks(true);
      try {
        const response = await fetch('/api/stocks');
        const result = await response.json();
        if (result.success) {
          setStocks(result.data);
        }
      } catch (error) {
        console.error("株価データの取得に失敗しました:", error);
      } finally {
        setIsLoadingStocks(false);
      }
    };

    if (user) {
      fetchStocks();
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("ログインエラー:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
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
              <button 
                onClick={handleLogout} 
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors"
              >
                ログアウト
              </button>
            </div>
          </header>

          {/* メインダッシュボードエリア */}
          <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
            
            {/* 上段：主要指標（KPI）カード */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <span className="text-xs font-medium text-slate-500 mb-1">日経平均先物</span>
                <span className="text-xl font-bold text-slate-800">52,430.50</span>
                <span className="text-sm font-medium text-red-500 mt-1">+120.30 (+0.23%)</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <span className="text-xs font-medium text-slate-500 mb-1">TOPIX</span>
                <span className="text-xl font-bold text-slate-800">3,450.10</span>
                <span className="text-sm font-medium text-red-500 mt-1">+15.20 (+0.44%)</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <span className="text-xs font-medium text-slate-500 mb-1">米ドル/円</span>
                <span className="text-xl font-bold text-slate-800">148.25</span>
                <span className="text-sm font-medium text-green-500 mt-1">-0.15 (-0.10%)</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <span className="text-xs font-medium text-slate-500 mb-1">SOX指数</span>
                <span className="text-xl font-bold text-slate-800">5,820.40</span>
                <span className="text-sm font-medium text-red-500 mt-1">+85.60 (+1.49%)</span>
              </div>
            </div>

            {/* 中段：シナリオ分析とウォッチリスト */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 左側：AIシナリオ分析 */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                    本日のシナリオ分析
                  </h2>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">AI Generated</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex-1 bg-slate-50 rounded-lg border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
                    <svg className="w-10 h-10 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    <p className="text-sm text-center leading-relaxed">
                      ここにGeminiから取得した市況シナリオが表示されます。<br/>
                      マクロ環境や注目セクターの動向などが自動で要約される予定です。
                    </p>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button className="text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md transition-colors flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      Add Source
                    </button>
                  </div>
                </div>
              </div>

              {/* 右側：個別銘柄ウォッチリスト */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                    ウォッチリスト
                  </h2>
                </div>
                <div className="p-0 flex-1 overflow-auto">
                  <ul className="divide-y divide-slate-100">
                    {isLoadingStocks ? (
                      <li className="px-6 py-8 text-center text-slate-500 text-sm">株価データを取得中...</li>
                    ) : (
                      stocks.map((stock) => (
                        <li key={stock.ticker} className="px-6 py-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                          <div>
                            <span className="text-xs font-bold text-slate-500 block mb-0.5">{stock.ticker}</span>
                            <span className="text-sm font-bold text-slate-800">{stock.name}</span>
                          </div>
                          <div className="text-right">
                            {stock.price !== null ? (
                              <>
                                <span className="text-sm font-bold text-slate-800 block">{stock.price.toLocaleString()}</span>
                                <span className={`text-xs font-medium ${stock.change && stock.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                  {stock.change && stock.change > 0 ? '+' : ''}{stock.change} ({stock.changePercent && stock.changePercent > 0 ? '+' : ''}{stock.changePercent}%)
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-sm font-bold text-slate-800 block">---</span>
                                <span className="text-xs font-medium text-slate-400">{stock.note}</span>
                              </>
                            )}
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