// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { auth, provider } from "../lib/firebase";
import { signInWithPopup, signOut, User } from "firebase/auth";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  // ログイン状態の監視
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">日本株投資サポート ダッシュボード</h1>

        {user ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {user.photoURL && <img src={user.photoURL} alt="アイコン" className="w-12 h-12 rounded-full" />}
                <div>
                  <p className="text-lg font-semibold">{user.displayName} さん</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">
                ログアウト
              </button>
            </div>
            
            <div className="border-t pt-6">
              <h2 className="text-xl font-bold mb-4">本日のレポート</h2>
              <p className="text-gray-600">※ここにAPIから取得した株価データと生成AIのシナリオ分析が表示されます。</p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 text-center rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">ログインが必要です</h2>
            <p className="text-gray-600 mb-8">ダッシュボードと投資レポートを利用するにはGoogleアカウントでログインしてください。</p>
            <button onClick={handleLogin} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition">
              Googleでログイン
            </button>
          </div>
        )}
      </div>
    </div>
  );
}