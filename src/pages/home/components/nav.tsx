import {useTranslation} from "react-i18next";
import {Button} from "@/components/ui/button/button.tsx";
import {BrandLockup} from "@/components/brand";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";

const links: Array<{ href: string; labelKey: string }> = [
  {href: "#home", labelKey: "nav:home"},
  {href: "#stack", labelKey: "nav:stack"},
  {href: "#projects", labelKey: "nav:projects"},
  {href: "#experience", labelKey: "nav:experience"},
  {href: "#contact", labelKey: "nav:contact"},
];

export const Nav = () => {
  const {t} = useTranslation();
  const {language, toggleLanguage} = useLanguageToggle();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-800 bg-bg/78 backdrop-blur-[14px]">
      <nav className="container mx-auto flex items-center justify-between px-4 py-4">
        {/* The header's own px-4/py-4 already exceeds the brand's clear space at this mark size. */}
        <a href="#home" className="inline-flex items-center">
          <BrandLockup size={26} tone="auto"/>
        </a>
        <div className="flex items-center gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden text-sm text-neutral-300 hover:text-text transition-colors sm:inline"
            >
              {t(link.labelKey)}
            </a>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            aria-label={t("common:toggle_lang", {lang: language === "es" ? "EN" : "ES"})}
          >
            {language === "es" ? "EN" : "ES"}
          </Button>
        </div>
      </nav>
    </header>
  );
};
