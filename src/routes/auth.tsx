import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/logo-mark.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — وكيل" },
      { name: "description", content: "سجّل الدخول إلى وكيل لإدارة مزودات الذكاء الاصطناعي ومحادثاتك البرمجية." },
      { property: "og:title", content: "تسجيل الدخول — وكيل" },
      { property: "og:description", content: "سجّل الدخول إلى منصة وكيل البرمجة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "pw" | "magic" | "google">(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/home", replace: true });
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) navigate({ to: "/home", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pw");
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(t.auth.invalid);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/home`, data: { display_name: name } },
        });
        if (error) toast.error(error.message);
        else if (!data.session) toast.success(t.auth.checkEmail);
      }
    } finally {
      setBusy(null);
    }
  }

  async function magic() {
    if (!email) return;
    setBusy("magic");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/home` },
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(t.auth.magicSent);
  }

  async function google() {
    setBusy("google");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(t.common.error);
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="" width={36} height={36} className="size-9 rounded-lg" />
            <span className="text-xl font-bold">{t.app.name}</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {lang === "ar" ? "English" : "العربية"}
          </Button>
        </div>

        <h1 className="mb-6 text-2xl font-bold">{mode === "in" ? t.auth.signInTitle : t.auth.signUpTitle}</h1>

        <Button variant="outline" className="h-12 w-full text-base" onClick={google} disabled={!!busy}>
          {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          {t.auth.google}
        </Button>

        <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          {t.auth.or}
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t.auth.displayName}</Label>
              <Input id="name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" type="email" dir="ltr" autoComplete="email" required className="h-12 text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              minLength={8}
              className="h-12 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "up" && <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>}
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={!!busy}>
            {busy === "pw" && <Loader2 className="size-4 animate-spin" />}
            {mode === "in" ? t.auth.signIn : t.auth.signUp}
          </Button>
        </form>

        {mode === "in" && (
          <Button variant="ghost" className="mt-2 h-11 w-full" onClick={magic} disabled={!!busy || !email}>
            {busy === "magic" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {t.auth.magicLink}
          </Button>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "in" ? t.auth.noAccount : t.auth.haveAccount}{" "}
          <button className="font-semibold text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? t.auth.signUpTitle : t.auth.signInTitle}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 3.72 14.56 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
    </svg>
  );
}
