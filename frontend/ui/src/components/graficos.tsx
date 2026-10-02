import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../cn';

/** Gráficos do design system: só tokens (chart-1..5), sempre com resumo textual para leitores de tela e legenda com valores. */
export const CORES_GRAFICO = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-5)'];
const eixo = { fill: 'var(--color-ink-mute)', fontSize: 12 };
const dica = { borderRadius: 8, borderColor: 'var(--color-hairline)', fontSize: 12 };

export interface FatiaRosca { rotulo: string; valor: number }

/** Rosca com total no centro e legenda tabular (valor e percentual) — nenhuma informação depende só da cor. */
export function Rosca({ dados, formatar, total, rotuloTotal }: { dados: FatiaRosca[]; formatar: (v: number) => string; total: string; rotuloTotal: string }) {
  const soma = dados.reduce((a, d) => a + d.valor, 0) || 1;
  const resumo = dados.map((d) => `${d.rotulo} ${formatar(d.valor)}`).join('; ');
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-40 shrink-0" role="img" aria-label={`${rotuloTotal}: ${resumo}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="rotulo" innerRadius="64%" outerRadius="100%" paddingAngle={dados.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {dados.map((d, i) => <Cell key={d.rotulo} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatar(Number(v))} contentStyle={dica} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tnum text-heading-sm text-foreground">{total}</span>
          <span className="text-micro text-secondary-foreground">{rotuloTotal}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {dados.map((d, i) => (
          <li key={d.rotulo} className="flex items-center justify-between gap-3 text-body-md">
            <span className="inline-flex items-center gap-2 text-foreground">
              <span aria-hidden className="size-3 rounded-sm" style={{ background: CORES_GRAFICO[i % CORES_GRAFICO.length] }} />
              {d.rotulo}
            </span>
            <span className="tnum text-body-tabular text-secondary-foreground">{formatar(d.valor)} · {Math.round((d.valor / soma) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Colunas verticais (histogramas de faixas). `destaque` pinta uma coluna com a cor de alerta. */
export function Colunas({ dados, chave, rotuloValor, formatar = String, altura = 'h-56', destaque }: {
  dados: Record<string, string | number>[]; chave: string; rotuloValor: string; formatar?: (v: number) => string; altura?: string; destaque?: (linha: Record<string, string | number>) => boolean;
}) {
  const resumo = dados.map((d) => `${d[chave]}: ${formatar(Number(d.valor))}`).join('; ');
  return (
    <div className={cn('w-full', altura)} role="img" aria-label={`${rotuloValor}. ${resumo}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
          <XAxis dataKey={chave} tick={eixo} tickLine={false} interval={0} />
          <YAxis tick={eixo} tickLine={false} axisLine={false} width={36} allowDecimals={false} className="tnum" />
          <Tooltip formatter={(v) => [formatar(Number(v)), rotuloValor]} cursor={{ fill: 'var(--color-canvas-soft)' }} contentStyle={dica} />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: 'top', fill: 'var(--color-ink)', fontSize: 11, formatter: (v: unknown) => formatar(Number(v)) }}>
            {dados.map((d, i) => <Cell key={i} fill={destaque?.(d) ? 'var(--color-chart-4)' : 'var(--color-chart-1)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais ordenadas (ranking e canais). */
export function BarrasHorizontais({ dados, rotuloValor, formatar = String, altura = 'h-48' }: { dados: { rotulo: string; valor: number }[]; rotuloValor: string; formatar?: (v: number) => string; altura?: string }) {
  const resumo = dados.map((d) => `${d.rotulo}: ${formatar(d.valor)}`).join('; ');
  return (
    <div className={cn('w-full', altura)} role="img" aria-label={`${rotuloValor}. ${resumo}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-hairline)" />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="rotulo" width={132} tick={{ ...eixo, fill: 'var(--color-ink-secondary)' }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => [formatar(Number(v)), rotuloValor]} cursor={{ fill: 'var(--color-canvas-soft)' }} contentStyle={dica} />
          <Bar dataKey="valor" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} label={{ position: 'right', fill: 'var(--color-ink)', fontSize: 11, formatter: (v: unknown) => formatar(Number(v)) }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SerieTempo { chave: string; rotulo: string }

/** Linhas ao longo do tempo (12 meses). A 1ª série é a principal; a legenda mostra o total de cada uma. */
export function LinhasTempo({ dados, series, rotulo, altura = 'h-60' }: { dados: Record<string, string | number>[]; series: SerieTempo[]; rotulo: string; altura?: string }) {
  const mes = (m: string): string => ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m.slice(5, 7)) - 1] ?? m;
  const total = (chave: string): number => dados.reduce((a, d) => a + Number(d[chave] ?? 0), 0);
  return (
    <div>
      <div className={cn('w-full', altura)} role="img" aria-label={`${rotulo}: ${series.map((s) => `${s.rotulo} ${total(s.chave)} no período`).join('; ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
            <XAxis dataKey="mes" tickFormatter={mes} tick={eixo} tickLine={false} />
            <YAxis tick={eixo} tickLine={false} axisLine={false} width={32} allowDecimals={false} className="tnum" />
            <Tooltip labelFormatter={(m) => `${mes(String(m))}/${String(m).slice(0, 4)}`} contentStyle={dica} />
            {series.map((s, i) => (
              <Line key={s.chave} type="monotone" dataKey={s.chave} name={s.rotulo} stroke={CORES_GRAFICO[i % CORES_GRAFICO.length]} strokeWidth={i === 0 ? 3 : 2} strokeDasharray={i > 1 ? '4 3' : undefined} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {series.map((s, i) => (
          <li key={s.chave} className="inline-flex items-center gap-2 text-caption text-secondary-foreground">
            <span aria-hidden className="h-0.5 w-5 rounded-pill" style={{ background: CORES_GRAFICO[i % CORES_GRAFICO.length] }} />
            {s.rotulo}: <span className="tnum text-foreground">{total(s.chave)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Curva de concentração (Pareto): % acumulado do AUM × % de clientes, com a diagonal da distribuição igualitária. */
export function CurvaConcentracao({ curva }: { curva: { pct_clientes: number; pct_aum: number }[] }) {
  const meio = curva.find((c) => c.pct_clientes === 50)?.pct_aum ?? 0;
  return (
    <div className="h-56 w-full" role="img" aria-label={`Concentração do AUM: os 50% maiores clientes concentram ${meio}% do AUM`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={curva} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-hairline)" />
          <XAxis dataKey="pct_clientes" type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={eixo} tickLine={false} />
          <YAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={eixo} tickLine={false} axisLine={false} width={44} className="tnum" />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--color-ink-mute)" strokeDasharray="4 4" />
          <Tooltip formatter={(v) => [`${v}%`, 'AUM acumulado']} labelFormatter={(v) => `${v}% dos clientes (do maior ao menor)`} contentStyle={dica} />
          <Area type="monotone" dataKey="pct_aum" stroke="var(--color-chart-1)" strokeWidth={3} fill="var(--color-chart-1)" fillOpacity={0.14} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mapa de calor em tabela: a intensidade vem da proporção de cada célula; o número sempre aparece. */
export function MapaCalor({ colunas, linhas, rotulo }: { colunas: string[]; linhas: { id: string; rotulo: string; sub?: string; valores: number[] }[]; rotulo: string }) {
  const max = Math.max(1, ...linhas.flatMap((l) => l.valores));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-body-md" aria-label={rotulo}>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left text-caption text-secondary-foreground">Posição</th>
            {colunas.map((c) => <th key={c} scope="col" className="px-2 py-1 text-center text-caption text-secondary-foreground">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <th scope="row" className="px-2 py-1 text-left font-normal">
                <span className="block text-foreground">{l.rotulo}</span>
                {l.sub ? <span className="block text-micro text-secondary-foreground">{l.sub}</span> : null}
              </th>
              {l.valores.map((v, i) => (
                <td key={colunas[i]} className="tnum rounded-md px-2 py-2 text-center text-body-tabular text-foreground"
                  style={{ background: `color-mix(in srgb, var(--color-primary) ${Math.round((v / max) * 38)}%, var(--color-canvas))` }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ICONE_INSIGHT = { critico: CircleAlert, atencao: TriangleAlert, info: Info, positivo: CircleCheck } as const;
const ROTULO_INSIGHT = { critico: 'Crítico', atencao: 'Atenção', info: 'Informação', positivo: 'Positivo' } as const;
export interface InsightItem { severidade: keyof typeof ICONE_INSIGHT; titulo: string; detalhe: string; destino?: string }

/** Insights em linguagem de negócio: ícone + rótulo textual (severidade nunca só por cor) e ação opcional. */
export function ListaInsights({ itens, rotuloAcao, aoAbrir }: { itens: InsightItem[]; rotuloAcao: (destino: string) => string; aoAbrir?: (destino: string) => void }) {
  if (itens.length === 0) return <p className="text-body-md text-secondary-foreground">Nenhum ponto de atenção no momento.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {itens.map((it) => {
        const Icone = ICONE_INSIGHT[it.severidade];
        const cor = it.severidade === 'critico' ? 'text-critico' : it.severidade === 'atencao' ? 'text-atencao' : it.severidade === 'positivo' ? 'text-chart-1' : 'text-informativo';
        return (
          <li key={it.titulo} className="flex gap-3 rounded-lg border border-border bg-card p-4">
            <Icone aria-hidden className={cn('mt-0.5 size-5 shrink-0', cor)} />
            <div className="min-w-0 flex-1">
              <p className="text-micro-cap text-secondary-foreground">{ROTULO_INSIGHT[it.severidade]}</p>
              <p className="text-body-md text-foreground">{it.titulo}</p>
              <p className="mt-1 text-caption text-secondary-foreground">{it.detalhe}</p>
              {it.destino && aoAbrir ? (
                <button type="button" onClick={() => aoAbrir(it.destino!)} className="mt-2 text-button-sm text-primary-deep underline underline-offset-4 hover:text-primary-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {rotuloAcao(it.destino)}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface ItemRanking { id: string; titulo: string; subtitulo?: string; valor: string; apoio?: string; aoClicar?: () => void }

/** Ranking/lista de ações (clientes prioritários, oportunidades): cada linha tem texto completo; clicar abre o detalhe. */
export function ListaRanking({ itens, vazio }: { itens: ItemRanking[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-body-md text-secondary-foreground">{vazio}</p>;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {itens.map((it, i) => {
        const conteudo = (
          <>
            <span aria-hidden className="tnum w-5 shrink-0 text-caption text-secondary-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-body-md text-foreground">{it.titulo}</span>
              {it.subtitulo ? <span className="block truncate text-caption text-secondary-foreground">{it.subtitulo}</span> : null}
            </span>
            <span className="shrink-0 text-right">
              <span className="tnum block text-body-tabular text-foreground">{it.valor}</span>
              {it.apoio ? <span className="block text-caption text-secondary-foreground">{it.apoio}</span> : null}
            </span>
          </>
        );
        return (
          <li key={it.id}>
            {it.aoClicar ? (
              <button type="button" onClick={it.aoClicar} className="flex min-h-12 w-full items-center gap-3 rounded-md px-1 py-2 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{conteudo}</button>
            ) : (
              <div className="flex min-h-12 items-center gap-3 px-1 py-2">{conteudo}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Utilização de capacidade por posição, com as linhas de 50% (mínimo) e 100% (limite). */
export function BarrasCapacidade({ dados }: { dados: { nome: string; pct: number; alerta: 'Acima' | 'Abaixo' | null }[] }) {
  const limite = Math.max(130, ...dados.map((g) => g.pct + 15));
  return (
    <div className="h-72 w-full" role="img" aria-label={`Utilização de capacidade: ${dados.map((g) => `${g.nome} ${g.pct}%`).join('; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 56, top: 28, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-hairline)" />
          <XAxis type="number" domain={[0, limite]} ticks={[0, 25, 50, 75, 100, 125, 150].filter((t) => t <= limite)} tickFormatter={(v) => `${v}%`} className="tnum" tick={eixo} />
          <YAxis type="category" dataKey="nome" width={64} tick={{ ...eixo, fill: 'var(--color-ink-secondary)' }} />
          <Tooltip formatter={(v) => [`${v}%`, 'Utilização']} cursor={{ fill: 'var(--color-canvas-soft)' }} contentStyle={dica} />
          <ReferenceLine x={100} stroke="var(--color-ink-mute)" strokeDasharray="4 4" label={{ value: '100%', position: 'top', fill: 'var(--color-ink-mute)', fontSize: 11 }} />
          <ReferenceLine x={50} stroke="var(--color-ink-mute)" strokeDasharray="4 4" label={{ value: '50%', position: 'top', fill: 'var(--color-ink-mute)', fontSize: 11 }} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false} label={{ position: 'right', fill: 'var(--color-ink)', fontSize: 12, formatter: (v: unknown) => `${v}%` }}>
            {dados.map((g) => <Cell key={g.nome} fill={g.alerta ? 'var(--color-chart-4)' : 'var(--color-chart-1)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
