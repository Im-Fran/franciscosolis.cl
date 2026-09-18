import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Bug} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";

export const NotFound = () => {
  const {t} = useTranslation();

  return (
    <section className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center text-center">
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-[480px] w-[480px] rounded-full blur-3xl"
        style={{background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 70%)"}}
      />

      <div className="container relative z-10 mx-auto px-4 py-24 flex flex-col items-center">
        <p className="text-[13px] uppercase tracking-[0.08em] text-accent-300 mb-4 inline-flex items-center gap-2">
          <Bug size={16}/> {t("not_found:code")}
        </p>
        <h1 className="text-[clamp(48px,9vw,120px)] leading-[0.98] text-text">
          {t("not_found:code")}
        </h1>
        <h2 className="mt-4 text-[clamp(20px,3vw,32px)] text-neutral-300">
          {t("not_found:title")}
        </h2>
        <p className="mt-6 max-w-xl text-[16px] leading-[1.6] text-neutral-300">
          {t("not_found:body")}
        </p>
        <pre className="mt-8 max-w-xl w-full overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-4 text-left text-xs leading-relaxed text-neutral-400">
          {t("not_found:stack_trace")}
        </pre>
        <Button asChild variant="primary" className="mt-8">
          <Link to="/">{t("not_found:cta")}</Link>
        </Button>
      </div>
    </section>
  );
};
