"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/lib/queries/auth";
import { ApiError } from "@/lib/api/client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState("admin@scout.test");
  const [password, setPassword] = useState("Password123456!");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email: email.trim(), password });
      router.push("/dashboard");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 401
          ? "Nesprávný e-mail nebo heslo."
          : "Přihlášení se nezdařilo. Zkontroluj připojení.";
      toast.error(msg);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> zpět
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Přihlášení organizátora</h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@oddil.cz"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Přihlásit se
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Registrace je pouze na pozvánku
          </p>
        </form>
      </div>
    </main>
  );
}
