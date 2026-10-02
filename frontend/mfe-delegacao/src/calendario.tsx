import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Botao, Selo, dataBR } from '@carteira/ui';
import type { Delegacao, Situacao } from '@carteira/sdk';

/** Cor da situação (mesma semântica da tabela de delegações). */
export const VARIANTE: Record<Situacao, 'neutro' | 'tag' | 'informativo' | 'atencao'> = {
  Submetida: 'atencao', Rejeitada: 'neutro', Revogada: 'neutro', Agendada: 'informativo', 'Em Vigor': 'tag', Concluída: 'neutro',
};

const diaISO = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SOMENTE_DIA = (iso: string): string => iso.slice(0, 10);

/** Grade do mês: semanas de 7 dias (domingo a sábado); dias fora do mês vêm marcados. */
export function gradeDoMes(ano: number, mes: number): { data: string; foraDoMes: boolean }[][] {
  const primeiro = new Date(ano, mes - 1, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(inicio.getDate() - primeiro.getDay());
  const semanas: { data: string; foraDoMes: boolean }[][] = [];
  const cursor = new Date(inicio);
  for (let s = 0; s < 6; s += 1) {
    const semana: { data: string; foraDoMes: boolean }[] = [];
    for (let d = 0; d < 7; d += 1) {
      semana.push({ data: diaISO(cursor), foraDoMes: cursor.getMonth() !== mes - 1 });
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(semana);
    if (cursor.getMonth() !== mes - 1 && cursor.getDay() === 0) break;
  }
  return semanas;
}

/** Delegações cujo período [início, fim] inclui o dia (comparação lexicográfica em AAAA-MM-DD). */
export function delegacoesNoDia(itens: Delegacao[], dia: string): Delegacao[] {
  return itens.filter((d) => SOMENTE_DIA(d.data_inicio) <= dia && dia <= SOMENTE_DIA(d.data_fim));
}

const ATIVAS: Situacao[] = ['Agendada', 'Em Vigor'];

/** Delegações ativas que vencem em até `dias` a partir da referência (exclui o dia da referência). */
export function aVencer(itens: Delegacao[], referencia: string, dias = 7): Delegacao[] {
  const ref = SOMENTE_DIA(referencia);
  return itens
    .filter((d) => ATIVAS.includes(d.situacao) && ref < SOMENTE_DIA(d.data_fim) && SOMENTE_DIA(d.data_fim) <= deslocar(ref, dias))
    .sort((a, b) => SOMENTE_DIA(a.data_fim).localeCompare(SOMENTE_DIA(b.data_fim)));
}

function deslocar(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return diaISO(d);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Visão mensal das coberturas: cada dia mostra as delegações vigentes; abaixo, o detalhe do dia selecionado. */
export function CalendarioDelegacoes({ itens, nomes, referencia }: { itens: Delegacao[]; nomes: Map<string, string>; referencia: string }) {
  const ref = SOMENTE_DIA(referencia);
  const [ano, setAno] = React.useState(Number(ref.slice(0, 4)));
  const [mes, setMes] = React.useState(Number(ref.slice(5, 7)));
  const [selecionado, setSelecionado] = React.useState(ref);

  const mudarMes = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth() + 1);
  };
  const voltarHoje = () => {
    setAno(Number(ref.slice(0, 4)));
    setMes(Number(ref.slice(5, 7)));
    setSelecionado(ref);
  };

  const semanas = React.useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  const porDia = React.useMemo(() => {
    const m = new Map<string, Delegacao[]>();
    for (const s of semanas) for (const dia of s) m.set(dia.data, delegacoesNoDia(itens, dia.data));
    return m;
  }, [semanas, itens]);
  const doSelecionado = porDia.get(selecionado) ?? [];

  return (
    <div className="flex flex-col gap-4" aria-label="Calendário de delegações">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-heading-md capitalize text-foreground" aria-live="polite">{MESES[mes - 1]} de {ano}</p>
        <div className="flex gap-2">
          <Botao tamanho="sm" variante="fantasma" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft aria-hidden className="size-4" /></Botao>
          <Botao tamanho="sm" variante="fantasma" onClick={voltarHoje}>Hoje</Botao>
          <Botao tamanho="sm" variante="fantasma" onClick={() => mudarMes(1)} aria-label="Próximo mês"><ChevronRight aria-hidden className="size-4" /></Botao>
        </div>
      </div>
      <div role="grid" aria-label={`${MESES[mes - 1]} de ${ano}`} className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={`${d}-${i}`} role="columnheader" aria-label={['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][i]} className="pb-1 text-center text-caption text-muted-foreground">{d}</div>
        ))}
        {semanas.flat().map((dia) => {
          const lista = porDia.get(dia.data) ?? [];
          const ehRef = dia.data === ref;
          const ehSel = dia.data === selecionado;
          return (
            <button
              key={dia.data}
              type="button"
              role="gridcell"
              aria-selected={ehSel}
              aria-label={`${dia.data.slice(8, 10)} de ${MESES[mes - 1]}${lista.length > 0 ? `, ${lista.length} delegações` : ''}`}
              onClick={() => setSelecionado(dia.data)}
              className={ehSel
                ? 'flex min-h-16 flex-col items-center gap-1 rounded-md border-2 border-primary bg-card p-1'
                : 'flex min-h-16 flex-col items-center gap-1 rounded-md border border-border bg-card p-1 hover:border-primary'}
            >
              <span className={dia.foraDoMes ? 'tnum text-caption text-muted-foreground' : ehRef ? 'tnum flex size-6 items-center justify-center rounded-md bg-primary text-on-primary text-caption' : 'tnum text-caption text-foreground'}>
                {dia.data.slice(8, 10)}
              </span>
              <span className="flex flex-wrap justify-center gap-1" aria-hidden>
                {lista.slice(0, 3).map((d) => (
                  <span
                    key={d.id_delegacao}
                    title={`${d.id_posicao_origem} → ${nomes.get(d.id_gerente_delegado) ?? d.id_gerente_delegado} (${d.situacao})`}
                    className={d.situacao === 'Em Vigor' ? 'size-2 rounded-md bg-primary' : d.situacao === 'Agendada' ? 'size-2 rounded-md bg-atencao' : 'size-2 rounded-md bg-muted-foreground'}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {doSelecionado.length === 0 ? (
          <p className="text-body-md text-secondary-foreground">Nenhuma cobertura em {dataBR(selecionado)}.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {doSelecionado.map((d) => (
              <li key={d.id_delegacao} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <Selo variante={VARIANTE[d.situacao]}>{d.situacao}</Selo>
                <span className="text-body-md text-foreground">{d.id_posicao_origem} → {nomes.get(d.id_gerente_delegado) ?? d.id_gerente_delegado}</span>
                <span className="tnum text-caption text-muted-foreground">{dataBR(d.data_inicio)} a {dataBR(d.data_fim)} · {d.motivo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
