"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

type AdminNoteItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: "DRAFT" | "PUBLISHED" | "REJECTED";
  tags: string[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string;
};

function formatKoreanDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STATUS_STYLE: Record<AdminNoteItem["status"], string> = {
  DRAFT: "bg-amber-50 text-amber-700 border border-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border border-rose-200",
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [notes, setNotes] = useState<AdminNoteItem[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const loadAdminNotes = async () => {
    setIsListLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/battery-notes");
      const payload = (await response.json()) as { items?: AdminNoteItem[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "관리자 목록 조회 실패");
      }
      setNotes(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      setNotes([]);
      setMessage(error instanceof Error ? error.message : "목록 조회 오류");
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const payload = (await response.json()) as { user?: AuthUser | null };
        if (!cancelled) {
          setUser(payload.user ?? null);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      return;
    }
    void loadAdminNotes();
  }, [user?.role]);

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/battery-notes/generate", { method: "POST" });
      const payload = (await response.json()) as {
        created?: boolean;
        message?: string;
        detail?: string;
      };
      if (!response.ok || !payload.created) {
        throw new Error(
          payload.detail
            ? `${payload.message || "초안 생성 실패"} (${payload.detail})`
            : payload.message || "초안 생성 실패",
        );
      }
      setMessage("Gemini 초안을 생성했습니다.");
      await loadAdminNotes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초안 생성 중 오류");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReview = async (id: string, action: "publish" | "draft") => {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/battery-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "검수 변경 실패");
      }
      await loadAdminNotes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "검수 처리 오류");
    }
  };

  const handleDelete = async (id: string) => {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/battery-notes/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "삭제에 실패했습니다.");
      }
      setMessage("글을 삭제했습니다.");
      await loadAdminNotes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제 처리 오류");
    }
  };

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl text-sm text-slate-600">관리자 권한 확인 중...</div>
      </main>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6">
          <p className="text-base font-semibold">관리자 권한이 필요합니다.</p>
          <p className="mt-2 text-sm text-slate-600">
            내차관리 탭에서 관리자 계정으로 로그인한 뒤 다시 접근해주세요.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand">
            홈으로 이동
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-5xl space-y-4">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
                return;
              }
              router.push("/");
            }}
            className="mb-3 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            이전
          </button>
          <h1 className="text-xl font-bold">관리자 배터리노트 검수</h1>
          <p className="mt-2 text-sm text-slate-600">
            관리자 버튼으로 생성한 배터리 관련 초안을 확인하고 발행/삭제를 처리합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={isGenerating}
              className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {isGenerating ? "초안 생성 중..." : "Gemini 초안 1개 생성"}
            </button>
            <button
              type="button"
              onClick={() => void loadAdminNotes()}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              목록 새로고침
            </button>
          </div>
          {message && <p className="mt-3 text-xs text-slate-600">{message}</p>}
        </article>

        <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">글 생성/검수 목록</h2>
          {isListLoading && (
            <p className="mt-3 text-sm text-slate-500">목록을 불러오는 중입니다.</p>
          )}
          <div className="mt-4 space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-line bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[note.status]}`}
                  >
                    {note.status}
                  </span>
                  {note.tags.map((tag) => (
                    <span key={`${note.id}-${tag}`} className="text-[11px] font-semibold text-brand">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm font-bold text-slate-900">{note.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{note.excerpt}</p>
                <div className="mt-2 text-[11px] text-slate-500">
                  생성: {formatKoreanDate(note.createdAt)} | 검수: {formatKoreanDate(note.reviewedAt)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleReview(note.id, "publish")}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    발행
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(note.id)}
                    className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReview(note.id, "draft")}
                    className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
                  >
                    초안으로
                  </button>
                  {note.status === "PUBLISHED" ? (
                    <Link
                      href={`/battery-note/${note.slug}`}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
                    >
                      상세보기
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">
                      발행 후 확인
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!isListLoading && notes.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">아직 생성된 글이 없습니다.</p>
          )}
        </article>
      </section>
    </main>
  );
}
