import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Plus, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import type {AdminCategory} from "@/lib/support/types.ts";

/** Help-centre sections. Deleting one leaves its articles standing, without a section. */
export const CategoryList = () => {
  const {t} = useTranslation("support_agent");
  const {notify} = useToast();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminCategory | null>(null);

  const categories = useResource(useCallback((signal: AbortSignal) => supportApi.help.categories(signal), []));
  const create = useMutation(
    useCallback((payload: Partial<AdminCategory>) => supportApi.help.createCategory(payload), []),
  );
  const update = useMutation(
    useCallback(
      (id: string, payload: Partial<AdminCategory>) => supportApi.help.updateCategory(id, payload),
      [],
    ),
  );
  const remove = useMutation(useCallback((id: string) => supportApi.help.removeCategory(id), []));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await create.run({name: name.trim(), status: "draft"});
    if (outcome.ok) {
      setName("");
      notify(t("categories.saved"));
      categories.reload();
    }
  };

  const columns: Column<AdminCategory>[] = [
    {key: "name", header: t("categories.name"), cell: (row) => row.name},
    {key: "slug", header: "slug", cell: (row) => <code className="text-xs text-neutral-500">{row.slug}</code>},
    {
      key: "status",
      header: t("categories.status"),
      cell: (row) => (
        <button
          type="button"
          onClick={async () => {
            const outcome = await update.run(row.id, {
              status: row.status === "published" ? "draft" : "published",
            });
            if (outcome.ok) categories.reload();
          }}
          data-fs-hover
        >
          <StatusBadge status={row.status} />
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)} data-fs-hover>
          <Trash size={14} />
        </Button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={t("categories.title")} />

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("categories.name")}</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <Button type="submit" disabled={create.pending || name.trim().length === 0}>
          <Plus size={15} /> {t("categories.new")}
        </Button>
      </form>

      {create.error ? <Alert tone="error">{create.error}</Alert> : null}

      {!categories.loading && (categories.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("categories.empty")} />
      ) : (
        <DataTable rows={categories.data ?? []} columns={columns} rowKey={(row) => row.id} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.name ?? ""}
        body={t("categories.delete_confirm")}
        confirmLabel={t("categories.title")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const outcome = await remove.run(pendingDelete.id);
          if (outcome.ok) {
            setPendingDelete(null);
            notify(t("categories.deleted"));
            categories.reload();
          }
        }}
      />
    </section>
  );
};
