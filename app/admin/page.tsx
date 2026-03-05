"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Overview = {
  totalEvents: number;
  pageViews: number;
  coupangClicks: number;
  ctaClicks: number;
  uniqueVisitors: number;
  overallCtr: number;
};

type DailyRow = {
  date: string;
  views: number;
  clicks: number;
  visitors: number;
};

type TopPage = {
  path: string;
  views: number;
};

type BrandCtr = {
  brand: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

type StatsData = {
  days: number;
  overview: Overview;
  daily: DailyRow[];
  topPages: TopPage[];
  brandCtr: BrandCtr[];
};

const TOKEN_KEY = "admin-token-v1";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/4 p-4">
      <p className="text-xs font-medium text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white/90">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/30">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);

  // Hydrate token from URL param or localStorage
  useEffect(() => {
    const urlToken = searchParams.get("token") ?? "";
    const savedToken = localStorage.getItem(TOKEN_KEY) ?? "";
    const resolved = urlToken || savedToken;
    if (resolved) {
      setToken(resolved);
      if (urlToken) {
        localStorage.setItem(TOKEN_KEY, urlToken);
      }
    }
  }, [searchParams]);

  // Fetch stats when token changes
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/stats?days=${days}&token=${encodeURIComponent(token)}`);
        if (res.status === 401) {
          setIsAuthed(false);
          setError("토큰이 올바르지 않습니다.");
          localStorage.removeItem(TOKEN_KEY);
          return;
        }
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = (await res.json()) as StatsData;
        if (!cancelled) {
          setStats(data);
          setIsAuthed(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "통계 조회 실패");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [token, days]);

  const handleLogin = () => {
    const trimmed = tokenInput.trim();
    if (trimmed) {
      localStorage.setItem(TOKEN_KEY, trimmed);
      setToken(trimmed);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setIsAuthed(false);
    setStats(null);
  };

  // Login screen
  if (!isAuthed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0e17] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/4 p-6 backdrop-blur-xl">
          <h1 className="text-lg font-bold text-white/90">Admin</h1>
          <p className="mt-1 text-xs text-white/40">관리자 토큰을 입력하세요.</p>
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="ADMIN_TOKEN"
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-brand/50"
          />
          <button
            type="button"
            onClick={handleLogin}
            className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  const overview = stats?.overview;

  return (
    <div className="min-h-dvh bg-[#0a0e17] px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white/90">Dashboard</h1>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-8 text-xs text-white/70 outline-none"
            >
              <option value={7} className="bg-[#0f1420]">7일</option>
              <option value={14} className="bg-[#0f1420]">14일</option>
              <option value={30} className="bg-[#0f1420]">30일</option>
              <option value={90} className="bg-[#0f1420]">90일</option>
            </select>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 transition hover:text-white/70"
            >
              로그아웃
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
            <span className="ml-3 text-sm text-white/40">통계 로딩 중...</span>
          </div>
        )}

        {!isLoading && overview && (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="페이지뷰" value={overview.pageViews} />
              <StatCard label="방문자 (세션)" value={overview.uniqueVisitors} />
              <StatCard label="쿠팡 클릭" value={overview.coupangClicks} />
              <StatCard label="CTA 클릭" value={overview.ctaClicks} />
              <StatCard label="전체 CTR" value={`${overview.overallCtr}%`} sub="쿠팡클릭/페이지뷰" />
            </div>

            {/* Daily breakdown */}
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
              <h2 className="text-sm font-bold text-white/80">일별 추이</h2>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="pb-2 font-medium">날짜</th>
                      <th className="pb-2 text-right font-medium">뷰</th>
                      <th className="pb-2 text-right font-medium">방문자</th>
                      <th className="pb-2 text-right font-medium">클릭</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.daily ?? []).map((row) => (
                      <tr key={row.date} className="border-b border-white/5 text-white/70">
                        <td className="py-2">{row.date}</td>
                        <td className="py-2 text-right">{row.views.toLocaleString()}</td>
                        <td className="py-2 text-right">{row.visitors.toLocaleString()}</td>
                        <td className="py-2 text-right">{row.clicks.toLocaleString()}</td>
                        <td className="py-2 text-right text-brand">
                          {row.views > 0 ? ((row.clicks / row.views) * 100).toFixed(1) : "0"}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(stats?.daily ?? []).length === 0 && (
                  <p className="py-4 text-center text-white/30">데이터 없음</p>
                )}
              </div>
            </div>

            {/* Top pages + Brand CTR */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <h2 className="text-sm font-bold text-white/80">인기 페이지</h2>
                <div className="mt-3 space-y-1.5">
                  {(stats?.topPages ?? []).map((page, i) => (
                    <div key={page.path} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-[10px] font-bold text-white/25">{i + 1}</span>
                        <span className="truncate text-xs text-white/70">{page.path}</span>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-white/50">{page.views.toLocaleString()}</span>
                    </div>
                  ))}
                  {(stats?.topPages ?? []).length === 0 && (
                    <p className="py-3 text-center text-xs text-white/30">데이터 없음</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <h2 className="text-sm font-bold text-white/80">브랜드별 CTR</h2>
                <div className="mt-3 space-y-1.5">
                  {(stats?.brandCtr ?? []).map((row) => (
                    <div key={row.brand} className="rounded-lg border border-white/5 bg-white/3 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white/80">{row.brand}</span>
                        <span className="text-xs font-bold text-brand">{row.ctr}%</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/30">
                        조회 {row.impressions.toLocaleString()} / 클릭 {row.clicks.toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {(stats?.brandCtr ?? []).length === 0 && (
                    <p className="py-3 text-center text-xs text-white/30">데이터 없음</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
