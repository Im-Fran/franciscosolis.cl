import {useLayoutEffect, useRef} from "react";
import {useTranslation} from "react-i18next";
import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {GithubLogoIcon, MouseIcon} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {useA11y} from "@/lib/a11y";

gsap.registerPlugin(ScrollTrigger);

export const Hero = () => {
  const {t} = useTranslation();
  const {motion} = useA11y();
  const sectionRef = useRef<HTMLElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    /* Both tweens start from a hidden or offset state, so the opt-out has to be before the setup. */
    if (motion === "reduced") return;

    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray<HTMLElement>("[data-fs-hero-line]");
      gsap.set(lines, {opacity: 0, y: 40});
      gsap.to(lines, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        delay: 0.15,
      });

      if (circleRef.current && sectionRef.current) {
        gsap.to(circleRef.current, {
          y: 120,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [motion]);

  return (
    <section id="home" ref={sectionRef} className="relative min-h-screen w-full overflow-hidden flex flex-col justify-end">
      <div
        ref={circleRef}
        className="pointer-events-none absolute -top-24 -right-24 size-120 rounded-full blur-3xl"
        style={{background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 70%)"}}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-4 h-2/3 w-px"
        style={{background: "linear-gradient(to bottom, transparent, var(--color-neutral-700), transparent)"}}
      />

      <div className="container mx-auto px-4 pb-24 pt-32 relative z-10">
        <img
          src="/profile-picture.webp"
          alt={t("hero:name")}
          className="pointer-events-none absolute right-4 -top-16 h-24 w-24 rounded-full border border-neutral-700 object-cover shadow-lg sm:h-32 sm:w-32 md:h-40 md:w-40 lg:h-48 lg:w-48 xl:h-56 xl:w-56"
        />
        <p data-fs-hero-line className="text-[13px] uppercase tracking-[0.08em] text-accent-300 mb-4">
          {t("hero:kicker")}
        </p>
        <h1 data-fs-hero-line className="text-[clamp(48px,9vw,120px)] leading-[0.98] text-text">
          {t("hero:name")}
        </h1>
        <h2 data-fs-hero-line className="mt-4 text-[clamp(20px,3vw,32px)] text-neutral-300">
          {t("hero:role")}
        </h2>
        <p data-fs-hero-line className="mt-6 max-w-xl text-[16px] leading-[1.6] text-neutral-300">
          {t("hero:bio")}
        </p>
        <div data-fs-hero-line className="mt-8 flex flex-wrap gap-4">
          <Button asChild variant="primary">
            <a href="#contact">{t("hero:cta_work")}</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="https://github.com/Im-Fran" target="_blank" rel="noreferrer">
              <GithubLogoIcon size={18}/>
              {t("hero:cta_github")}
            </a>
          </Button>
        </div>
      </div>

      <div className="absolute bottom-8 left-4 flex items-center gap-2 text-neutral-500 animate-[fs-float_3s_ease-in-out_infinite]">
        <MouseIcon size={18} />
        <span className="text-xs uppercase tracking-[0.08em]">{t("hero:scroll")}</span>
      </div>
    </section>
  );
};
