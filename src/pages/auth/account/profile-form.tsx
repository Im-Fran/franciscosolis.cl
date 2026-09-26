import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {LANGUAGES, useA11y} from "@/lib/a11y";
import type {Language} from "@/lib/a11y";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {authApi} from "@/lib/auth/api.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {AvatarPanel} from "@/pages/auth/account/avatar-panel.tsx";
import {Panel} from "@/pages/auth/components/panel.tsx";
import type {ProfileUpdate, User} from "@/lib/auth/types.ts";

const EDITABLE = ["name", "given_name", "family_name", "locale"] as const;
type EditableField = (typeof EDITABLE)[number];

/**
 * The language the account's `locale` names, if it is one the site is written in.
 *
 * Older accounts can hold a full BCP 47 tag (`es-CL`) typed in by hand; the picker only offers the
 * languages there are translations for, so the region is dropped and anything else reads as unset.
 */
const toLanguage = (locale: string | null | undefined): Language | "" => {
  const base = (locale ?? "").toLowerCase().split(/[-_]/)[0];
  return (LANGUAGES as readonly string[]).includes(base) ? (base as Language) : "";
};

const toForm = (user: User): Record<EditableField, string> => ({
  name: user.name ?? "",
  given_name: user.given_name ?? "",
  family_name: user.family_name ?? "",
  locale: toLanguage(user.locale),
});

/**
 * Edits the profile fields the account owns.
 *
 * Two are not among them. The email is the identity key providers are matched on, and the picture
 * is uploaded rather than typed: it goes through review before it is published, which a free-form
 * URL field would have made optional. `AvatarPanel` owns that half.
 */
export const ProfileForm = ({user}: {user: User}) => {
  const {t} = useTranslation();
  const {reload} = useAuth();
  const {notify} = useToast();
  const {setPreference} = useA11y();
  const [form, setForm] = useState(() => toForm(user));
  const save = useMutation(useCallback((changes: ProfileUpdate) => authApi.updateMe(changes), []));

  const original = toForm(user);
  const dirty = EDITABLE.some((key) => form[key] !== original[key]);

  const set = (key: EditableField) => (event: {target: {value: string}}) => {
    setForm((current) => ({...current, [key]: event.target.value}));
    save.reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    /* Only send what changed, and turn cleared fields into the nulls the API uses for "unset". */
    const changes: ProfileUpdate = {};
    for (const key of EDITABLE) {
      if (form[key] !== original[key]) changes[key] = form[key].trim() || null;
    }

    const result = await save.run(changes);
    if (!result.ok) return;

    /* The site follows the account's language, otherwise the language sync would put the old one back. */
    const language = toLanguage(changes.locale);
    if (language) setPreference("language", language);

    await reload();
    notify(t("auth:account.saved"));
  };

  return (
    <Panel title={t("auth:account.profile_title")} description={t("auth:account.profile_description")}>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <AvatarPanel user={user}/>

        <Field label={t("auth:account.email_label")} htmlFor="profile-email" hint={t("auth:account.email_hint")}>
          <Input id="profile-email" value={user.email} readOnly disabled autoComplete="email"/>
        </Field>

        <Field label={t("auth:account.name_label")} htmlFor="profile-name">
          <Input
            id="profile-name"
            value={form.name}
            onChange={set("name")}
            maxLength={120}
            autoComplete="name"
            placeholder={t("auth:account.name_placeholder")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth:account.given_name_label")} htmlFor="profile-given-name">
            <Input
              id="profile-given-name"
              value={form.given_name}
              onChange={set("given_name")}
              maxLength={120}
              autoComplete="given-name"
            />
          </Field>
          <Field label={t("auth:account.family_name_label")} htmlFor="profile-family-name">
            <Input
              id="profile-family-name"
              value={form.family_name}
              onChange={set("family_name")}
              maxLength={120}
              autoComplete="family-name"
            />
          </Field>
        </div>

        <Field label={t("auth:account.locale_label")} htmlFor="profile-locale" hint={t("auth:account.locale_hint")}>
          <Select id="profile-locale" value={form.locale} onChange={set("locale")}>
            {form.locale === "" && <option value="" disabled>{t("auth:account.locale_placeholder")}</option>}
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>{t(`a11y:settings.language.options.${language}`)}</option>
            ))}
          </Select>
        </Field>

        {save.error && <Alert tone="error">{t(`auth:errors.${save.error}`, {defaultValue: save.error})}</Alert>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || save.pending}>
            {save.pending ? <Spinner size={16}/> : <FloppyDisk size={16}/>}
            {t("auth:account.save")}
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(toForm(user));
                save.reset();
              }}
            >
              {t("auth:common.cancel")}
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
};

/**
 * The profile section as the router mounts it.
 *
 * The form keeps the fields being typed in its own state, seeded from the profile, so the profile
 * is read here and handed down rather than subscribed to inside it — that way a reload of the
 * account does not reach in and overwrite what is half-written.
 */
export const ProfileSection = () => {
  const {me} = useAuth();

  return me ? <ProfileForm user={me.user}/> : null;
};
