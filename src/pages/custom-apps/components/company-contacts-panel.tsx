import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {LinkSimple, PencilSimple, Plus, Star, UserPlus, UsersThree, X} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {FieldLabel, FieldLegend, RequiredLegend} from "@/components/ui/help.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {CompanyContact, ContactRole} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {RoleChips} from "@/pages/custom-apps/components/badges.tsx";
import {CheckboxGroup} from "@/pages/custom-apps/components/checkbox-group.tsx";
import {CheckboxField} from "@/pages/custom-apps/components/checkbox-field.tsx";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

type Draft = {contactId: string; contactName: string; roles: ContactRole[]; isPrimary: boolean};

/**
 * The people at one company, and what each of them is there for.
 *
 * A link is written whole — the service replaces it on every `PUT` — so adding a contact and editing
 * one's roles are the same dialog with a different starting point. Marking somebody primary clears
 * the flag on everybody else, which is why every change reloads the company rather than patching
 * one row in place.
 */
export const CompanyContactsPanel = ({
  companyId,
  links,
  onChanged,
}: {
  companyId: string;
  links: CompanyContact[];
  onChanged: () => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const {contactRoles} = useServiceVocabulary();
  const help = useHelp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adding, setAdding] = useState(false);
  const [unlinking, setUnlinking] = useState<CompanyContact | null>(null);
  const [search, setSearch] = useState("");
  const [debounced] = useDebounceValue(search.trim(), 300);

  const candidates = useResource(
    useCallback(
      (signal: AbortSignal) =>
        adding ? customAppsApi.contacts.list({search: debounced, limit: 20}, signal) : Promise.resolve(null),
      [adding, debounced],
    ),
  );

  const save = useMutation(
    useCallback(
      (value: Draft) =>
        customAppsApi.companies.link(companyId, value.contactId, {roles: value.roles, is_primary: value.isPrimary}),
      [companyId],
    ),
  );
  const unlink = useMutation(
    useCallback((contactId: string) => customAppsApi.companies.unlink(companyId, contactId), [companyId]),
  );

  const linked = new Set(links.map((link) => link.contact_id));
  const roleOptions = contactRoles.map((role) => ({
    value: role,
    label: t(`custom_apps:roles.${role}`, {defaultValue: role}),
    hint: t(`custom_apps:roles_hint.${role}`, {defaultValue: ""}) || undefined,
  }));

  const close = () => {
    save.reset();
    setDraft(null);
    setAdding(false);
    setSearch("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const outcome = await save.run(draft);
    if (!outcome.ok) return;
    notify(adding ? t("custom_apps:company_contacts.linked") : t("admin:common.saved"));
    close();
    onChanged();
  };

  const ordered = [...links].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  return (
    <Panel
      title={t("custom_apps:company_contacts.title")}
      description={t("custom_apps:company_contacts.description")}
      action={
        <>
          <Button variant="ghost" size="sm" asChild>
            <Link to={customAppsRoute.contactNew}>
              <UserPlus size={14} /> {t("custom_apps:company_contacts.create")}
            </Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <LinkSimple size={14} /> {t("custom_apps:company_contacts.add")}
          </Button>
        </>
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={28} />}
          title={t("custom_apps:company_contacts.empty_title")}
          description={t("custom_apps:company_contacts.empty_description")}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((link) => (
            <li
              key={link.contact_id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm text-text">
                  <Link to={customAppsRoute.contact(link.contact_id)} className="truncate hover:underline">
                    {link.contact.name}
                  </Link>
                  {link.is_primary && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                      <Star size={12} weight="fill" /> {t("custom_apps:company_contacts.primary")}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                  {[...link.contact.emails, ...link.contact.phones].join(" · ") || t("custom_apps:contacts.no_channels")}
                </p>
                <div className="mt-2">
                  <RoleChips roles={link.roles} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={t("custom_apps:company_contacts.edit_aria", {name: link.contact.name})}
                  onClick={() =>
                    setDraft({
                      contactId: link.contact_id,
                      contactName: link.contact.name,
                      roles: link.roles,
                      isPrimary: link.is_primary,
                    })
                  }
                >
                  <PencilSimple size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-neutral-400 hover:text-red-300"
                  aria-label={t("custom_apps:company_contacts.unlink_aria", {name: link.contact.name})}
                  onClick={() => {
                    unlink.reset();
                    setUnlinking(link);
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={adding || draft !== null}
        onClose={save.pending ? () => undefined : close}
        title={
          adding
            ? t("custom_apps:company_contacts.add_title")
            : t("custom_apps:company_contacts.edit_title", {name: draft?.contactName ?? ""})
        }
        className="max-w-xl"
        help={help.form("company_contacts.form_help")}
      >
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          {adding && <RequiredLegend className="-mt-2" />}
          {adding && (
            <div className="flex flex-col gap-2">
              <FieldLabel label={t("custom_apps:company_contacts.pick")} help={help.field("company_contacts.help.pick")} required />
              <SearchBox value={search} onChange={setSearch} placeholder={t("custom_apps:contacts.search")} />
              <div className="max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-neutral-800">
                {candidates.loading && !candidates.data ? (
                  <p className="flex items-center gap-2 px-3 py-3 text-[13px] text-neutral-500">
                    <Spinner size={14} /> {t("admin:common.loading")}
                  </p>
                ) : (candidates.data?.data ?? []).length === 0 ? (
                  <p className="px-3 py-3 text-[13px] text-neutral-500">{t("custom_apps:company_contacts.no_candidates")}</p>
                ) : (
                  <ul role="listbox" aria-label={t("custom_apps:company_contacts.pick")}>
                    {(candidates.data?.data ?? []).map((contact) => {
                      const taken = linked.has(contact.id);
                      const selected = draft?.contactId === contact.id;
                      return (
                        <li key={contact.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={taken}
                            onClick={() =>
                              setDraft((current) => ({
                                contactId: contact.id,
                                contactName: contact.name,
                                roles: current?.roles ?? [],
                                isPrimary: current?.isPrimary ?? links.length === 0,
                              }))
                            }
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-neutral-800/70 px-3 py-2 text-left text-sm last:border-0 disabled:cursor-not-allowed disabled:opacity-50",
                              selected ? "bg-accent-900/40 text-accent-200" : "text-neutral-300 hover:bg-neutral-800/40",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate">{contact.name}</span>
                              <span className="block truncate text-[12px] text-neutral-500">{contact.emails.join(", ")}</span>
                            </span>
                            {taken && <span className="shrink-0 text-[11px] text-neutral-500">{t("custom_apps:company_contacts.already")}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {draft && (
            <>
              <fieldset className="flex flex-col gap-2">
                <FieldLegend
                  label={t("custom_apps:company_contacts.roles_for", {name: draft.contactName})}
                  help={help.field("company_contacts.help.roles")}
                  className="mb-2"
                />
                <CheckboxGroup
                  idPrefix="link-role"
                  options={roleOptions}
                  value={draft.roles}
                  onChange={(roles) => setDraft((current) => (current ? {...current, roles: roles as ContactRole[]} : current))}
                  disabled={save.pending}
                />
              </fieldset>

              <CheckboxField
                variant="plain"
                id="link-primary"
                label={t("custom_apps:company_contacts.primary_label")}
                checked={draft.isPrimary}
                disabled={save.pending}
                onChange={(checked) => setDraft((current) => (current ? {...current, isPrimary: checked} : current))}
                help={help.field("company_contacts.help.primary")}
              />
            </>
          )}

          {save.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={save.pending}>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={save.pending || !draft}>
              {save.pending ? <Spinner size={16} /> : <Plus size={16} />}
              {adding ? t("custom_apps:company_contacts.link") : t("admin:common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={unlinking !== null}
        title={t("custom_apps:company_contacts.unlink_title")}
        body={t("custom_apps:company_contacts.unlink_body", {name: unlinking?.contact.name ?? ""})}
        confirmLabel={t("custom_apps:company_contacts.unlink")}
        pending={unlink.pending}
        error={unlink.error}
        onClose={() => setUnlinking(null)}
        onConfirm={async () => {
          if (!unlinking) return;
          const outcome = await unlink.run(unlinking.contact_id);
          if (!outcome.ok) return;
          notify(t("custom_apps:company_contacts.unlinked"));
          setUnlinking(null);
          onChanged();
        }}
      />
    </Panel>
  );
};
