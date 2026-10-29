import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useFolders } from "../queries";
import { buildTree } from "./folderTree";

/**
 * The folder shown on the Documents page lives in the URL (`?folder=<id>`), so Back/Forward
 * walk through folders and opening a document returns to the same place.
 */
export function useCurrentFolder() {
  const folders = useFolders();
  const tree = useMemo(() => buildTree(folders.data ?? []), [folders.data]);
  const [params, setParams] = useSearchParams();
  const requested = params.get("folder");
  // A folder that was deleted (or not loaded yet) falls back to the top level.
  const current = requested && tree.byId.has(requested) ? requested : null;

  const open = useCallback((id: string | null) => setParams(id ? { folder: id } : {}), [setParams]);
  return { tree, current, open, loading: folders.isLoading };
}
