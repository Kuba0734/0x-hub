import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GlassButton, GlassDialog, GlassInput } from "@/components/glass";
import { ipc, toIpcError, type Category } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";
import { docKeys } from "../queries";

function CategoryRow({ category, onChanged }: { category: Category; onChanged: () => void }) {
  const [name, setName] = useState(category.name);
  const save = async () => {
    if (name.trim() === category.name) return;
    try {
      await ipc.categories.rename(category.id, name);
      onChanged();
    } catch (e) {
      toast.error(toIpcError(e).message);
      setName(category.name);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <GlassInput
        label={strings.documents.categoryName}
        hideLabel
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        wrapperClassName="flex-1"
        className="h-9"
      />
      <GlassButton
        variant="ghost"
        size="sm"
        iconOnly
        icon={<Trash2 />}
        aria-label={`${strings.common.delete} ${category.name}`}
        onClick={async () => {
          await ipc.categories.delete(category.id).catch((e) => toast.error(toIpcError(e).message));
          onChanged();
        }}
      />
    </div>
  );
}

export function CategoriesDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const changed = () => {
    void qc.invalidateQueries({ queryKey: docKeys.categories });
    void qc.invalidateQueries({ queryKey: docKeys.all });
  };
  const add = async () => {
    if (!draft.trim()) return;
    try {
      await ipc.categories.create(draft);
      setDraft("");
      changed();
    } catch (e) {
      toast.error(toIpcError(e).message);
    }
  };

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={strings.documents.manageCategories}
      description={strings.documents.categoryDeleteHint}
    >
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} onChanged={changed} />
        ))}
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <GlassInput
            label={strings.documents.newCategory}
            hideLabel
            placeholder={strings.documents.newCategory}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            wrapperClassName="flex-1"
            className="h-9"
          />
          <GlassButton type="submit" size="sm" icon={<Plus />} disabled={!draft.trim()}>
            {strings.common.add}
          </GlassButton>
        </form>
      </div>
    </GlassDialog>
  );
}
