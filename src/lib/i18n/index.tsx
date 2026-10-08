import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar as arBase, en as enBase, type Dict as BaseDict } from "./dictionaries";
import { ar2, en2, type Dict2 } from "./dict-stage2";
import { ar3, en3, type Dict3 } from "./dict-stage3";

type Dict = BaseDict & Dict2 & Dict3;
const ar: Dict = { ...arBase, ...ar2, ...ar3, errors: { ...arBase.errors, ...ar2.errors2, ...ar3.errors3 } };
const en: Dict = { ...enBase, ...en2, ...en3, errors: { ...enBase.errors, ...en2.errors2, ...en3.errors3 } };

export type Lang = "ar" | "en";
const STORAGE_KEY = "wakeel.lang";

interface I18nCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: Dict;
  setLang: (l: Lang) => void;
  errorText: (code?: string | null) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function apply(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ar") setLangState(stored);
  }, []);

  useEffect(() => {
    apply(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  const value = useMemo<I18nCtx>(() => {
    const t = lang === "ar" ? ar : en;
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t,
      setLang,
      errorText: (code) => (code && t.errors[code]) || t.errors["UNEXPECTED"] || "",
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
