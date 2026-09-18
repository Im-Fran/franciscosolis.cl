import {useState} from "react";
import {ArrowUpRight} from "@phosphor-icons/react";
import {useTranslation} from "react-i18next";
import {Card, CardTitle} from "@/components/ui/card.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {stringList, text, type CmsEntry} from "@/lib/cms/content.ts";
import {toolboxOf} from "@/lib/cms/landing.ts";

/**
 * A featured project, as the CMS publishes it.
 *
 * The mapping from an entry to this card is the whole of what the site knows about a project:
 * `subtitle` is the kind of thing it is ("Mobile App"), `summary` the line on the card, `body` the
 * paragraph in the modal, `data.technologies` the chips, and the toolbox categories among its
 * `tags` the badges linking it back to the stack. Every one of them is optional — an editor may
 * publish a project with nothing but a title — so each is dropped rather than rendered empty.
 */
export const ProjectCard = ({entry}: {entry: CmsEntry}) => {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);

  const category = text(entry.subtitle);
  const summary = text(entry.summary);
  const body = text(entry.body) ?? summary;
  const technologies = stringList(entry.data, "technologies");
  const toolbox = toolboxOf(entry);
  const href = text(entry.url);
  const media = text(entry.image_url);

  const cover = (
    <div className="h-[260px] w-full shrink-0 bg-neutral-900 flex items-center justify-center text-neutral-500 text-sm">
      {media ? <img src={media} alt={entry.title} className="h-full w-full object-cover"/> : "GIF"}
    </div>
  );

  return (
    <>
      <Card elevation="md" className="reveal-item fs-hoverable w-full flex-1 flex flex-col overflow-hidden p-0">
        <button type="button" onClick={() => setOpen(true)} className="flex flex-1 flex-col w-full h-full text-left">
          {cover}
          <div className="flex flex-1 flex-col justify-between p-6">
            <div>
              {category && <Badge variant="accent" className="mb-3">{category}</Badge>}
              <CardTitle>{entry.title}</CardTitle>
              {summary && <p className="mt-2 text-sm text-neutral-300 leading-[1.55]">{summary}</p>}
              {technologies.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {technologies.map((tech) => <Badge key={tech} variant="outline">{tech}</Badge>)}
                </div>
              )}
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-accent-300">
              {t("projects:view_project")} <ArrowUpRight size={14}/>
            </span>
          </div>
        </button>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={entry.title}>
        <div className="h-[200px] w-full overflow-hidden rounded-[var(--radius-sm)] bg-neutral-900 flex items-center justify-center text-neutral-500 text-sm">
          {media ? <img src={media} alt={entry.title} className="h-full w-full object-cover"/> : "GIF"}
        </div>
        {category && <Badge variant="accent" className="mt-4">{category}</Badge>}
        {body && <p className="mt-3 text-sm leading-[1.6] text-neutral-300">{body}</p>}

        {technologies.length > 0 && (
          <>
            <p className="mt-4 text-xs uppercase tracking-[0.08em] text-neutral-500">{t("projects:skills_label")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {technologies.map((tech) => <Badge key={tech} variant="outline">{tech}</Badge>)}
            </div>
          </>
        )}

        {toolbox.length > 0 && (
          <>
            <p className="mt-4 text-xs uppercase tracking-[0.08em] text-neutral-500">{t("projects:toolbox_label")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {toolbox.map((key) => <Badge key={key} variant="neutral">{t(`stack:categoryLabels.${key}`)}</Badge>)}
            </div>
          </>
        )}

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1 text-sm text-accent-300"
          >
            {t("projects:view_project")} <ArrowUpRight size={14}/>
          </a>
        )}
      </Modal>
    </>
  );
};
