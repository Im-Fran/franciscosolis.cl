import {useState} from "react";
import type {FormEvent} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {MagnifyingGlass} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {helpRoute} from "@/lib/support/config.ts";

/** The search box, on the help home and above every result page. */
export const HelpSearchBox = ({initial = "", autoFocus = false}: {initial?: string; autoFocus?: boolean}) => {
  const {t} = useTranslation("support");
  const navigate = useNavigate();
  const [query, setQuery] = useState(initial);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    navigate(helpRoute.search(trimmed));
  };

  return (
    <form onSubmit={submit} className="flex w-full gap-2" role="search">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("help.search_placeholder")}
        aria-label={t("help.search_action")}
        autoFocus={autoFocus}
        className="flex-1"
      />
      <Button type="submit">
        <MagnifyingGlass size={16} aria-hidden />
        <span className="max-sm:sr-only">{t("help.search_action")}</span>
      </Button>
    </form>
  );
};
