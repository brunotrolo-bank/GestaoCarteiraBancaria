import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BarrasHorizontais, Botao, Cartao, CartaoDescricao, CartaoTitulo, Colunas, Esqueleto, Kpi, ListaInsights, ListaRanking, Rosca, inteiro, moedaCompacta } from '@carteira/ui';
import { useConsulta, type Api, type Sessao } from '@carteira/sdk';

const pct1 = (v: number): string => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Análises da carteira visível ao ator (mesmos dados da API de insights): perfil, risco, produtos e clientes em foco. */
export function PainelAnalises({ api, sessao, versao, aoAbrirCliente }: { api: Api; sessao: Sessao; versao: number; aoAbrirCliente: (id: string) => void }) {
  const [aberto, setAberto] = React.useState(true);
  const { dados: a } = useConsulta(() => api.analise(), [sessao.papel, sessao.dataSimulada, versao]);
  const insights = (a?.insights ?? []).filter((i) => i.destino === undefined || i.destino === 'carteira');

  return (
    <section aria-label="Análises da carteira" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-heading-lg text-foreground">Análises da carteira</h2>
        <Botao variante="secundario" tamanho="sm" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
          {aberto ? 'Recolher' : 'Expandir'}
        </Botao>
      </div>
      {!aberto ? null : !a ? (
        <div aria-busy="true" aria-label="Carregando análises" className="grid grid-cols-1 gap-4 lg:grid-cols-3"><Esqueleto className="h-64" /><Esqueleto className="h-64" /><Esqueleto className="h-64" /></div>
      ) : (
        <>
          {insights.length > 0 ? <ListaInsights itens={insights} rotuloAcao={() => 'Ver clientes'} /> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Concentração nos 10 maiores" valor={pct1(a.concentracao.top10_pct)} dica={`Maior cliente: ${pct1(a.concentracao.maior_cliente_pct)} do AUM`} />
            <Kpi rotulo="Sem contato há mais de 90 dias" valor={inteiro(a.engajamento.sem_contato_90d)} dica={`${pct1(a.engajamento.pct_sem_contato)} dos clientes ativos`} />
            <Kpi rotulo="Oportunidades de venda cruzada" valor={inteiro(a.oportunidades.length)} dica="Maiores clientes com até 2 produtos" />
            <Kpi rotulo="Contratações em 12 meses" valor={inteiro(a.serie_mensal.reduce((x, m) => x + m.contratacoes, 0))} dica={`${inteiro(a.serie_mensal.reduce((x, m) => x + m.interacoes, 0))} interações no período`} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Cartao>
              <CartaoTitulo>Perfil por segmento</CartaoTitulo>
              <CartaoDescricao>Participação no AUM de cada segmento.</CartaoDescricao>
              <div className="mt-4"><Rosca dados={a.por_segmento.map((x) => ({ rotulo: x.segmento, valor: x.aum }))} formatar={moedaCompacta} total={moedaCompacta(a.por_segmento.reduce((t, x) => t + x.aum, 0))} rotuloTotal="AUM total" /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Score de risco</CartaoTitulo>
              <CartaoDescricao>Clientes ativos por faixa de score (1 a 1000).</CartaoDescricao>
              <div className="mt-4"><Colunas chave="faixa" rotuloValor="Clientes" dados={a.faixas_score.map((f) => ({ faixa: f.faixa, valor: f.clientes }))} destaque={(l) => l.faixa === 'Até 499'} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Produtos por cliente</CartaoTitulo>
              <CartaoDescricao>Quantos produtos cada cliente ativo possui.</CartaoDescricao>
              <div className="mt-4"><Colunas chave="produtos" rotuloValor="Clientes" dados={a.produtos_por_cliente.map((f) => ({ produtos: f.produtos.replace(' produtos', '').replace(' produto', '').replace('Nenhum', '0').replace(' ou mais', '+'), valor: f.clientes }))} /></div>
            </Cartao>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Cartao>
              <CartaoTitulo>Maiores clientes</CartaoTitulo>
              <CartaoDescricao>Por AUM; clique para abrir a visão 360°.</CartaoDescricao>
              <div className="mt-3"><ListaRanking vazio="Sem clientes ativos." itens={a.top_clientes.map((c) => ({ id: c.id_cliente, titulo: c.nome, subtitulo: `${c.segmento} · ${c.id_cliente}`, valor: moedaCompacta(c.aum), apoio: pct1(c.pct_do_total), aoClicar: () => aoAbrirCliente(c.id_cliente) }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Prioridade de contato</CartaoTitulo>
              <CartaoDescricao>Maiores clientes sem interação há mais de 90 dias.</CartaoDescricao>
              <div className="mt-3"><ListaRanking vazio="Todos os clientes tiveram contato recente." itens={a.engajamento.prioritarios.map((c) => ({ id: c.id_cliente, titulo: c.nome, subtitulo: `${c.segmento} · ${c.id_cliente}`, valor: moedaCompacta(c.aum), apoio: c.dias_sem_contato === null ? 'nunca contatado' : `${c.dias_sem_contato} dias`, aoClicar: () => aoAbrirCliente(c.id_cliente) }))} /></div>
            </Cartao>
            <Cartao>
              <CartaoTitulo>Oportunidades de venda cruzada</CartaoTitulo>
              <CartaoDescricao>Maiores clientes com até 2 produtos.</CartaoDescricao>
              <div className="mt-3"><ListaRanking vazio="Nenhuma oportunidade identificada." itens={a.oportunidades.map((c) => ({ id: c.id_cliente, titulo: c.nome, subtitulo: `Falta: ${c.produtos_faltantes.slice(0, 3).join(', ')}${c.produtos_faltantes.length > 3 ? '…' : ''}`, valor: moedaCompacta(c.aum), apoio: `${c.produtos_ativos} de 5 produtos`, aoClicar: () => aoAbrirCliente(c.id_cliente) }))} /></div>
            </Cartao>
          </div>
          <Cartao>
            <CartaoTitulo>Canais de relacionamento</CartaoTitulo>
            <CartaoDescricao>Interações registradas nos últimos 90 dias.</CartaoDescricao>
            <div className="mt-4"><BarrasHorizontais rotuloValor="Interações" altura="h-40" dados={a.canais_90d.map((c) => ({ rotulo: c.canal, valor: c.interacoes }))} /></div>
          </Cartao>
        </>
      )}
    </section>
  );
}
