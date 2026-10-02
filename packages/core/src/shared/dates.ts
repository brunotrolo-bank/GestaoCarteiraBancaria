/** Datas de negócio são dias no fuso America/Sao_Paulo, em ISO 8601 (AAAA-MM-DD), intervalos fechados (Q-02). */
export type ISODate = string;
export const FUSO = 'America/Sao_Paulo';

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(valor: unknown): valor is ISODate {
  if (typeof valor !== 'string' || !RE_DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export function addDays(data: ISODate, dias: number): ISODate {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Dia (no fuso de negócio) em que cai um instante. */
export function diaDe(instante: Date): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

/** `inicio <= dia <= fim` (fim nulo = aberto). */
export function noIntervalo(dia: ISODate, inicio: ISODate, fim: ISODate | null): boolean {
  return dia >= inicio && (fim === null || dia <= fim);
}

export function intervalosSobrepostos(
  a: { inicio: ISODate; fim: ISODate | null },
  b: { inicio: ISODate; fim: ISODate | null },
): boolean {
  const aTerminaAntes = a.fim !== null && a.fim < b.inicio;
  const bTerminaAntes = b.fim !== null && b.fim < a.inicio;
  return !aTerminaAntes && !bTerminaAntes;
}
