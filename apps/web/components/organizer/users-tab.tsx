"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Plus, RefreshCw, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateUser, useUsers } from "@/lib/queries/auth";

const userSchema = z.object({
  email: z.string().trim().email("Zadej platný email."),
  name: z.string().trim().min(1, "Jméno je povinné."),
  password: z.string(),
  is_admin: z.boolean(),
});

type UserForm = z.infer<typeof userSchema>;

export function UsersTab() {
  const { data: usersData, isLoading } = useUsers();
  const createUser = useCreateUser();
  const [createdPassword, setCreatedPassword] = React.useState<string | null>(null);

  const {
    formState,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      is_admin: false,
    },
  });

  const isAdmin = watch("is_admin");
  const users = usersData ?? [];

  async function onSubmit(values: UserForm) {
    try {
      const res = await createUser.mutateAsync({
        email: values.email.trim(),
        name: values.name.trim(),
        password: values.password.trim() || undefined,
        is_admin: values.is_admin,
      });
      setCreatedPassword(res.password);
      reset({ email: "", name: "", password: "", is_admin: false });
      toast.success("Uživatel vytvořen.");
    } catch {
      toast.error("Uživatele se nepodařilo vytvořit.");
    }
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const password = Array.from(crypto.getRandomValues(new Uint32Array(14)))
      .map((n) => chars[n % chars.length])
      .join("");
    setValue("password", password, { shouldDirty: true });
  }

  async function copyPassword() {
    if (!createdPassword) return;
    await navigator.clipboard.writeText(createdPassword);
    toast.success("Heslo zkopírováno.");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[360px,minmax(0,1fr)]">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-12 border border-scout-border bg-white p-5">
        <div>
          <h2 className="text-16 font-bold text-scout-text">Nový uživatel</h2>
          <p className="text-12 text-scout-text-muted">Heslo se zobrazí po vytvoření, protože aplikace neposílá emaily.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input id="user-email" type="email" {...register("email")} />
          <FieldError message={formState.errors.email?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-name">Jméno</Label>
          <Input id="user-name" {...register("name")} />
          <FieldError message={formState.errors.name?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-password">Heslo</Label>
          <div className="flex gap-2">
            <Input id="user-password" {...register("password")} placeholder="Vygeneruje se automaticky" />
            <Button type="button" variant="outline" size="icon" onClick={generatePassword} aria-label="Vygenerovat heslo">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <label className="flex items-center justify-between rounded-8 border border-scout-border px-3 py-2.5">
          <span className="text-13 font-medium text-scout-text">Admin</span>
          <Switch checked={isAdmin} onCheckedChange={(checked) => setValue("is_admin", checked, { shouldDirty: true })} />
        </label>

        <Button type="submit" disabled={createUser.isPending}>
          <Plus className="h-4 w-4" /> Vytvořit
        </Button>

        {createdPassword ? (
          <div className="rounded-8 border border-scout-border bg-scout-bg-subtle p-3">
            <div className="mb-1 text-12 font-semibold text-scout-text">Heslo nového uživatele</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded bg-white px-2 py-1 font-mono text-13 text-scout-text">{createdPassword}</code>
              <Button type="button" variant="outline" size="icon" onClick={copyPassword} aria-label="Kopírovat heslo">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </form>

      <section className="rounded-12 border border-scout-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-16 font-bold text-scout-text">Organizátoři</h2>
            <p className="text-12 text-scout-text-muted">{users.length} účtů v systému.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-13 text-scout-text-muted">Načítám...</div>
        ) : (
          <div className="divide-y divide-scout-border">
            {users.map((u) => (
              <Link
                key={u.id}
                href={`/users/${encodeURIComponent(u.id)}`}
                className="flex items-center justify-between gap-3 py-3 transition hover:bg-scout-bg-subtle"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-scout-bg-subtle text-scout-blue">
                    {u.is_admin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-13 font-semibold text-scout-text">{u.name || "Bez jména"}</div>
                    <div className="truncate text-12 text-scout-text-muted">{u.email}</div>
                  </div>
                </div>
                {u.is_admin ? <Badge variant="default">Admin</Badge> : <Badge variant="secondary">Organizátor</Badge>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}
