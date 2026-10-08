import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, GitBranch, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/logo-mark.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "وكيل — وكيل برمجة ذكي بمزوداتك أنت" },
      { name: "description", content: "اربط أي مزود ذكاء اصطناعي متوافق مع OpenAI، اكتشف النماذج تلقائيًا، ووجّه محادثاتك البرمجية للنموذج الأنسب." },
      { property: "og:title", content: "وكيل — وكيل برمجة ذكي بمزوداتك أنت" },
      { property: "og:description", content: "منصة وكيل برمجة عربية أولًا: مزودات مشفّرة، توجيه ذكي، ومحادثات متدفقة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" width={36} height={36} className="size-9 rounded-lg" />
          <span className="text-xl font-bold">{t.app.name}</span>
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">{t.landing.signIn}</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 pb-16">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground" dir="ltr">
          <span className="size-1.5 rounded-full bg-primary" /> /v1/chat/completions · stream
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">{t.landing.title}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">{t.landing.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link to="/auth">
              {t.landing.start} <Arrow className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-14 grid gap-3 md:grid-cols-3">
          {[
            { icon: Lock, text: t.landing.f1 },
            { icon: GitBranch, text: t.landing.f2 },
            { icon: Zap, text: t.landing.f3 },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="rounded-xl border border-border bg-card p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <p className="text-[15px] font-medium leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
