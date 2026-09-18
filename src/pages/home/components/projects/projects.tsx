import {useMemo, useRef} from "react";
import {useTranslation} from "react-i18next";
import {ArrowUpRight, Code} from "@phosphor-icons/react";
import {ProjectCard} from "@/pages/home/components/projects/project-card.tsx";
import {SectionError, SectionSkeleton} from "@/pages/home/components/section-state.tsx";
import {Carousel} from "@/components/ui/carousel.tsx";
import {Card, CardBody, CardTitle} from "@/components/ui/card.tsx";
import {useScrollReveal} from "@/pages/home/hooks/useScrollReveal.ts";
import {text, useCmsCollection} from "@/lib/cms/content.ts";

/**
 * The portfolio, read from the CMS's `projects` collection.
 *
 * One request rather than two: the split between the carousel and the grid below it is the entry's
 * own `featured` flag, and filtering it here costs nothing next to a second round trip. The order
 * inside each half is the order an editor arranged in the CMS — `position` is what the API sorts
 * by — so rearranging the page is a drag in `/cms`, not a deploy.
 */
export const Projects = () => {
  const {t} = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef);

  const {data, loading, error, reload} = useCmsCollection("projects");

  const {featured, secondary} = useMemo(() => ({
    featured: data?.filter((entry) => entry.featured) ?? [],
    secondary: data?.filter((entry) => !entry.featured) ?? [],
  }), [data]);

  return (
    <section id="projects" ref={sectionRef} className="container mx-auto px-4 py-24">
      <p className="reveal text-[13px] uppercase tracking-[0.08em] text-accent-300 mb-3">
        {t("projects:kicker")}
      </p>
      <h2 className="reveal text-[clamp(30px,4vw,46px)] text-text mb-3">
        {t("projects:title")}
      </h2>
      <p className="reveal text-sm text-neutral-400 mb-10">
        {t("projects:subtitle")}
      </p>

      {loading && <SectionSkeleton count={3} itemClassName="h-[420px]"/>}
      {!loading && error && <SectionError error={error} onRetry={reload}/>}

      {!loading && !error && (
        <>
          {featured.length > 0 && (
            <div className="reveal-stagger">
              <Carousel slideClassName="w-[85%] sm:w-[420px]">
                {featured.map((entry) => <ProjectCard key={entry.id} entry={entry}/>)}
              </Carousel>
            </div>
          )}

          <div className="reveal-stagger mt-8 grid gap-6" style={{gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))"}}>
            {secondary.map((entry) => {
              const summary = text(entry.summary);
              const href = text(entry.url);
              const body = (
                <Card elevation="sm" className="reveal-item fs-hoverable w-full h-full flex flex-col">
                  <CardBody className="flex flex-1 flex-col justify-between">
                    <div>
                      <Code size={22} className="text-accent-300 mb-3"/>
                      <CardTitle className="text-base">{entry.title}</CardTitle>
                      {summary && <p className="mt-2 text-sm text-neutral-400">{summary}</p>}
                    </div>
                    {href && (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs text-accent-300">
                        {t("projects:open_in_github")} <ArrowUpRight size={12}/>
                      </span>
                    )}
                  </CardBody>
                </Card>
              );

              /* An entry with no link is still worth showing — it just is not a link. */
              return href ? (
                <a key={entry.id} href={href} target="_blank" rel="noreferrer" className="flex flex-col h-full">
                  {body}
                </a>
              ) : (
                <div key={entry.id} className="flex flex-col h-full">{body}</div>
              );
            })}

            <a href="https://github.com/Im-Fran" target="_blank" rel="noreferrer" className="flex flex-col h-full">
              <Card elevation="sm" className="reveal-item fs-hoverable w-full h-full border border-accent-700">
                <CardBody className="flex h-full flex-col items-center justify-center text-center">
                  <span className="text-sm text-accent-300 inline-flex items-center gap-1">
                    {t("projects:view_all")} <ArrowUpRight size={14}/>
                  </span>
                </CardBody>
              </Card>
            </a>
          </div>
        </>
      )}
    </section>
  );
};
