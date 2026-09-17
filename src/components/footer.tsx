import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {MapPin} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {AccessibilityLauncher} from "@/components/a11y";
import {ADDRESS_LINE, BUSINESS_ACTIVITY, CONTACT_EMAIL, LEGAL_NAME, RUT} from "@/lib/company.ts";

/**
 * The foot of every page, and the one place on the site that identifies who operates it.
 *
 * The identity block is not decoration: the site is run by a company, and a visitor deciding
 * whether to hand it an email or a brief is entitled to know which one, under what activity and at
 * what address, without having to open the legal pages. It is rendered from `@/lib/company.ts`
 * rather than from a translation, because a razón social does not translate — it is the string
 * inscribed in the register, identical in both languages. Only the labels around it are
 * translated.
 */
const Footer = () => {
  const {t} = useTranslation();

  return (
    <footer className="border-t border-neutral-800 py-6 text-sm text-neutral-500">
      <div className="container mx-auto px-4 pb-6 mb-6 border-b border-neutral-800 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <Link to="/" aria-label="FranciscoSolis" data-fs-hover>
          <BrandLockup size={30} tone="auto"/>
        </Link>
        <AccessibilityLauncher/>
      </div>

      {/*
        * `address` rather than a div: this is the contact information of the page's owner, which is
        * exactly what the element is for, and a screen reader announces it as such. `not-italic`
        * because browsers italicise it by default and a legal name in italics reads as a citation.
        */}
      <address className="container mx-auto px-4 pb-6 mb-6 border-b border-neutral-800 not-italic flex flex-col gap-1 text-center text-xs sm:text-left">
        <span className="text-neutral-400">{LEGAL_NAME}</span>
        {RUT && <span>{t("common:company_rut", {rut: RUT})}</span>}
        <span>{BUSINESS_ACTIVITY}</span>
        <span>{ADDRESS_LINE}</span>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="hover:text-text transition-colors sm:self-start"
          data-fs-hover
        >
          {CONTACT_EMAIL}
        </a>
      </address>

      <div className="container mx-auto px-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <span className="inline-flex items-center gap-1">
          <MapPin size={14}/> {t("contact:location")}
        </span>
        <span className="flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
          <span>{t("common:footer_credit")}</span>
          <Link to="/brand" className="text-neutral-500 hover:text-text transition-colors" data-fs-hover>
            {t("common:brand_link")}
          </Link>
          <Link to="/legal" className="text-neutral-500 hover:text-text transition-colors" data-fs-hover>
            {t("common:legal_link")}
          </Link>
        </span>
        <span>{t("common:copyright", {year: new Date().getFullYear()})}</span>
      </div>
    </footer>
  );
};

export default Footer;
