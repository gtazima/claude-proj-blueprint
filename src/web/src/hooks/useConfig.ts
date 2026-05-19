import { useQuery } from "@tanstack/react-query";
import { configApi, type Person, type Tag } from "../api/config.ts";

export function usePeople() {
  return useQuery<Person[]>({
    queryKey: ["config", "people"],
    queryFn: configApi.listPeople,
    staleTime: 5 * 60_000,
  });
}

export function useActivityTypes() {
  return useQuery<Tag[]>({
    queryKey: ["config", "activity-types"],
    queryFn: configApi.listActivityTypes,
    staleTime: 5 * 60_000,
  });
}

export function useCultures() {
  return useQuery<Tag[]>({
    queryKey: ["config", "cultures"],
    queryFn: configApi.listCultures,
    staleTime: 5 * 60_000,
  });
}

export function useAmbientes() {
  return useQuery<Tag[]>({
    queryKey: ["config", "ambientes"],
    queryFn: configApi.listAmbientes,
    staleTime: 5 * 60_000,
  });
}

export function useLotes() {
  return useQuery<Tag[]>({
    queryKey: ["config", "lotes"],
    queryFn: configApi.listLotes,
    staleTime: 5 * 60_000,
  });
}

export function usePersonName(slug: string): string {
  const { data: people } = usePeople();
  return people?.find((p) => p.slug === slug)?.name ?? slug;
}
