import { type ColumnDef } from '@tanstack/react-table';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRightLeft } from 'lucide-react';
import { Botao, Cartao, CartaoDescricao, CartaoTitulo, EstadoErro, Esqueleto, Kpi, Selo, SemPermissao, TabelaDados, inteiro, moeda, moedaCompacta, percentual } from '@carteira/ui';
import { ApiErro, useConsulta, type PropsMfe, type ResumoPosicao } from '@carteira/sdk';

/** MFE do domínio 05 — Torre de Controle (GG) e resumo da própria carteira. Nada é calculado aqui: só exibe o que a API devolve. */
export default function Cockpit({ api, sessao, versao, ehGerenteGeral, emitir }: PropsMfe) {
  const { dados, erro, carregando, recarregar } = useConsulta(() => api.agencia(), [sessao.papel, sessao.dataSimulada, versao]);

  if (carregando && !dados) return <Carregando />;
  if (erro) return erro instanceof ApiErro && (erro.codigo === 'ACESSO_NEGADO' || erro.status === 403) ? <SemPermissao /> : <EstadoErro mensagem={erro.message} aoTentar={recarregar} />;
  if (!dados) return null;

  const agencia = dados.escopo === 'Agencia';
  const grafico = dados.posicoes.map((p) => ({ nome: p.id_posicao.replace('POS-AG01-', 'POS-'), pct: Math.round(p.utilizacao * 1000) / 10, alerta: p.desbalanceamento }));
  const limite = Math.max(130, ...grafico.map((g) => g.pct + 15));

  const colunas: ColumnDef<ResumoPosicao, any>[] = [
    { id: 'posicao', header: 'Posição', accessorFn: (p) => p.nome_posicao, cell: ({ row }) => (<div><p className="text-body-md text-foreground">{row.original.nome_posicao}</p><p className="text-caption text-muted-foreground">{row.original.id_posicao}</p></div>), meta: { rotulo: 'Posição' } },
    { id: 'titular', header: 'Titular', accessorFn: (p) => p.titular?.nome ?? 'Vaga', cell: ({ row }) => row.original.titular ? row.original.titular.nome : <Selo variante="atencao">Vaga</Selo>, meta: { rotulo: 'Titular' } },
    { accessorKey: 'segmento_especialidade', header: 'Segmento', meta: { rotulo: 'Segmento' } },
    { accessorKey: 'clientes_ativos', header: 'Clientes', cell: ({ getValue }) => inteiro(getValue<number>()), meta: { numerica: true, rotulo: 'Clientes' } },
    {
      id: 'utilizacao', header: 'Utilização', accessorFn: (p) => p.utilizacao,
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-end gap-2">
          {row.original.desbalanceamento === 'Acima' ? <Selo variante="critico">Acima do limite</Selo> : row.original.desbalanceamento === 'Abaixo' ? <Selo variante="atencao">Abaixo do mínimo</Selo> : null}
          <span>{percentual(row.original.utilizacao)}</span>
        </span>
      ),
      meta: { numerica: true, rotulo: 'Utilização' },
    },
    { accessorKey: 'aum_total', header: 'AUM', cell: ({ getValue }) => moeda(getValue<number>()), meta: { numerica: true, rotulo: 'AUM' } },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Selo variante="neutro">{getValue<string>()}</Selo>, meta: { rotulo: 'Status' } },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-foreground">{agencia ? 'Torre de Controle' : 'Resumo da minha carteira'}</h1>
          <p className="mt-1 text-body-md text-secondary-foreground">
            {agencia ? 'Visão consolidada da agência: todas as posições, como se fosse uma agência bancária.' : 'Você vê apenas a carteira da sua posição e as coberturas temporárias vigentes.'}
          </p>
        </div>
        {ehGerenteGeral ? (
          <Botao onClick={() => emitir({ tipo: 'abrir-redistribuicao' })}>
            <ArrowRightLeft aria-hidden className="size-4" /> Simular redistribuição
          </Botao>
        ) : null}
      </header>

      <section aria-label="Indicadores" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi destaque rotulo="AUM total" valor={moedaCompacta(dados.aum_total)} dica={moeda(dados.aum_total)} />
        <Kpi rotulo="Clientes ativos" valor={inteiro(dados.total_clientes)} dica={`AUM médio ${moedaCompacta(dados.aum_medio_por_cliente)}`} />
        <Kpi rotulo="Penetração média de produtos" valor={percentual(dados.penetracao_media, 0)} dica={`${dados.penetracao_por_produto.length} produtos no catálogo`} />
        <Kpi rotulo="Posições em alerta" valor={inteiro(dados.posicoes_em_alerta)} dica="Acima de 100% ou abaixo de 50% da capacidade" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Gráficos">
        <Cartao className="lg:col-span-2">
          <CartaoTitulo>Capacidade por posição</CartaoTitulo>
          <CartaoDescricao>Utilização = clientes ativos ÷ capacidade. Linhas: mínimo de 50% e limite de 100%.</CartaoDescricao>
          <div className="mt-4 h-72" role="img" aria-label={`Utilização de capacidade: ${grafico.map((g) => `${g.nome} ${g.pct}%`).join('; ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} layout="vertical" margin={{ left: 8, right: 56, top: 28, bottom: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-hairline)" />
                <XAxis type="number" domain={[0, limite]} ticks={[0, 25, 50, 75, 100, 125, 150].filter((t) => t <= limite)} tickFormatter={(v) => `${v}%`} className="tnum" tick={{ fill: 'var(--color-ink-mute)', fontSize: 12 }} />
                <YAxis type="category" dataKey="nome" width={64} tick={{ fill: 'var(--color-ink-secondary)', fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Utilização']} cursor={{ fill: 'var(--color-canvas-soft)' }} contentStyle={{ borderRadius: 8, borderColor: 'var(--color-hairline)' }} />
                <ReferenceLine x={100} stroke="var(--color-ink-mute)" strokeDasharray="4 4" label={{ value: '100%', position: 'top', fill: 'var(--color-ink-mute)', fontSize: 11 }} />
                <ReferenceLine x={50} stroke="var(--color-ink-mute)" strokeDasharray="4 4" label={{ value: '50%', position: 'top', fill: 'var(--color-ink-mute)', fontSize: 11 }} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={22}>
                  {grafico.map((g) => <Cell key={g.nome} fill={g.alerta ? 'var(--color-chart-4)' : 'var(--color-chart-1)'} />)}
                  <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`} fill="var(--color-ink)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        <Cartao>
          <CartaoTitulo>Clientes por segmento</CartaoTitulo>
          <CartaoDescricao>Clientes ativos e AUM de cada segmento.</CartaoDescricao>
          <ul className="mt-4 flex flex-col gap-3">
            {dados.por_segmento.map((s) => {
              const max = Math.max(...dados.por_segmento.map((x) => x.clientes), 1);
              return (
                <li key={s.segmento}>
                  <div className="flex items-baseline justify-between text-body-md">
                    <span className="text-foreground">{s.segmento}</span>
                    <span className="tnum text-body-tabular text-secondary-foreground">{inteiro(s.clientes)} · {moedaCompacta(s.aum)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-pill bg-secondary" aria-hidden>
                    <div className="h-2 rounded-pill bg-chart-2" style={{ width: `${(s.clientes / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </section>

      <section aria-label="Posições" className="flex flex-col gap-3">
        <h2 className="text-heading-lg text-foreground">Posições</h2>
        <TabelaDados colunas={colunas} dados={dados.posicoes} rotulo="Posições" tamanhoPagina={10} buscaPlaceholder="Buscar posição ou titular…" />
      </section>

      <p className="text-caption text-secondary-foreground">Calculado em {new Date(dados.calculado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · valores em reais.</p>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <Esqueleto className="h-10 w-72" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-28" />)}</div>
      <Esqueleto className="h-80" />
    </div>
  );
}
