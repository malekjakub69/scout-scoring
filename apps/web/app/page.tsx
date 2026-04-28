import Link from "next/link";
import { ArrowRight, QrCode, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-scout-yellow" />
            Scout Scoring
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Přihlásit</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container max-w-3xl py-20 sm:py-28">
        <p className="mb-6 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Bodování závodu — bez papíru
        </p>
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Skautský závod,
          <br />
          který <span className="scout-underline pb-0.5">prostě funguje</span>.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground">
          Organizátor spravuje závod v jedné obrazovce, rozhodčí se na stanovišti přihlásí QR kódem
          a zapisuje body do 10 sekund.<br /> Bez účtu. Bez školení. Bez papíru.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">
              Otevřít dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}