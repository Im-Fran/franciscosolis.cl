import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Plus, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import type {Label} from "@/lib/support/types.ts";

/**
 * The label catalogue.
 *
 * Small and edited in place — there are a dozen of these, not a thousand, so a separate editor
 * screen for each would be more navigation than content.
 */
export const LabelList = () => {
  const {t} = useTranslation("support_agent");
  const {notify} = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#A855F7");
  const [pendingDelete, setPendingDelete] = useState<Label | null>(null);

  const labels = useResource(useCallback((signal: AbortSignal) => supportApi.labels.list(signal), []));
  const create = useMutation(
    useCallback((payload: Partial<Label>) => supportApi.labels.create(payload), []),
  );
  const remove = useMutation(useCallback((id: string) => supportApi.labels.remove(id), []));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await create.run({name: name.trim(), color});
    if (outcome.ok) {
      setName("");
      notify(t("labels.saved"));
      labels.reload();
    }
  };

  const columns: Column<Label>[] = [
    {
      key: "name",
      header: t("labels.name"),
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{backgroundColor: row.color ?? "var(--color-neutral-600)"}}
          />
          {row.name}
        </span>
      ),
    },
    {key: "slug", header: "slug", cell: (row) => <code className="text-xs text-neutral-500">{row.slug}</code>},
    {
      key: "description",
      header: t("labels.description"),
      cell: (row) => row.description ?? <span className="text-neutral-600">—</span>,
      hideBelowLg: true,
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)}>
          <Trash size={14} />
        </Button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={t("labels.title")} />

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("labels.name")}</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("labels.color")}</span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-9 w-16 rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-900/60"
          />
        </label>
        <Button type="submit" disabled={create.pending || name.trim().length === 0}>
          <Plus size={15} /> {t("labels.new")}
        </Button>
      </form>

      {create.error ? <Alert tone="error">{create.error}</Alert> : null}

      {!labels.loading && (labels.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("labels.empty")} />
      ) : (
        <DataTable rows={labels.data ?? []} columns={columns} rowKey={(row) => row.id} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.name ?? ""}
        body={t("labels.delete_confirm")}
        confirmLabel={t("labels.title")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const outcome = await remove.run(pendingDelete.id);
          if (outcome.ok) {
            setPendingDelete(null);
            notify(t("labels.deleted"));
            labels.reload();
          }
        }}
      />
    </section>
  );
};
