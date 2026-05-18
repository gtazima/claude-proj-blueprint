import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fieldNotesApi,
  type CreateFieldNotePayload,
  type FieldNoteFilters,
} from "../api/fieldNotes";

export function useFieldNotes(filters: FieldNoteFilters = {}) {
  return useQuery({
    queryKey: ["field-notes", filters],
    queryFn: () => fieldNotesApi.list(filters),
    refetchInterval: 60_000,
  });
}

export function useCreateFieldNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFieldNotePayload) => fieldNotesApi.create(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["field-notes"] }),
  });
}
