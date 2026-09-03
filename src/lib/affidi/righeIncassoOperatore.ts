export type RigaIncassoOperatore = {
  id: string;
  name: string;
  role: string;
  incassatoMese: number;
  guadagnoMese: number;
};

export function righeIncassoDaCarico(
  carico: Array<{
    id: string;
    name: string;
    role: string;
    incassatoMese?: number;
    guadagnoMese?: number;
  }>
): RigaIncassoOperatore[] {
  return carico.map((o) => ({
    id: o.id,
    name: o.name,
    role: o.role,
    incassatoMese: o.incassatoMese ?? 0,
    guadagnoMese: o.guadagnoMese ?? 0,
  }));
}
