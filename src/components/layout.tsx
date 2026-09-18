import {useTranslation} from "react-i18next";
import {Outlet, ScrollRestoration} from "react-router-dom";
import type {BaseProperties} from "@/main.tsx";
import Footer from "@/components/footer.tsx";
import {AccessibilityCenter} from "@/components/a11y";

const Layout = ({ className, ...rest }: LayoutProps) => {
  const {t} = useTranslation();

  return (
    <AccessibilityCenter>
      <div className={`min-h-screen flex flex-col ${className ?? ""}`} {...rest}>
        {/* First stop for a keyboard, ahead of the fixed header and everything in it. */}
        <a href="#content" className="fs-skip-link">{t("a11y:skip_to_content")}</a>
        {/* tabIndex -1 so the skip link actually moves focus here, not just the scroll position. */}
        <main id="content" tabIndex={-1} role={"main"} className={"flex-1 flex flex-col outline-none"}>
          <Outlet/>
        </main>
        <ScrollRestoration/>
        <Footer/>
      </div>
    </AccessibilityCenter>
  );
};

export default Layout
export type LayoutProps = BaseProperties
