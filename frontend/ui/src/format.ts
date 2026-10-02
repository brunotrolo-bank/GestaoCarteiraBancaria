/** Formatação pt-BR (FR-UX-011). Nenhuma métrica é calculada no front: só formatação (FR-UX-014). */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_COMPACTO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 2 });
const INTEIRO = new Intl.NumberFormat('pt-BR');

export function moeda(valor: number): string {
  return BRL.format(valor);
}

/** Ex.: R$ 2,13 bi (Intl pt-BR compacto: "bi", "mi", "mil"). */
export function moedaCompacta(valor: number): string {
  return BRL_COMPACTO.format(valor);
}

export function inteiro(valor: number): string {
  return INTEIRO.format(valor);
}

/** Razão (1 = 100%) → "93,8%". */
export function percentual(razao: number, casas = 1): string {
  return `${(razao * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** AAAA-MM-DD → dd/mm/aaaa (sem converter fuso: é data de negócio). */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Instante ISO (UTC) → dd/mm/aaaa HH:mm no fuso de Brasília. */
export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}
