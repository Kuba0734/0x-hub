import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc, toIpcError } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { toast } from "@/stores/toasts";

export const signatureKeys = {
  all: ["signatures"] as const,
  image: (id: string) => ["signatures", "image", id] as const,
};

export function useSignatures() {
  return useQuery({ queryKey: signatureKeys.all, queryFn: ipc.signatures.list });
}

/** Decrypted transparent PNG, kept in memory only. */
export function useSignatureImage(id: string) {
  return useQuery({
    queryKey: signatureKeys.image(id),
    queryFn: () => ipc.signatures.image(id),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}

export function useSignatureMutations() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: signatureKeys.all });
  const onError = (e: unknown) => toast.error(toIpcError(e).message);
  return {
    create: useMutation({
      mutationFn: (src: { png: Uint8Array } | { path: string }) =>
        "png" in src ? ipc.signatures.create(src.png) : ipc.signatures.importFile(src.path),
      onSuccess: () => {
        refresh();
        toast.show(strings.signatures.saved);
      },
      onError,
    }),
    remove: useMutation({
      mutationFn: ipc.signatures.delete,
      onSuccess: () => {
        refresh();
        toast.show(strings.signatures.deleted);
      },
      onError,
    }),
  };
}
