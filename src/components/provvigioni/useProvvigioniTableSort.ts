"use client";

import { useCallback, useState } from "react";
import {
  nextProvvigioniSort,
  sortProvvigioniRighe,
  type ProvvigioneRigaOrdinabile,
  type ProvvigioniSortDir,
  type ProvvigioniSortField,
} from "@/lib/provvigioniListaSort";

export function useProvvigioniTableSort(
  initialField: ProvvigioniSortField = "data",
  initialDir: ProvvigioniSortDir = "desc"
) {
  const [sortField, setSortField] = useState<ProvvigioniSortField>(initialField);
  const [sortDir, setSortDir] = useState<ProvvigioniSortDir>(initialDir);

  const onSort = useCallback(
    (field: ProvvigioniSortField) => {
      const next = nextProvvigioniSort(sortField, sortDir, field);
      setSortField(next.field);
      setSortDir(next.dir);
    },
    [sortField, sortDir]
  );

  const sorted = useCallback(
    <T extends ProvvigioneRigaOrdinabile>(righe: T[]) =>
      sortProvvigioniRighe(righe, sortField, sortDir),
    [sortField, sortDir]
  );

  return { sortField, sortDir, onSort, sorted };
}
