import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowsClockwise, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TagInput} from "@/components/admin/tag-input.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import {supportRoute} from "@/lib/support/config.ts";
import type {AdminArticle} from "@/lib/support/types.ts";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {TranslationsPanel} from "@/pages/support/components/translations-panel.tsx";

/** The three prose fields a help article has. Slug, section and ordering are structure, not prose. */
const TRANSLATABLE = ["title", "summary", "body"] as const;
const LIMITS = {title: 200, summary: 600, body: 200_000};

/**
 * Writing a help article.
 *
 * The markdown editor and the translations panel are shared components (`@/components/prose`),
 * deliberately: this is the same job the CMS does — prose in two languages with the English in the
 * row and the Spanish as overrides — and a second implementation of it would drift within a
 * release. Shared is not the same as borrowed, though: it used to import the CMS's own copies, and
 * that made this screen throw on a context no support route ever mounts.
 */
export const ArticleEditor = ({mode}: {mode: "create" | "edit"}) => {
  const {t} = useTranslation(["support_agent", "prose"]);
  const {id = ""} = useParams();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [form, setForm] = useState<Partial<AdminArticle>>({
    title: "",
    summary: "",
    body: "",
    status: "draft",
    featured: false,
    tags: [],
    translations: {},
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existing = useResource(
    useCallback(
      (signal: AbortSignal) =>
        mode === "edit" ? supportApi.help.article(id, signal) : Promise.resolve(null),
      [id, mode],
    ),
  );
  const categories = useResource(useCallback((signal: AbortSignal) => supportApi.help.categories(signal), []));

  useEffect(() => {
    if (existing.data) setForm(existing.data);
  }, [existing.data]);

  const save = useMutation(
    useCallback(
      (payload: Partial<AdminArticle>) =>
        mode === "edit" ? supportApi.help.updateArticle(id, payload) : supportApi.help.createArticle(payload),
      [id, mode],
    ),
  );
  const reindex = useMutation(useCallback(() => supportApi.help.reindex(id), [id]));
  const remove = useMutation(useCallback(() => supportApi.help.removeArticle(id), [id]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await save.run({
      title: form.title,
      summary: form.summary,
      body: form.body,
      status: form.status,
      featured: form.featured,
      tags: form.tags,
      category_id: form.category_id ?? null,
      translations: form.translations,
    });
    if (outcome.ok) {
      notify(t("articles.saved"));
      if (mode === "create") navigate(supportRoute.article(outcome.data.id));
    }
  };

  if (mode === "edit" && existing.loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={mode === "edit" ? (form.title ?? "") : t("articles.new")}
        back={{to: supportRoute.articles, label: t("articles.title")}}
        actions={
          mode === "edit" ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={reindex.pending}
                title={t("articles.reindex_hint")}
                onClick={async () => {
                  const outcome = await reindex.run();
                  if (outcome.ok) {
                    notify(t("articles.reindexed", {rows: outcome.data.search_rows, vectors: outcome.data.vectors}));
                  }
                }}
                data-fs-hover
              >
                <ArrowsClockwise size={14} /> {t("articles.reindex")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} data-fs-hover>
                <Trash size={14} />
              </Button>
            </div>
          ) : null
        }
      />

      <form onSubmit={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("articles.article_title")}</span>
          <Input
            value={form.title ?? ""}
            onChange={(event) => setForm((current) => ({...current, title: event.target.value}))}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("articles.summary")}</span>
          <Input
            value={form.summary ?? ""}
            onChange={(event) => setForm((current) => ({...current, summary: event.target.value}))}
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("articles.category")}</span>
            <Select
              value={form.category_id ?? ""}
              onChange={(event) => setForm((current) => ({...current, category_id: event.target.value || null}))}
            >
              <option value="">—</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("articles.status")}</span>
            <Select
              value={form.status ?? "draft"}
              onChange={(event) =>
                setForm((current) => ({...current, status: event.target.value as AdminArticle["status"]}))
              }
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </Select>
          </label>

          <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={form.featured ?? false}
              onChange={(event) => setForm((current) => ({...current, featured: event.target.checked}))}
              className="size-4 accent-[var(--color-accent)]"
            />
            {t("articles.featured")}
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("articles.tags")}</span>
          <TagInput
            id="article-tags"
            value={form.tags ?? []}
            onChange={(tags) => setForm((current) => ({...current, tags}))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("articles.body")}</span>
          <MarkdownEditor
            id="article-body"
            value={form.body ?? ""}
            onChange={(body) => setForm((current) => ({...current, body}))}
            rows={18}
          />
        </div>

        <TranslationsPanel
          fields={TRANSLATABLE}
          source={{title: form.title ?? "", summary: form.summary ?? "", body: form.body ?? ""}}
          value={form.translations ?? {}}
          onChange={(translations) => setForm((current) => ({...current, translations}))}
          limits={LIMITS}
        />

        {save.error ? <Alert tone="error">{save.error}</Alert> : null}

        <Button type="submit" disabled={save.pending} className="self-end">
          {save.pending ? t("articles.saving") : t("articles.save")}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title={form.title ?? ""}
        body={t("articles.delete_confirm")}
        confirmLabel={t("articles.title")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const outcome = await remove.run();
          if (outcome.ok) {
            notify(t("articles.deleted"));
            navigate(supportRoute.articles);
          }
        }}
      />
    </section>
  );
};
