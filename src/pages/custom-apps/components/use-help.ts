import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import type {FieldHelp, FormHelp} from "@/components/ui/help.tsx";

type Vars = Record<string, unknown>;

/**
 * Reads the panel's help copy out of `custom_apps.json`.
 *
 * - `field("contacts.help.name")` reads `{what, how, example?}` under that path. The example is
 *   optional: a yes/no switch has no meaningful one.
 * - `form("contacts.form_help")` reads `{title?, what, can_do: [], on_save}`.
 *
 * Both take interpolation values for the limits the service sends at run time (heartbeat bounds,
 * notice and grace days), so the help never states a number the form would refuse.
 */
export const useHelp = () => {
  const {t, i18n} = useTranslation("custom_apps");

  const optional = useCallback(
    (key: string, vars?: Vars) => (i18n.exists(`custom_apps:${key}`) ? t(key, vars) : undefined),
    [t, i18n],
  );

  const field = useCallback(
    (path: string, vars?: Vars): FieldHelp => ({
      what: t(`${path}.what`, vars),
      how: t(`${path}.how`, vars),
      example: optional(`${path}.example`, vars),
    }),
    [t, optional],
  );

  const form = useCallback(
    (path: string, vars?: Vars): FormHelp => {
      const canDo: unknown = t(`${path}.can_do`, {...vars, returnObjects: true});
      return {
        title: optional(`${path}.title`, vars),
        what: t(`${path}.what`, vars),
        canDo: Array.isArray(canDo) ? canDo.map(String) : [],
        onSave: t(`${path}.on_save`, vars),
      };
    },
    [t, optional],
  );

  return {field, form};
};
