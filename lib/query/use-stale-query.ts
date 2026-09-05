import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useRef } from "react";

export interface StaleAwareResult<T> {
  data: T | undefined;
  isStale: boolean;
  isLoading: boolean;
}

export function useStaleAwareQuery<T>(options: UseQueryOptions<T>): StaleAwareResult<T> {
  const query = useQuery(options);
  const lastGoodData = useRef<T | undefined>(undefined);

  if (query.data !== undefined) {
    lastGoodData.current = query.data;
  }

  const data = query.data !== undefined ? query.data : lastGoodData.current;
  const isStale = query.isError && lastGoodData.current !== undefined;

  return { data, isStale, isLoading: query.isLoading && lastGoodData.current === undefined };
}
