import { type ColumnDef } from '@tanstack/react-table';
import { ArrowRightLeft } from 'lucide-react';
import { BarrasCapacidade, BarrasHorizontais, Botao, Cartao, CartaoDescricao, CartaoTitulo, Colunas, CurvaConcentracao, EstadoErro, Esqueleto, Kpi, LinhasTempo, ListaInsights, ListaRanking, MapaCalor, Rosca, Selo, SemPermissao, TabelaDados, inteiro, moeda, moedaCompacta, percentual } from '@carteira/ui';
import { ApiErro, useConsulta, type PropsMfe, type ResumoPosicao } from '@carteira/sdk';
import { PainelComparativo } from './comparativo';
import { PainelMetas } from './metas';

/** MFE do domínio 05 — Torre de Controle (GG) e resumo da própria carteira. Nada é calculado aqui: só exibe o que a API devolve. */
export default function Cockpit({ api, sessao, versao, ehGerenteGeral, emitir }: PropsMfe) {
  const { dados, erro, carregando, recarregar } = useConsulta(() => api.agencia(), [sessao.papel, sessao.dataSimulada, versao]);
  const analise = useConsulta(() => api.analise(), [sessao.papel, sessao.dataSimulada, versao]).dados;

  if (carregando && !dados) return <Carregando />;
  if (erro) return erro instanceof ApiErro && (erro.codigo === 'ACESSO_NEGADO' || erro.status === 403) ? <SemPermissao /> : <EstadoErro mensagem={erro.message} aoTentar={recarregar} />;
  if (!dados) return null;

  const agencia = dados.escopo === 'Agencia';
  const grafico = dados.posicoes.map((p) => ({ nome: p.id_posicao.replace('POS-AG01-', 'POS-'), pct: Math.round(p.utilizacao * 1000) / 10, alerta: p.desbalanceamento }));
  const uniforme = dados.posicoes.every((p) => p.metas.utilizacao_minima === dados.posicoes[0]!.metas.utilizacao_minima && p.metas.utilizacao_maxima === dados.posicoes[0]!.metas.utilizacao_maxima);
  const limites = uniforme && dados.posicoes[0] ? { minima: Math.round(dados.posicoes[0].metas.utilizacao_minima * 100), maxima: Math.round(dados.posicoes[0].metas.utilizacao_maxima * 100) } : null;
  const pct1 = (v: number): string => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const abrirCliente = (idCliente: string) => emitir({ tipo: 'cliente-selecionado', idCliente });
  const ROTULO_DESTINO: Record<string, string> = { posicoes: 'Ver posições', carteira: 'Ver carteira', delegacoes: 'Ver delegações', cockpit: 'Ver Torre de Controle' };

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
        <Kpi rotulo="Posições em alerta" valor={inteiro(dados.posicoes_em_alerta)} dica="Fora dos limites de capacidade da posição" />
      </section>

      {analise ? (
        <section aria-label="O que merece atenção" className="flex flex-col gap-3">
          <h2 className="text-heading-lg text-foreground">O que merece atenção</h2>
          <ListaInsights itens={analise.insights} rotuloAcao={(d) => ROTULO_DESTINO[d] ?? 'Abrir'} aoAbrir={(d) => emitir({ tipo: 'navegar', destino: d as 'cockpit' | 'posicoes' | 'carteira' | 'delegacoes' })} />
        </section>
      ) : null}

      {analise ? (
        <section aria-label="Indicadores de relacionamento e concentração" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Kpi rotulo="Concentração nos 10 maiores" valor={pct1(analise.concentracao.top10_pct)} dica={`Maior cliente: ${pct1(analise.concentracao.maior_cliente_pct)} do AUM`} />
          <Kpi rotulo="Sem contato há mais de 90 dias" valor={inteiro(analise.engajamento.sem_contato_90d)} dica={`${pct1(analise.engajamento.pct_sem_contato)} dos clientes ativos`} />
          <Kpi rotulo="Coberturas vigentes" valor={inteiro(analise.delegacoes.vigentes)} dica={`${inteiro(analise.delegacoes.expirando_7d)} terminam em até 7 dias`} />
          <Kpi rotulo="Novos clientes em 12 meses" valor={inteiro(analise.serie_mensal.reduce((a, m) => a + m.novos_clientes, 0))} dica="Entradas na carteira (carteirização)" />
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Capacidade e segmentos">
        <Cartao className="lg:col-span-2">
          <CartaoTitulo>Capacidade por posição</CartaoTitulo>
          <CartaoDescricao>Utilização = clientes ativos ÷ capacidade. {limites ? `Linhas: mínimo de ${limites.minima}% e limite de ${limites.maxima}%.` : 'Cada posição tem seus próprios limites de alerta (veja em Metas por posição).'}</CartaoDescricao>
          <div className="mt-4"><BarrasCapacidade dados={grafico} limites={limites} /></div>
        </Cartao>
        <Cartao>
          <CartaoTitulo>AUM por segmento</CartaoTitulo>
          <CartaoDescricao>Participação de cada segmento no AUM dos clientes ativos.</CartaoDescricao>
          <div className="mt-4">
            <Rosca dados={dados.por_segmento.map((x) => ({ rotulo: x.segmento, valor: x.aum }))} formatar={moedaCompacta} total={moedaCompacta(dados.aum_total)} rotuloTotal="AUM total" />
            <p className="mt-3 text-caption text-secondary-foreground">Clientes: {dados.por_segmento.map((x) => `${x.segmento} ${inteiro(x.clientes)}`).join(' · ')}</p>
          </div>
        </Cartao>
      </section>

      {analise ? <PainelMetas metas={analise.metas_posicoes} aoConfigurar={() => emitir({ tipo: 'navegar', destino: 'posicoes' })} ehGerenteGeral={ehGerenteGeral} /> : null}

      {analise ? (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Tendência e concentração">
            <Cartao className="lg:col-span-2">
              <CartaoTitulo>Tendência dos últimos 12 meses</CartaoTitulo>
              <CartaoDescricao>Contratações de produtos, interações de relacionamento e novos clientes por mês.</CartaoDescricao>
              <div className="mt-4"><LinhasTempo rotulo="Tendência mensal" dados={analise.serie_mensal} series={[{ chave: 'interacoes', rotulo: 'Interações' }, { chave: 'contratacoes', rotulo: 'Contratações de produtos' }, { chave: 'novos_clientes', rotulo: 'Novos clientes' }]} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Concentração do AUM</CartaoTitulo>
              <CartaoDescricao>Quanto do AUM cabe nos maiores clientes. A linha tracejada seria a distribuição igualitária.</CartaoDescricao>
              <div className="mt-4"><CurvaConcentracao curva={analise.concentracao.curva} /></div>
              <p className="mt-2 text-caption text-secondary-foreground">20% dos clientes concentram <span className="tnum text-foreground">{pct1(analise.concentracao.top20pct_clientes_pct)}</span> do AUM.</p>
            </Cartao>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Perfil da base">
            <Cartao className="lg:col-span-2">
              <CartaoTitulo>Posição × segmento de cliente</CartaoTitulo>
              <CartaoDescricao>Clientes ativos em cada combinação: mostra se as posições seguem sua especialidade.</CartaoDescricao>
              <div className="mt-3">
                <MapaCalor rotulo="Mapa de calor: posição por segmento" colunas={analise.mapa_posicao_segmento[0]?.celulas.map((c) => c.segmento) ?? []}
                  linhas={analise.mapa_posicao_segmento.map((p) => ({ id: p.id_posicao, rotulo: p.id_posicao.replace('POS-AG01-', 'POS-'), sub: p.nome_posicao, valores: p.celulas.map((c) => c.clientes) }))} />
              </div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Clientes por faixa de AUM</CartaoTitulo>
              <CartaoDescricao>Poucos clientes grandes e muitos pequenos.</CartaoDescricao>
              <div className="mt-4"><BarrasHorizontais rotuloValor="Clientes" altura="h-56" dados={analise.faixas_aum.map((f) => ({ rotulo: f.faixa, valor: f.clientes }))} /></div>
            </Cartao>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Produtos e canais">
            <Cartao>
              <CartaoTitulo>Penetração por produto</CartaoTitulo>
              <CartaoDescricao>% dos clientes ativos que têm o produto.</CartaoDescricao>
              <div className="mt-4"><BarrasHorizontais rotuloValor="Penetração" formatar={(v) => `${v}%`} dados={[...dados.penetracao_por_produto].sort((a, b) => b.penetracao - a.penetracao).map((p) => ({ rotulo: p.nome, valor: Math.round(p.penetracao * 100) }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Produtos por cliente</CartaoTitulo>
              <CartaoDescricao>Clientes com poucos produtos são oportunidade de venda cruzada.</CartaoDescricao>
              <div className="mt-4"><Colunas chave="produtos" rotuloValor="Clientes" dados={analise.produtos_por_cliente.map((f) => ({ produtos: f.produtos.replace(' produtos', '').replace(' produto', '').replace('Nenhum', '0').replace(' ou mais', '+'), valor: f.clientes }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Canais de relacionamento</CartaoTitulo>
              <CartaoDescricao>Interações registradas nos últimos 90 dias.</CartaoDescricao>
              <div className="mt-4"><BarrasHorizontais rotuloValor="Interações" dados={analise.canais_90d.map((c) => ({ rotulo: c.canal, valor: c.interacoes }))} /></div>
            </Cartao>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Clientes em foco">
            <Cartao>
              <CartaoTitulo>Maiores clientes</CartaoTitulo>
              <CartaoDescricao>Por AUM, com a participação no total.</CartaoDescricao>
              <div className="mt-3"><ListaRanking vazio="Sem clientes ativos." itens={analise.top_clientes.map((c) => ({ id: c.id_cliente, titulo: c.nome, subtitulo: `${c.segmento} · ${c.id_cliente}`, valor: moedaCompacta(c.aum), apoio: pct1(c.pct_do_total), aoClicar: () => abrirCliente(c.id_cliente) }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Prioridade de contato</CartaoTitulo>
              <CartaoDescricao>Maiores clientes sem interação há mais de 90 dias.</CartaoDescricao>
              <div className="mt-3"><ListaRanking vazio="Todos os clientes tiveram contato recente." itens={analise.engajamento.prioritarios.map((c) => ({ id: c.id_cliente, titulo: c.nome, subtitulo: `${c.segmento} · ${c.id_cliente}`, valor: moedaCompacta(c.aum), apoio: c.dias_sem_contato === null ? 'nunca contatado' : `${c.dias_sem_contato} dias`, aoClicar: () => abrirCliente(c.id_cliente) }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Oportunidades de venda cruzada</CartaoTitulo>
              <CartaoDescricao>Maiores clientes com até 2 produtos.</CartaoDescricao>
              <div className="mt-3"><ListaRanking vazio="Nenhuma oportunidade identificada." itens={analise.oportunidades.map((c) => ({ id: c.id_cliente, titulo: c.nome, subtitulo: `Falta: ${c.produtos_faltantes.slice(0, 3).join(', ')}${c.produtos_faltantes.length > 3 ? '…' : ''}`, valor: moedaCompacta(c.aum), apoio: `${c.produtos_ativos} de 5 produtos`, aoClicar: () => abrirCliente(c.id_cliente) }))} /></div>
            </Cartao>
          </section>
        </>
      ) : (
        <Esqueleto className="h-80" />
      )}

      <PainelComparativo api={api} sessao={sessao} versao={versao} />

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
