"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UsersTab } from "@/components/organizer/users-tab";
import * as Auth from "@/lib/api/auth";
import { ApiError, tokens } from "@/lib/api/client";
import { useMe } from "@/lib/queries/auth";

export default function UsersPage() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    const present = !!tokens.get("organizer");
    setHasToken(present);
    if (!present) router.replace("/login");
  }, [router]);

  const {
    data: meData,
    error: meError,
    isLoading: meLoading,
  } = useMe(hasToken === true);

  useEffect(() => {
    if (!meError) return;
    if (meError instanceof ApiError && meError.status === 401) {
      Auth.logout();
      router.replace("/login");
      return;
    }
    toast.error("Nepodařilo se načíst účet.");
  }, [meError, router]);

  useEffect(() => {
    if (meData && !meData.is_admin) {
      router.replace("/dashboard");
    }
  }, [meData, router]);

  const booting = hasToken === null || (hasToken && (meLoading || !meData));

  if (booting || !meData?.is_admin) {
    return (
      <div className="grid min-h-screen place-items-center bg-scout-bg-app text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-scout-bg-app text-scout-text">
      <header className="flex h-13 shrink-0 items-center gap-3 bg-scout-blue px-7 text-white">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-8 border border-white/20 bg-white/10 px-3 py-1.75 text-12 font-medium text-white/80 transition hover:bg-white/15"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </button>
        <div className="h-5 w-px bg-white/20" />
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2.25 w-2.25 rounded-full bg-scout-yellow" />
          <span className="text-15 font-bold tracking-tightest">Scout Scoring</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            Auth.logout();
            router.replace("/login");
          }}
          className="hidden items-center gap-2 rounded-8 border border-white/20 bg-white/10 px-3 py-1.75 text-12 font-medium text-white/80 transition hover:bg-white/15 sm:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          Odhlásit
        </button>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-1.5 border-white/25 bg-white/15 text-12 font-bold">
          {(meData.name ?? meData.email ?? "OR").slice(0, 2).toUpperCase()}
        </div>
      </header>

      <main className="px-7 py-6">
        <div className="mx-auto mb-5 max-w-5xl">
          <h1 className="text-22 font-bold leading-none text-scout-text">Uživatelé</h1>
          <p className="mt-1.5 text-13 text-scout-text-muted">Správa organizátorů a systémových adminů.</p>
        </div>
        <UsersTab />
      </main>
    </div>
  );
}
