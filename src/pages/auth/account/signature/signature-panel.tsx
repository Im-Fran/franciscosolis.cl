import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Navigate} from "react-router-dom";
import {ArrowCounterClockwise, Copy, Code, Plus, Trash} from "@phosphor-icons/react";
import DOMPurify from "dompurify";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {SortableList} from "@/components/admin/sortable-list.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {accountRoute} from "@/lib/auth/config.ts";
import {Panel} from "@/pages/auth/components/panel.tsx";
import {
  COMPANY,
  buildSignature,
  faviconFor,
  isCompanyEmail,
  labelFor,
  safeUrl,
} from "@/pages/auth/account/signature/build-signature.ts";
import type {SignatureData, SocialLink} from "@/pages/auth/account/signature/build-signature.ts";
import type {User} from "@/lib/auth/types.ts";

/* Versioned, so a later change to the stored shape can be ignored rather than mis-read. */
const STORAGE_KEY = "fs.auth.signature.v2";
/** The shape before the links were split in two; its drafts are read once and then rewritten as v2. */
const STORAGE_KEY_V1 = "fs.auth.signature.v1";

/** The list a row belongs to. Every edit names one, so the two lists share all of their handling. */
type ListKey = "personSocials" | "companySocials";

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `s${Date.now()}${Math.random().toString(16).slice(2)}`;

const toLinks = (urls: readonly string[]): SocialLink[] => urls.map((url) => ({id: newId(), url}));

const fromProfile = (user: User): SignatureData => ({
  name: user.name ?? "",
  email: user.email,
  picture: user.picture ?? "",
  personSocials: [],
  /* The company's own profiles are the same everywhere, so the second list starts filled in. */
  companySocials: toLinks(COMPANY.socials),
});

const readLinks = (value: unknown): SocialLink[] =>
  Array.isArray(value)
    ? value
        .filter((social): social is SocialLink => !!social && typeof (social as SocialLink).url === "string")
        .map((social) => ({id: social.id || newId(), url: social.url}))
    : [];

/**
 * What was stored, or nothing.
 *
 * The draft is read defensively because `localStorage` is shared with every other tab and version
 * of this site: anything that is not a shape written here is treated as absent rather than trusted,
 * and a private-mode browser that throws on read simply starts from the profile. A v1 draft — one
 * list of links, written before they were split — is read as the person's own, which is what every
 * link in it was.
 */
const readDraft = (): SignatureData | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const draft = parsed as Partial<SignatureData> & {socials?: unknown};
    if (typeof draft.email !== "string") return null;

    const companySocials = readLinks(draft.companySocials);
    return {
      name: typeof draft.name === "string" ? draft.name : "",
      email: draft.email,
      picture: typeof draft.picture === "string" ? draft.picture : "",
      personSocials: readLinks(draft.personSocials ?? draft.socials),
      /* A v1 draft has no company list at all, so it gets the canonical one rather than none. */
      companySocials: "companySocials" in draft ? companySocials : toLinks(COMPANY.socials),
    };
  } catch {
    return null;
  }
};

/**
 * Builds the corporate signature, for accounts on the company domain.
 *
 * Nothing here is written to the API: the signature is not account state, it is a block of HTML the
 * person pastes into their mail client once. The draft is kept in this browser so that coming back
 * to the screen does not mean typing every social link again, and the profile stays the default it
 * is restored from.
 */
export const SignaturePanel = ({user}: {user: User}) => {
  const {t} = useTranslation();
  const {notify} = useToast();

  /* The stored draft belongs to whoever wrote it — another account's draft is not this one's. */
  const [data, setData] = useState<SignatureData>(() => {
    const draft = readDraft();
    return draft && draft.email.toLowerCase() === user.email.toLowerCase() ? draft : fromProfile(user);
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* A full or blocked store costs the draft, not the signature on screen. */
    }
  }, [data]);

  const html = useMemo(() => buildSignature(data), [data]);
  const preview = useMemo(() => DOMPurify.sanitize(html, {ADD_ATTR: ["target", "role"]}), [html]);

  const set = (key: "name" | "email" | "picture") => (event: {target: {value: string}}) =>
    setData((current) => ({...current, [key]: event.target.value}));

  const setList = (list: ListKey, socials: SocialLink[]) =>
    setData((current) => ({...current, [list]: socials}));

  /*
   * Copied as `text/html` *and* as plain text: the rich flavour is what Gmail and Outlook paste as
   * a formatted signature, and the plain one is what a settings box expecting source code reads.
   * Clients without `ClipboardItem` — and a denied rich write — fall back to the source, which is
   * still usable in every "paste HTML" field.
   */
  const copy = async (asSource: boolean) => {
    try {
      if (asSource || typeof ClipboardItem === "undefined") {
        await navigator.clipboard.writeText(html);
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], {type: "text/html"}),
            "text/plain": new Blob([html], {type: "text/plain"}),
          }),
        ]);
      }
      notify(t("auth:account.signature.copied"));
    } catch {
      notify(t("auth:account.signature.copy_failed"), "info");
    }
  };

  const unusable = [...data.personSocials, ...data.companySocials].some(
    (social) => social.url.trim() && !safeUrl(social.url),
  );

  return (
    <Panel
      title={t("auth:account.signature.title")}
      description={t("auth:account.signature.description")}
      action={
        <Button variant="ghost" size="sm" onClick={() => setData(fromProfile(user))} data-fs-hover>
          <ArrowCounterClockwise size={14}/> {t("auth:account.signature.reset")}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth:account.signature.name_label")} htmlFor="signature-name">
            <Input id="signature-name" value={data.name} onChange={set("name")} maxLength={120} autoComplete="name"/>
          </Field>
          <Field label={t("auth:account.signature.email_label")} htmlFor="signature-email">
            <Input
              id="signature-email"
              type="email"
              value={data.email}
              onChange={set("email")}
              maxLength={160}
              autoComplete="email"
            />
          </Field>
        </div>

        <Field
          label={t("auth:account.signature.picture_label")}
          htmlFor="signature-picture"
          hint={t("auth:account.signature.picture_hint")}
        >
          <Input
            id="signature-picture"
            type="url"
            inputMode="url"
            value={data.picture}
            onChange={set("picture")}
            placeholder="https://"
          />
        </Field>

        {/* One list per half of the signature, in the order the signature itself renders them. */}
        <SocialFieldset
          title={t("auth:account.signature.person_socials_title")}
          hint={t("auth:account.signature.person_socials_hint")}
          emptyLabel={t("auth:account.signature.person_socials_empty")}
          placeholder="https://linkedin.com/in/…"
          socials={data.personSocials}
          onChange={(socials) => setList("personSocials", socials)}
        />

        <SocialFieldset
          title={t("auth:account.signature.company_socials_title")}
          hint={t("auth:account.signature.company_socials_hint")}
          emptyLabel={t("auth:account.signature.company_socials_empty")}
          placeholder="https://linkedin.com/company/…"
          socials={data.companySocials}
          onChange={(socials) => setList("companySocials", socials)}
        />

        {unusable && <Alert tone="info">{t("auth:account.signature.invalid_social")}</Alert>}

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-neutral-300">{t("auth:account.signature.preview_title")}</h3>
          {/*
            * The preview sits on white because that is the surface a signature is read on: previewing
            * ink-on-ink against the console's own dark panel would hide exactly the contrast problem
            * a preview exists to catch.
            */}
          <div className="overflow-x-auto rounded-[var(--radius-md)] bg-white p-6">
            <div dangerouslySetInnerHTML={{__html: preview}}/>
          </div>
          <p className="text-xs text-neutral-500">{t("auth:account.signature.preview_hint", {company: COMPANY.name})}</p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void copy(false)} data-fs-hover>
            <Copy size={16}/> {t("auth:account.signature.copy")}
          </Button>
          <Button variant="secondary" onClick={() => void copy(true)} data-fs-hover>
            <Code size={16}/> {t("auth:account.signature.copy_html")}
          </Button>
        </div>
      </div>
    </Panel>
  );
};

type SocialFieldsetProps = {
  title: string;
  hint: string;
  emptyLabel: string;
  placeholder: string;
  socials: SocialLink[];
  onChange: (socials: SocialLink[]) => void;
};

/** One list of links: add, edit, reorder, remove. Both halves of the signature are edited with it. */
const SocialFieldset = ({title, hint, emptyLabel, placeholder, socials, onChange}: SocialFieldsetProps) => {
  const {t} = useTranslation();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-neutral-300">{title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{hint}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...socials, {id: newId(), url: ""}])}
          data-fs-hover
        >
          <Plus size={14}/> {t("auth:account.signature.add_social")}
        </Button>
      </div>

      {socials.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <SortableList
          items={socials}
          itemKey={(social) => social.id}
          onReorder={onChange}
          label={title}
          renderItem={(social) => (
            <div className="flex items-center gap-3">
              <SocialIcon url={social.url}/>
              <Input
                aria-label={t("auth:account.signature.social_url_label", {list: title})}
                type="url"
                inputMode="url"
                value={social.url}
                onChange={(event) =>
                  onChange(socials.map((item) => (item.id === social.id ? {...item, url: event.target.value} : item)))
                }
                placeholder={placeholder}
                className="h-9"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(socials.filter((item) => item.id !== social.id))}
                aria-label={t("auth:account.signature.remove_social")}
                data-fs-hover
              >
                <Trash size={14}/>
              </Button>
            </div>
          )}
        />
      )}
    </section>
  );
};

/** The favicon as the signature will render it, so a wrong URL is visible before it is pasted. */
const SocialIcon = ({url}: {url: string}) => {
  const icon = faviconFor(url);
  const label = labelFor(url);

  if (!icon) {
    return (
      <span
        aria-hidden
        className="size-5 shrink-0 rounded-[var(--radius-sm)] border border-dashed border-neutral-700"
      />
    );
  }

  return <img src={icon} alt={label ?? ""} width={20} height={20} className="size-5 shrink-0 rounded-[var(--radius-sm)]"/>;
};

/**
 * The signature section as the router mounts it.
 *
 * The tab is only offered to company accounts, and the route guards itself the same way: a link to
 * it from an account that has no corporate signature lands on the account rather than on a tab that
 * is not there.
 */
export const SignatureSection = () => {
  const {me} = useAuth();

  if (!me) return null;
  if (!isCompanyEmail(me.user.email)) return <Navigate to={accountRoute.profile} replace/>;

  return <SignaturePanel user={me.user}/>;
};
