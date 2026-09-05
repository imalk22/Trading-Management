import { useQuery, type UseQueryOptions, hashKey } from "@tanstack/react-query";
import { useRef } from "react";

export interface StaleAwareResult<T> {
  data: T | undefined;
  isStale: boolean;
  isLoading: boolean;
}

export function useStaleAwareQuery<T>(options: UseQueryOptions<T>): StaleAwareResult<T> {
  const query = useQuery(options);
  const serializedKey = hashKey(options.queryKey);
  const lastGoodData = useRef<{ key: string; data: T } | undefined>(undefined);

  if (query.data !== undefined) {
    lastGoodData.current = { key: serializedKey, data: query.data };
  }

  const hasMatchingCachedData = lastGoodData.current?.key === serializedKey;
  const data =
    query.data !== undefined
      ? query.data
      : hasMatchingCachedData
        ? lastGoodData.current!.data
        : undefined;
  const isStale = query.isError && hasMatchingCachedData;

  return { data, isStale, isLoading: query.isLoading && !hasMatchingCachedData };
}
