import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {ConfigDocument, ConfigPayload} from "@/lib/custom-apps/types.ts";
import {parseJsonObject} from "@/lib/cms/json.ts";
import {JsonField} from "@/pages/custom-apps/components/json-field.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {FieldLabel, FormHelpButton, RequiredLegend} from "@/components/ui/help.tsx";

const NOTE_MAX = 200;

/** The JSON Schema keywords the service validates with. Anything else in a schema is refused. */
const SUPPORTED_SCHEMA_KEYWORDS = [
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "title",
  "description",
  "default",
  "examples",
  "$schema",
] as const;

const pretty = (value: Record<string, unknown> | null | undefined) => (value ? JSON.stringify(value, null, 2) : "");

/**
 * The app's remote configuration: one JSON document every installation receives, optionally checked
 * against a schema, saved as numbered versions.
 *
 * Every save names the version it started from (`base_version`). Two people editing at once is
 * therefore a refusal for the second one rather than a silent overwrite of the first — the 409 says
 * so, and offers the latest version to start again from. A document that fails the schema comes back
 * as a list of issues, shown as the service wrote them.
 */
export const ConfigEditor = ({
  appId,
  config,
  onSaved,
  onReload,
}: {
  appId: string;
  config: ConfigDocument;
  onSaved: (config: ConfigDocument) => void;
  onReload: () => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {notify} = useToast();

  const baseline = useMemo(
    () => ({
      document: config.version === 0 && Object.keys(config.document ?? {}).length === 0 ? "{}" : pretty(config.document),
      schema: pretty(config.schema),
    }),
    [config],
  );
  const [documentText, setDocumentText] = useState(baseline.document);
  const [schemaText, setSchemaText] = useState(baseline.schema);
  const [note, setNote] = useState("");

  const save = useMutation(useCallback((body: ConfigPayload) => customAppsApi.config.save(appId, body), [appId]));
  const {reset} = save;

  /* A new version — saved here, restored from the history, or loaded after a conflict — resets the form. */
  useEffect(() => {
    setDocumentText(baseline.document);
    setSchemaText(baseline.schema);
    setNote("");
    reset();
  }, [baseline, reset]);

  const dirty = documentText !== baseline.document || schemaText !== baseline.schema || note.trim() !== "";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const document = parseJsonObject(documentText);
  const schema = parseJsonObject(schemaText);
  const documentMissing = document.ok && document.value === undefined;
  const invalid = !document.ok || !schema.ok || documentMissing;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!document.ok || !schema.ok || !document.value) return;

    const body: ConfigPayload = {document: document.value, base_version: config.version, note: orNull(note)};
    /* Unchanged: leave it out and the service keeps it. Emptied: null removes it. */
    if (schemaText !== baseline.schema) body.schema = schema.value ?? null;

    const outcome = await save.run(body);
    if (!outcome.ok) return;
    notify(t("custom_apps:config.saved", {version: outcome.data.version}));
    onSaved(outcome.data);
  };

  return (
    <form onSubmit={submit} noValidate>
      <Panel
        title={t("custom_apps:config.title")}
        description={
          config.version === 0
            ? t("custom_apps:config.never_saved")
            : t("custom_apps:config.current", {
                version: config.version,
                date: formatDateTime(config.created_at, i18n.language) ?? "—",
                by: config.created_by ?? t("custom_apps:audit.system"),
              })
        }
        action={
          <>
            <FormHelpButton help={help.form("config.form_help")} />
            {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
            <Button type="submit" size="sm" disabled={save.pending || !dirty || invalid}>
              {save.pending ? <Spinner size={14} /> : <FloppyDisk size={14} />}
              {t("custom_apps:config.publish")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {save.status === 409 ? (
            <Alert tone="error" title={t("custom_apps:config.conflict_title")}>
              <div className="flex flex-wrap items-center gap-3">
                <span>{t("custom_apps:config.conflict_body", {version: config.version})}</span>
                <Button type="button" variant="ghost" size="sm" onClick={onReload}>
                  <ArrowClockwise size={14} /> {t("custom_apps:config.load_latest")}
                </Button>
              </div>
            </Alert>
          ) : save.error ? (
            <Alert tone="error" title={save.status === 422 ? t("custom_apps:config.invalid_title") : t("admin:common.failed")}>
              {save.issues.length > 0 ? (
                <>
                  <span>{t(`admin:errors.${save.error}`, {defaultValue: save.error})}</span>
                  <ul className="mt-1.5 list-disc pl-5 font-mono text-[12px]">
                    {save.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </>
              ) : (
                t(`admin:errors.${save.error}`, {defaultValue: save.error})
              )}
            </Alert>
          ) : null}

          <RequiredLegend />

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <FieldLabel
                label={t("custom_apps:config.document")}
                htmlFor="config-document"
                help={help.field("config.help.document")}
                required
              />
              <JsonField
                id="config-document"
                value={documentText}
                onChange={setDocumentText}
                rows={16}
                disabled={save.pending}
                invalid={save.status === 422}
              />
              {documentMissing ? (
                <p className="text-xs text-red-400">{t("custom_apps:config.document_required")}</p>
              ) : (
                <p className="text-xs text-neutral-500">{t("custom_apps:config.document_hint")}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel label={t("custom_apps:config.schema")} htmlFor="config-schema" help={help.field("config.help.schema")} />
              <JsonField
                id="config-schema"
                value={schemaText}
                onChange={setSchemaText}
                rows={16}
                disabled={save.pending}
                placeholder={'{\n  "type": "object",\n  "properties": {}\n}'}
              />
              <p className="text-xs leading-relaxed text-neutral-500">
                {t("custom_apps:config.schema_hint")}{" "}
                <span className="font-mono text-[11px] text-neutral-400">{SUPPORTED_SCHEMA_KEYWORDS.join(", ")}</span>
              </p>
            </div>
          </div>

          <Field label={t("custom_apps:config.note")} htmlFor="config-note" hint={t("custom_apps:config.note_hint")} help={help.field("config.help.note")}>
            <Input
              id="config-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_MAX}
              disabled={save.pending}
              autoComplete="off"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDocumentText(baseline.document);
                  setSchemaText(baseline.schema);
                  setNote("");
                  save.reset();
                }}
                disabled={save.pending}
              >
                {t("admin:common.discard")}
              </Button>
            )}
            <Button type="submit" disabled={save.pending || !dirty || invalid}>
              {save.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
              {save.pending ? t("admin:common.saving") : t("custom_apps:config.publish")}
            </Button>
          </div>
        </div>
      </Panel>
    </form>
  );
};
