import {useRef} from "react";
import {useTranslation} from "react-i18next";
import {GithubLogo, LinkedinLogo, XLogo, InstagramLogo, ThreadsLogo} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {useScrollReveal} from "@/pages/home/hooks/useScrollReveal.ts";
import {ADDRESS_LINE, BUSINESS_ACTIVITY, CONTACT_EMAIL, LEGAL_NAME} from "@/lib/company.ts";

const socials = [
  {label: "GitHub", href: "https://github.com/Im-Fran", Icon: GithubLogo},
  {label: "LinkedIn", href: "https://linkedin.com/in/fsolism", Icon: LinkedinLogo},
  {label: "X", href: "https://x.com/Im_Fran_", Icon: XLogo},
  {label: "Instagram", href: "https://instagram.com/fran.dev_", Icon: InstagramLogo},
  {label: "Threads", href: "https://threads.net/@fran.dev_", Icon: ThreadsLogo},
];

/**
 * Where a visitor decides to write, so it is also where they find out who they would be writing to.
 *
 * The rest of the page is a portfolio and speaks in the first person; this block is the one place
 * in it that names the company behind the work. It is read from `@/lib/company.ts` for the same
 * reason the footer is — one address, everywhere.
 */
export const Contact = () => {
  const {t} = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef);

  return (
    <section id="contact" ref={sectionRef} className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 70%)"}}
      />

      <div className="container relative z-10 mx-auto px-4 pt-24 pb-24 flex flex-col items-center text-center sm:items-start sm:text-left">
        <p className="reveal text-[13px] uppercase tracking-[0.08em] text-accent-300 mb-3">
          {t("contact:kicker")}
        </p>
        <h2 className="reveal text-[clamp(32px,5.5vw,64px)] text-text mb-8 max-w-3xl">
          {t("contact:title")}
        </h2>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="reveal inline-block border-b border-accent-500 text-2xl sm:text-3xl text-text pb-1 mb-10"
        >
          {CONTACT_EMAIL}
        </a>

        <p className="reveal mb-10 max-w-xl text-sm text-neutral-500">
          <span className="block text-neutral-400">{LEGAL_NAME}</span>
          <span className="block">{BUSINESS_ACTIVITY}</span>
          <span className="block">{ADDRESS_LINE}</span>
        </p>

        <div className="reveal flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          {socials.map(({label, href, Icon}) => (
            <Button key={label} asChild variant="ghost">
              <a href={href} target="_blank" rel="noreferrer">
                <Icon size={18}/>
                {label}
              </a>
            </Button>
          ))}
          <Button variant="ghost" disabled className="opacity-50 gap-2">
            {t("contact:download_cv")}
            <Badge variant="neutral" size="sm">{t("contact:coming_soon")}</Badge>
          </Button>
        </div>
      </div>
    </section>
  );
};
