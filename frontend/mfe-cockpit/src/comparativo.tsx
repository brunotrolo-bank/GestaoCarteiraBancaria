import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Campo, CampoSelecao, Cartao, CartaoDescricao, CartaoTitulo, EstadoErro, Esqueleto, LinhasComparadas, Rotulo, TabelaDados, dataBR, inteiro, moedaCompacta } from '@carteira/ui';
import { useConsulta, type Api, type Comparativo, type MetricaComparada, type Sessao } from '@carteira/sdk';

type Preset = '7' | '30' | '90' | 'mes-anterior' | 'mes-atual' | 'personalizado';
const PRESETS: { valor: Preset; rotulo: string }[] = [
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
  { valor: 'mes-atual', rotulo: 'Mês atual até hoje' },
  { valor: 'mes-anterior', rotulo: 'Mês anterior (completo)' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

const dia = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
const somarDias = (iso: string, n: number): string => new Date(dia(iso) + n * 86_400_000).toISOString().slice(0, 10);

/** Janela [inicio, fim] de cada atalho, em relação à data de referência (hoje ou a data da demonstração). */
export function janelaDoPreset(preset: Exclude<Preset, 'personalizado'>, hoje: string): { inicio: string; fim: string } {
  if (preset === 'mes-atual') return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };
  if (preset === 'mes-anterior') {
    const fimAnterior = somarDias(`${hoje.slice(0, 8)}01`, -1);
    return { inicio: `${fimAnterior.slice(0, 8)}01`, fim: fimAnterior };
  }
  return { inicio: somarDias(hoje, -(Number(preset) - 1)), fim: hoje };
}

function valor(m: MetricaComparada, v: number): string {
  if (m.unidade === 'reais') return moedaCompacta(v);
  if (m.unidade === 'percentual') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  return inteiro(v);
}

const ROTULO_LEITURA = { melhora: 'Melhora', piora: 'Piora', estavel: 'Estável', neutra: 'Informativo' } as const;

function Variacao({ m }: { m: MetricaComparada }) {
  const Icone = m.variacao > 0 ? ArrowUp : m.variacao < 0 ? ArrowDown : Minus;
  const pontos = m.unidade === 'percentual';
  const texto = m.variacao_pct === null ? (m.variacao === 0 ? '0%' : 'novo') : `${m.variacao_pct > 0 ? '+' : ''}${m.variacao_pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  // O ícone carrega a cor; o texto fica na cor de tinta (o vermelho do DESIGN não atinge 4,5:1 sobre branco).
  const cor = m.leitura === 'melhora' ? 'text-chart-1' : m.leitura === 'piora' ? 'text-critico' : 'text-secondary-foreground';
  return (
    <span className="inline-flex items-center gap-1 text-caption text-foreground">
      <Icone aria-hidden className={`size-3.5 ${cor}`} />
      <span className="tnum">{pontos ? `${m.variacao > 0 ? '+' : ''}${m.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.` : texto}</span>
      <span className="text-secondary-foreground">· {ROTULO_LEITURA[m.leitura]}</span>
    </span>
  );
}

/** Comparativo entre períodos: o período escolhido contra o imediatamente anterior, de mesma duração. */
export function PainelComparativo({ api, sessao, versao }: { api: Api; sessao: Sessao; versao: number }) {
  const hoje = sessao.dataSimulada ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [preset, setPreset] = React.useState<Preset>('30');
  const [custom, setCustom] = React.useState<{ inicio: string; fim: string }>({ inicio: somarDias(hoje, -29), fim: hoje });
  const janela = preset === 'personalizado' ? custom : janelaDoPreset(preset, hoje);
  const valida = janela.inicio <= janela.fim && janela.fim <= hoje && /^\d{4}-\d{2}-\d{2}$/.test(janela.inicio) && /^\d{4}-\d{2}-\d{2}$/.test(janela.fim);
  const { dados, erro, carregando, recarregar } = useConsulta<Comparativo | null>(() => (valida ? api.comparativo(janela.inicio, janela.fim) : Promise.resolve(null)), [sessao.papel, sessao.dataSimulada, versao, janela.inicio, janela.fim, valida]);

  const colunas: ColumnDef<Comparativo['por_posicao'][number], any>[] = [
    { id: 'posicao', header: 'Posição', accessorFn: (p) => p.nome_posicao, cell: ({ row }) => (<div><p className="text-body-md text-foreground">{row.original.nome_posicao}</p><p className="text-caption text-muted-foreground">{row.original.id_posicao}</p></div>), meta: { rotulo: 'Posição' } },
    ...([['interacoes', 'Interações'], ['contratacoes', 'Contratações'], ['novos_clientes', 'Novos clientes']] as const).map(([k, titulo]) => ({
      id: k, header: titulo, accessorFn: (p: Comparativo['por_posicao'][number]) => p[k].atual,
      cell: ({ row }: { row: { original: Comparativo['por_posicao'][number] } }) => {
        const d = row.original[k].atual - row.original[k].anterior;
        return <span className="tnum">{inteiro(row.original[k].atual)} <span className="text-secondary-foreground">(antes {inteiro(row.original[k].anterior)}, {d > 0 ? '+' : ''}{d})</span></span>;
      },
      meta: { numerica: true, rotulo: titulo },
    })),
  ];

  return (
    <section aria-label="Comparativo entre períodos" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-heading-lg text-foreground">Comparativo entre períodos</h2>
          <p className="mt-1 text-body-md text-secondary-foreground">O período escolhido contra o imediatamente anterior, com a mesma duração.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <CampoSelecao id="periodo-preset" rotulo="Período" valor={preset} aoMudar={(v) => setPreset(v as Preset)} opcoes={PRESETS} />
          {preset === 'personalizado' ? (
            <>
              <div><Rotulo htmlFor="periodo-inicio">De</Rotulo><Campo id="periodo-inicio" type="date" className="tnum w-40" max={hoje} value={custom.inicio} onChange={(e) => setCustom((c) => ({ ...c, inicio: e.target.value }))} /></div>
              <div><Rotulo htmlFor="periodo-fim">Até</Rotulo><Campo id="periodo-fim" type="date" className="tnum w-40" max={hoje} value={custom.fim} onChange={(e) => setCustom((c) => ({ ...c, fim: e.target.value }))} /></div>
            </>
          ) : null}
        </div>
      </div>

      {!valida ? <p role="alert" className="text-body-md text-foreground">Informe um período válido: o início não pode ser depois do fim, nem o fim depois de {dataBR(hoje)}.</p> : null}
      {erro ? <EstadoErro mensagem={erro.message} aoTentar={recarregar} /> : null}
      {valida && carregando && !dados ? <Esqueleto className="h-64" /> : null}
      {dados ? (
        <>
          <p className="text-caption text-secondary-foreground">
            Atual: <span className="tnum text-foreground">{dataBR(dados.atual.inicio)} a {dataBR(dados.atual.fim)}</span> · Anterior: <span className="tnum text-foreground">{dataBR(dados.anterior.inicio)} a {dataBR(dados.anterior.fim)}</span> ({dados.dias} dias cada)
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {dados.metricas.map((m) => (
              <Cartao key={m.chave} className="p-4">
                <p className="text-caption text-secondary-foreground">{m.rotulo}</p>
                <p className="tnum mt-1 text-display-md text-foreground">{valor(m, m.atual)}</p>
                <p className="tnum text-caption text-secondary-foreground">antes: {valor(m, m.anterior)}</p>
                <div className="mt-1"><Variacao m={m} /></div>
              </Cartao>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Cartao>
              <CartaoTitulo>Interações ao longo do período</CartaoTitulo>
              <CartaoDescricao>Cada ponto soma uma faixa de dias; a linha tracejada é o período anterior.</CartaoDescricao>
              <div className="mt-4"><LinhasComparadas rotulo="Interações" dados={dados.serie.map((s) => ({ rotulo: dataBR(s.inicio_atual).slice(0, 5), atual: s.interacoes.atual, anterior: s.interacoes.anterior }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Contratações ao longo do período</CartaoTitulo>
              <CartaoDescricao>Produtos contratados por faixa de dias, contra o período anterior.</CartaoDescricao>
              <div className="mt-4"><LinhasComparadas rotulo="Contratações" dados={dados.serie.map((s) => ({ rotulo: dataBR(s.inicio_atual).slice(0, 5), atual: s.contratacoes.atual, anterior: s.contratacoes.anterior }))} /></div>
            </Cartao>
          </div>
          <TabelaDados colunas={colunas} dados={dados.por_posicao} rotulo="Comparativo por posição" tamanhoPagina={10} />
          <ul className="flex flex-col gap-1 text-caption text-secondary-foreground">{dados.ressalvas.map((r) => <li key={r}>{r}</li>)}</ul>
        </>
      ) : null}
    </section>
  );
}
