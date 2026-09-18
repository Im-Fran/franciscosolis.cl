import {type ReactNode, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowLeft, Check, Copy, DownloadSimple, FileMd, GlobeSimple, Prohibit} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {BRAND_MARK_MIN_SIZE, BrandLockup, BrandMark} from "@/components/brand";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";

type Surface = "dark" | "light";

const SURFACE_BACKGROUND: Record<Surface, string> = {
  dark: "var(--color-brand-ink)",
  light: "var(--color-brand-paper)",
};

/** The brand's color tokens, in the order they appear in docs/BRAND.md. */
const TOKENS: Array<{ token: string; value: string; rgb?: string; swatch: string; copy?: string }> = [
  {
    token: "brand/gradient",
    value: "45°: #5A68C4 → #8A4270",
    swatch: "var(--gradient-brand)",
    copy: "linear-gradient(45deg, #5A68C4, #8A4270)",
  },
  {token: "brand/periwinkle-500", value: "#5A68C4", rgb: "90 104 196", swatch: "#5A68C4"},
  {token: "brand/plum-500", value: "#8A4270", rgb: "138 66 112", swatch: "#8A4270"},
  {token: "brand/iris-500", value: "#75549C", rgb: "117 84 156", swatch: "#75549C"},
  {token: "brand/iris-300", value: "#B298D6", rgb: "178 152 214", swatch: "#B298D6"},
  {token: "brand/iris-050", value: "#F4F1F9", rgb: "244 241 249", swatch: "#F4F1F9"},
  {token: "neutral/ink", value: "#1E1E1E", rgb: "30 30 30", swatch: "#1E1E1E"},
  {token: "neutral/paper", value: "#FAFAFA", rgb: "250 250 250", swatch: "#FAFAFA"},
];

/** Measured contrast of every pairing the brand actually ships. */
const CONTRAST: Array<{ pair: [string, string]; ratio: string; level: "AAA" | "AA" | "fail" }> = [
  {pair: ["ink", "paper"], ratio: "16.0:1", level: "AAA"},
  {pair: ["iris-500", "paper"], ratio: "5.7:1", level: "AA"},
  {pair: ["white", "iris-500"], ratio: "6.0:1", level: "AA"},
  {pair: ["white", "plum-500"], ratio: "6.8:1", level: "AA"},
  {pair: ["white", "periwinkle-500"], ratio: "5.0:1", level: "AA"},
  {pair: ["white", "gradient"], ratio: "5.0:1", level: "AA"},
  {pair: ["iris-300", "ink"], ratio: "6.6:1", level: "AA"},
  {pair: ["iris-500", "ink"], ratio: "2.8:1", level: "fail"},
];

/** 96 dpi: what one screen pixel measures on paper. */
const MM_PER_PX = 25.4 / 96;

const SPACING: Array<{ ruleKey: string; px: number }> = [
  {ruleKey: "clear_space", px: 32},
  {ruleKey: "tile_gap", px: 18},
  {ruleKey: "min_mark", px: 16},
  {ruleKey: "min_horizontal", px: 24},
  {ruleKey: "min_vertical", px: 120},
];

const MARK_SIZES = [BRAND_MARK_MIN_SIZE, 24, 32, 64];

type Download = { label: string; href: string };

const pack = (name: string, formats: Array<"svg" | "png" | "webp">): Download[] =>
  formats.map((format) => ({label: format.toUpperCase(), href: `/brand/${format}/${name}.${format}`}));

const ASSETS: Array<{ useKey: string; name: string; downloads: Download[] }> = [
  {useKey: "horizontal", name: "fs-lockup-horizontal", downloads: pack("fs-lockup-horizontal", ["svg", "png", "webp"])},
  {
    useKey: "horizontal_dark",
    name: "fs-lockup-horizontal-dark",
    downloads: pack("fs-lockup-horizontal-dark", ["svg", "png", "webp"]),
  },
  {useKey: "vertical", name: "fs-lockup-vertical", downloads: pack("fs-lockup-vertical", ["svg", "png", "webp"])},
  {
    useKey: "vertical_dark",
    name: "fs-lockup-vertical-dark",
    downloads: pack("fs-lockup-vertical-dark", ["svg", "png", "webp"]),
  },
  {useKey: "mark", name: "fs-mark", downloads: pack("fs-mark", ["svg", "png", "webp"])},
  {useKey: "mark_square", name: "fs-mark-square", downloads: pack("fs-mark-square", ["svg", "png", "webp"])},
  {useKey: "mark_mono_ink", name: "fs-mark-mono-ink", downloads: pack("fs-mark-mono-ink", ["svg", "png", "webp"])},
  {useKey: "mark_mono_white", name: "fs-mark-mono-white", downloads: pack("fs-mark-mono-white", ["svg", "png", "webp"])},
  {useKey: "avatar", name: "fs-avatar-circle", downloads: pack("fs-avatar-circle", ["svg", "png", "webp"])},
  {
    useKey: "favicons",
    name: "favicon-16…512",
    downloads: [16, 32, 64, 192, 512].map((size) => ({
      label: String(size),
      href: `/brand/png/favicon-${size}.png`,
    })),
  },
];

const CLEAR_SPACE_MARK = 64;

/**
 * The kit is packed on demand by scripts/brand-kit.mjs — served in dev, emitted into the bundle on
 * build — so it is never a committed binary that can drift from the assets. Keep these in step with
 * BRAND_KIT_URL there; the agent-facing guide is a plain file under public/, readable without
 * unzipping anything.
 */
const KIT_URL = "/brand/franciscosolis-brand-kit.zip";
const KIT_GUIDE_URL = "/brand/BRAND.md";

const Section = ({title, body, children}: { title: string; body?: string; children?: ReactNode }) => (
  <section className="mt-16">
    <h2 className="text-[clamp(22px,3vw,30px)] text-text mb-3">{title}</h2>
    {body && <p className="max-w-2xl text-[15px] leading-[1.65] text-neutral-300">{body}</p>}
    {children}
  </section>
);

/** Frames a mark against one of the two brand surfaces, so tone choices can be compared side by side. */
const Stage = ({surface, label, children}: { surface: Surface; label: string; children: ReactNode }) => (
  <div className="rounded-[var(--radius-md)] border border-neutral-800 overflow-hidden">
    <p className="border-b border-neutral-800 bg-surface px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-neutral-500">
      {label}
    </p>
    <div className="flex items-center justify-center p-10" style={{background: SURFACE_BACKGROUND[surface]}}>
      {children}
    </div>
  </div>
);

const Table = ({headers, children}: { headers: string[]; children: ReactNode }) => (
  <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-surface">
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr>
          {headers.map((header) => (
            <th
              key={header}
              className="border-b border-neutral-800 px-4 py-3 text-[11px] font-normal uppercase tracking-[0.08em] text-neutral-500"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-800">{children}</tbody>
    </table>
  </div>
);

const Swatch = ({token, value, swatch, copyValue}: {
  token: string;
  value: string;
  swatch: string;
  copyValue: string;
}) => {
  const {t} = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(copyValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("brand:color.copy", {hex: copyValue})}
      className="group flex w-full items-center gap-3 text-left cursor-pointer"
    >
      <span
        className="size-9 shrink-0 rounded-[var(--radius-sm)] border border-neutral-700"
        style={{background: swatch}}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-xs text-text">{token}</span>
        <span className="mt-0.5 block font-mono text-[11px] uppercase text-neutral-500">{value}</span>
      </span>
      <span className="shrink-0 text-neutral-500 group-hover:text-neutral-300 transition-colors">
        {copied
          ? <span className="inline-flex items-center gap-1 text-xs text-accent-300"><Check size={14}/>{t("brand:color.copied")}</span>
          : <Copy size={16}/>}
      </span>
    </button>
  );
};

export const Brand = () => {
  const {t} = useTranslation();
  const {language, toggleLanguage} = useLanguageToggle();

  const rationale = t("brand:rationale.items", {returnObjects: true}) as unknown as Array<{ term: string; body: string }>;
  const dos = t("brand:rules.do_items", {returnObjects: true}) as unknown as string[];
  const donts = t("brand:rules.dont_items", {returnObjects: true}) as unknown as string[];

  return (
    <section className="relative w-full overflow-hidden">
      <div className="container relative z-10 mx-auto max-w-3xl px-4 pt-32 pb-24">
        <div className="mb-10 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft size={16}/>
              {t("brand:back")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleLanguage}>
            <GlobeSimple size={16}/>
            {language === "es" ? "EN" : "ES"}
          </Button>
        </div>

        <p className="mb-3 text-[13px] uppercase tracking-[0.08em] text-accent-300">{t("brand:kicker")}</p>
        <h1 className="mb-6 text-[clamp(32px,5.5vw,56px)] text-text">{t("brand:title")}</h1>
        <p className="max-w-2xl text-[16px] leading-[1.65] text-neutral-300">{t("brand:intro")}</p>

        <Section title={t("brand:rationale.title")} body={t("brand:rationale.lead")}>
          <dl className="mt-6 space-y-3">
            {rationale.map(({term, body}) => (
              <div key={term} className="rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-5">
                <dt className="mb-2 text-[15px] text-text">{term}</dt>
                <dd className="text-[15px] leading-[1.65] text-neutral-300">{body}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title={t("brand:lockup.title")} body={t("brand:lockup.body")}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Stage surface="dark" label={t("brand:lockup.on_dark")}>
              <BrandLockup size={36} tone="dark"/>
            </Stage>
            <Stage surface="light" label={t("brand:lockup.on_light")}>
              <BrandLockup size={36} tone="light"/>
            </Stage>
          </div>
          <p className="mt-4 text-sm leading-[1.6] text-neutral-500">{t("brand:lockup.note")}</p>
        </Section>

        <Section title={t("brand:vertical.title")} body={t("brand:vertical.body")}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Stage surface="dark" label={t("brand:lockup.on_dark")}>
              <BrandLockup size={44} tone="dark" variant="vertical"/>
            </Stage>
            <Stage surface="light" label={t("brand:lockup.on_light")}>
              <BrandLockup size={44} tone="light" variant="vertical"/>
            </Stage>
          </div>
        </Section>

        <Section title={t("brand:mark.title")} body={t("brand:mark.body")}>
          <div className="mt-6">
            <Stage surface="dark" label={t("brand:mark.sizes_label")}>
              <div className="flex flex-wrap items-end justify-center gap-6">
                {MARK_SIZES.map((size) => (
                  <span key={size} className="flex flex-col items-center gap-2">
                    <BrandMark size={size}/>
                    <span className="font-mono text-[10px] text-neutral-500">{size}</span>
                  </span>
                ))}
                <span className="flex flex-col items-center gap-2">
                  <BrandMark size={48} shape="square"/>
                  <span className="font-mono text-[10px] text-neutral-500">{t("brand:mark.square_label")}</span>
                </span>
                <span className="flex flex-col items-center gap-2">
                  <BrandMark size={48} shape="circle"/>
                  <span className="font-mono text-[10px] text-neutral-500">{t("brand:mark.circle_label")}</span>
                </span>
              </div>
            </Stage>
          </div>
          <p className="mt-4 text-sm leading-[1.6] text-neutral-500">{t("brand:mark.shapes_note")}</p>

          <h3 className="mt-8 mb-2 text-lg text-text">{t("brand:mark.mono_title")}</h3>
          <p className="max-w-2xl text-[15px] leading-[1.65] text-neutral-300">{t("brand:mark.mono_body")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Stage surface="light" label={t("brand:mark.mono_ink_label")}>
              <BrandMark size={64} mono="ink"/>
            </Stage>
            <Stage surface="dark" label={t("brand:mark.mono_white_label")}>
              <BrandMark size={64} mono="white"/>
            </Stage>
          </div>
        </Section>

        <Section title={t("brand:color.title")} body={t("brand:color.body")}>
          <Table headers={[t("brand:color.headers.token"), t("brand:color.headers.rgb"), t("brand:color.headers.use")]}>
            {TOKENS.map(({token, value, rgb, swatch, copy}) => (
              <tr key={token}>
                <td className="px-4 py-3 align-middle">
                  <Swatch token={token} value={value} swatch={swatch} copyValue={copy ?? value}/>
                </td>
                <td className="px-4 py-3 align-middle font-mono text-xs text-neutral-500">{rgb ?? "—"}</td>
                <td className="px-4 py-3 align-middle text-[13px] leading-[1.5] text-neutral-300">
                  {t(`brand:color.uses.${token}`)}
                </td>
              </tr>
            ))}
          </Table>
          <p className="mt-4 text-sm leading-[1.6] text-neutral-500">{t("brand:color.gradient_note")}</p>
        </Section>

        <Section title={t("brand:contrast.title")} body={t("brand:contrast.body")}>
          <Table headers={[
            t("brand:contrast.headers.pairing"),
            t("brand:contrast.headers.ratio"),
            t("brand:contrast.headers.level"),
          ]}>
            {CONTRAST.map(({pair: [foreground, background], ratio, level}) => (
              <tr key={`${foreground}-${background}`}>
                <td className="px-4 py-3 font-mono text-xs text-text">
                  {foreground} {t("brand:contrast.on")} {background}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">{ratio}</td>
                <td className={`px-4 py-3 text-[13px] ${level === "fail" ? "text-neutral-400" : "text-accent-300"}`}>
                  {level === "fail" ? `✕ ${t("brand:contrast.fail")}` : level}
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title={t("brand:spacing.title")} body={t("brand:spacing.body")}>
          <Table headers={[t("brand:spacing.headers.rule"), "px", "mm", "µm"]}>
            {SPACING.map(({ruleKey, px}) => (
              <tr key={ruleKey}>
                <td className="px-4 py-3 text-[13px] leading-[1.5] text-neutral-300">
                  {t(`brand:spacing.rules.${ruleKey}`)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text">{px}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">{(px * MM_PER_PX).toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                  {Math.round(px * MM_PER_PX * 1000).toLocaleString(language === "es" ? "es-CL" : "en-US")}
                </td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title={t("brand:type.title")} body={t("brand:type.body")}>
          <div className="mt-6 rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-8">
            <p
              className="font-display font-semibold leading-none text-text text-[clamp(28px,7vw,56px)]"
              style={{letterSpacing: "-0.02em"}}
            >
              FranciscoSolis
            </p>
            <p className="mt-5 font-mono text-xs text-neutral-500">{t("brand:type.specimen_caption")}</p>
          </div>
        </Section>

        <Section title={t("brand:clear_space.title")} body={t("brand:clear_space.body")}>
          <div className="mt-6">
            <Stage surface="dark" label={t("brand:clear_space.label")}>
              <span
                className="inline-flex border border-dashed"
                style={{
                  padding: CLEAR_SPACE_MARK / 2,
                  borderColor: "color-mix(in oklab, var(--color-brand-on-dark) 55%, transparent)",
                }}
              >
                <BrandMark size={CLEAR_SPACE_MARK}/>
              </span>
            </Stage>
          </div>
        </Section>

        <Section title={t("brand:rules.title")} body={t("brand:rules.body")}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-5">
              <h3 className="mb-3 text-[13px] uppercase tracking-[0.08em] text-accent-300">{t("brand:rules.do")}</h3>
              <ul className="space-y-3">
                {dos.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.6] text-neutral-300">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent-400"/>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-5">
              <h3 className="mb-3 text-[13px] uppercase tracking-[0.08em] text-neutral-500">{t("brand:rules.dont")}</h3>
              <ul className="space-y-3">
                {donts.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.6] text-neutral-300">
                    <Prohibit size={18} className="mt-0.5 shrink-0 text-neutral-500"/>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section title={t("brand:code.title")} body={t("brand:code.body")}>
          <pre className="mt-6 w-full overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-4 text-left text-xs leading-relaxed text-neutral-300">
{`import {BrandLockup, BrandMark} from "@/components/brand";

<BrandLockup tone="dark" />           // header lockup
<BrandLockup variant="vertical" />    // square placements
<BrandMark size={24} />               // mark alone
<BrandMark mono="ink" size={24} />    // single-color mark
<BrandMark shape="square" size={48} />// platforms that round it themselves
<BrandMark shape="circle" size={48} />// forced circular crops`}
          </pre>
        </Section>

        <Section title={t("brand:assets.title")} body={t("brand:assets.body")}>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-5">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-text">{t("brand:assets.kit.title")}</span>
              <span className="mt-1 block text-sm leading-[1.6] text-neutral-500">
                {t("brand:assets.kit.body")}
              </span>
            </span>
            <span className="flex shrink-0 flex-wrap gap-2">
              <Button asChild>
                <a href={KIT_URL} download>
                  <DownloadSimple size={16}/>
                  {t("brand:assets.kit.download")}
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href={KIT_GUIDE_URL} target="_blank" rel="noreferrer">
                  <FileMd size={16}/>
                  {t("brand:assets.kit.guide")}
                </a>
              </Button>
            </span>
          </div>

          <ul className="mt-4 divide-y divide-neutral-800 rounded-[var(--radius-md)] border border-neutral-800 bg-surface">
            {ASSETS.map(({useKey, name, downloads}) => (
              <li key={useKey} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-text">{name}</span>
                  <span className="mt-1 block text-sm text-neutral-500">{t(`brand:assets.uses.${useKey}`)}</span>
                </span>
                <span className="flex shrink-0 flex-wrap gap-2">
                  {downloads.map(({label, href}) => (
                    <Button key={href} asChild variant="secondary" size="sm">
                      <a href={href} download>{label}</a>
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-[1.6] text-neutral-500">{t("brand:assets.note")}</p>
        </Section>
      </div>
    </section>
  );
};
