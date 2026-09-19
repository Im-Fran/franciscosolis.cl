import {useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {BrowserIcon, HardDrivesIcon, DeviceMobileIcon, StackIcon, TerminalIcon, CloudIcon, ShieldCheckIcon, RobotIcon} from "@phosphor-icons/react";
import {Card, CardTitle, CardBody} from "@/components/ui/card.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Carousel} from "@/components/ui/carousel.tsx";
import {SectionError, SectionSkeleton} from "@/pages/home/components/section-state.tsx";
import {useScrollReveal} from "@/pages/home/hooks/useScrollReveal.ts";
import {stringField, text, useCmsCollection, type CmsEntry} from "@/lib/cms/content.ts";
import {isToolboxCategory, TOOLBOX_CATEGORIES, type ToolboxCategory} from "@/lib/cms/landing.ts";

/**
 * The toolbox, built from the CMS's `skills` collection.
 *
 * The collection is flat — one entry per tool — and the two levels this section shows are read off
 * each entry: `data.category` is the toolbox card it belongs to, and `subtitle` is the optional
 * group inside it ("Google Cloud Platform"). A category whose entries carry no subtitle renders as
 * a plain list of chips; one whose entries do renders the group names on the card and the tools
 * behind them in the modal, which is how a cloud provider's services stay legible next to a dozen
 * frontend libraries.
 *
 * Category *labels* stay in the translation namespaces rather than coming from the API: they are
 * interface copy naming a section of this page, not content an editor publishes. What the API
 * decides is which categories exist and what is in them.
 */

type StackGroup = {name: string; tools: string[]};
type StackCategory = {key: ToolboxCategory; tools: string[]; groups: StackGroup[]};

const icons: Record<ToolboxCategory, typeof BrowserIcon> = {
  frontend: BrowserIcon,
  backend: HardDrivesIcon,
  mobile: DeviceMobileIcon,
  apis: StackIcon,
  sysadmin: TerminalIcon,
  cloud: CloudIcon,
  security: ShieldCheckIcon,
  ai: RobotIcon,
};

/**
 * Folds the flat listing into the categories and groups the cards render.
 *
 * Order is the API's — the listing arrives sorted by the `position` an editor set — so the first
 * appearance of a category fixes where its card sits, and the tools inside it keep the order they
 * were arranged in. A skill whose category this page has no icon or label for is dropped rather
 * than rendered as an unnamed card.
 */
const groupSkills = (skills: CmsEntry[]): StackCategory[] => {
  const categories = new Map<ToolboxCategory, StackCategory>();

  for (const skill of skills) {
    const key = stringField(skill.data, "category");
    if (!key || !isToolboxCategory(key)) continue;

    const category = categories.get(key) ?? {key, tools: [], groups: []};
    categories.set(key, category);

    const groupName = text(skill.subtitle);
    if (!groupName) {
      category.tools.push(skill.title);
      continue;
    }

    const group = category.groups.find((candidate) => candidate.name === groupName);
    if (group) group.tools.push(skill.title);
    else category.groups.push({name: groupName, tools: [skill.title]});
  }

  return [...categories.values()].sort(
    (a, b) => TOOLBOX_CATEGORIES.indexOf(a.key) - TOOLBOX_CATEGORIES.indexOf(b.key),
  );
};

export const Stack = () => {
  const {t} = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  useScrollReveal(sectionRef);
  const [activeCategory, setActiveCategory] = useState<ToolboxCategory | null>(null);

  const skills = useCmsCollection("skills", {limit: 200});
  /* Only to fill the modal's "related projects"; the section renders without waiting for it. */
  const projects = useCmsCollection("projects");

  const categories = useMemo(() => groupSkills(skills.data ?? []), [skills.data]);
  const activeGroups = categories.find((category) => category.key === activeCategory)?.groups ?? [];
  const relatedProjects = activeCategory
    ? (projects.data ?? []).filter((project) => project.featured && project.tags?.includes(activeCategory))
    : [];

  return (
    <section id="stack" ref={sectionRef} className="container mx-auto px-4 py-24">
      <p className="reveal text-[13px] uppercase tracking-[0.08em] text-accent-300 mb-3">
        {t("stack:kicker")}
      </p>
      <h2 className="reveal text-[clamp(30px,4vw,46px)] text-text mb-3">
        {t("stack:title")}
      </h2>
      <p className="reveal text-sm text-neutral-400 mb-10">
        {t("stack:subtitle")}
      </p>

      {skills.loading && <SectionSkeleton count={4} itemClassName="h-[280px]"/>}
      {!skills.loading && skills.error && <SectionError error={skills.error} onRetry={skills.reload}/>}

      {!skills.loading && !skills.error && (
        <div className="reveal-stagger">
          <Carousel slideClassName="w-[260px] sm:w-[300px]">
            {categories.map((category) => {
              const Icon = icons[category.key];
              /* Grouped categories show their group names; flat ones show the tools themselves. */
              const chips = category.groups.length > 0 ? category.groups.map((group) => group.name) : category.tools;

              return (
                <Card key={category.key} elevation="sm" className="reveal-item fs-hoverable w-full flex-1 flex flex-col">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(category.key)}
                    className="flex flex-1 flex-col w-full h-full text-left"
                  >
                    <CardBody className="flex flex-1 flex-col justify-between h-full">
                      <div>
                        <Icon size={28} className="text-accent-300 mb-4"/>
                        <CardTitle>{t(`stack:categoryLabels.${category.key}`)}</CardTitle>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {chips.map((chip) => <Badge key={chip} variant="outline">{chip}</Badge>)}
                        </div>
                      </div>
                    </CardBody>
                  </button>
                </Card>
              );
            })}
          </Carousel>
        </div>
      )}

      <Modal
        open={activeCategory !== null}
        onClose={() => setActiveCategory(null)}
        title={activeCategory ? t(`stack:categoryLabels.${activeCategory}`) : undefined}
      >
        {activeGroups.length > 0 && (
          <div className="mb-6 space-y-4">
            {activeGroups.map((group) => (
              <div key={group.name}>
                <p className="text-sm text-text">{group.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.tools.map((tool) => (
                    <Badge key={tool} variant="outline">{tool}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs uppercase tracking-[0.08em] text-neutral-500">{t("stack:modal_projects_label")}</p>
        {relatedProjects.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">{t("stack:modal_empty")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {relatedProjects.map((project) => {
              const summary = text(project.summary);
              const href = text(project.url);
              const content = (
                <>
                  <p className="text-text">{project.title}</p>
                  {summary && <p className="mt-1 text-sm text-neutral-400">{summary}</p>}
                </>
              );
              const className =
                "block rounded-[var(--radius-sm)] border border-neutral-800 p-4 transition-colors hover:border-accent-700";

              return href ? (
                <a key={project.id} href={href} target="_blank" rel="noreferrer" className={className}>
                  {content}
                </a>
              ) : (
                <div key={project.id} className={className}>{content}</div>
              );
            })}
          </div>
        )}
      </Modal>
    </section>
  );
};
