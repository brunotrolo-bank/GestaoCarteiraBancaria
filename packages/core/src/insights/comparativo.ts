import type { Db } from '../model/types.ts';
import { addDays, diaDe, isISODate, type ISODate } from '../shared/dates.ts';
import { exigir } from '../shared/errors.ts';
import { resolverAcessos } from '../acesso/index.ts';
import { clientesVisiveis, type Contexto } from './index.ts';

/**
 * Comparativo entre períodos: o período pedido contra o imediatamente anterior, de mesma duração.
 * Só compara o que o modelo registra no tempo (entradas, contratações, interações, movimentações). O saldo (AUM) não tem
 * histórico na POC: a base e o AUM do fim de cada período usam o valor ATUAL dos clientes que já estavam na carteira.
 */
export type Leitura = 'melhora' | 'piora' | 'estavel' | 'neutra';
export type Unidade = 'clientes' | 'reais' | 'quantidade' | 'percentual';

export interface MetricaComparada {
  chave: string;
  rotulo: string;
  unidade: Unidade;
  atual: number;
  anterior: number;
  variacao: number;
  variacao_pct: number | null;
  leitura: Leitura;
}

export interface Janela { inicio: ISODate; fim: ISODate }
interface Par { atual: number; anterior: number }

export interface Comparativo {
  calculado_em: string;
  escopo: 'Agencia' | 'Carteira';
  dias: number;
  atual: Janela;
  anterior: Janela;
  metricas: MetricaComparada[];
  por_posicao: { id_posicao: string; nome_posicao: string; interacoes: Par; contratacoes: Par; novos_clientes: Par }[];
  serie: { indice: number; inicio_atual: ISODate; inicio_anterior: ISODate; interacoes: Par; contratacoes: Par }[];
  ressalvas: string[];
}

const LIMITE_DIAS = 366;
const FAIXA_ESTAVEL = 2;
const dias = (de: ISODate, ate: ISODate): number => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
const arred = (v: number, casas = 1): number => Math.round(v * 10 ** casas) / 10 ** casas;
const dentro = (d: string, j: Janela): boolean => d >= j.inicio && d <= j.fim;

export function comparativo(db: Db, ctx: Contexto, pedido: Janela): Comparativo {
  const hoje = diaDe(ctx.instante);
  exigir(isISODate(pedido.inicio) && isISODate(pedido.fim), 'DADOS_INVALIDOS', 'Informe início e fim no formato AAAA-MM-DD.');
  exigir(pedido.inicio <= pedido.fim, 'DADOS_INVALIDOS', 'O início do período não pode ser depois do fim.');
  exigir(pedido.fim <= hoje, 'DADOS_INVALIDOS', 'O fim do período não pode ser posterior à data de referência.');
  const total = dias(pedido.inicio, pedido.fim) + 1;
  exigir(total <= LIMITE_DIAS, 'DADOS_INVALIDOS', `O período pode ter no máximo ${LIMITE_DIAS} dias.`);

  const atual: Janela = { inicio: pedido.inicio, fim: pedido.fim };
  const anterior: Janela = { inicio: addDays(pedido.inicio, -total), fim: addDays(pedido.inicio, -1) };
  const visiveis = clientesVisiveis(db, ctx);
  const ids = new Set(visiveis.map((c) => c.id_cliente));
  const ativos = visiveis.filter((c) => c.status === 'Ativo');

  const interacoes = db.fct_interacoes_crm.filter((i) => ids.has(i.id_cliente));
  const contratos = db.fct_produtos_cliente.filter((p) => ids.has(p.id_cliente) && p.status === 'Ativo');
  const movimentos = db.fct_movimentacao_carteira.filter((m) => ids.has(m.id_cliente));
  const baseAte = (j: Janela) => ativos.filter((c) => c.data_carteirizacao <= j.fim);

  const por = (f: (j: Janela) => number): Par => ({ atual: f(atual), anterior: f(anterior) });
  const idsAtivos = new Set(ativos.map((c) => c.id_cliente));
  const contatados = (j: Janela): number => new Set(interacoes.filter((i) => dentro(i.data, j) && idsAtivos.has(i.id_cliente)).map((i) => i.id_cliente)).size;
  const centavos = (xs: number[]): number => xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100;

  const metrica = (chave: string, rotulo: string, unidade: Unidade, par: Par, sentido: 'maior' | 'neutro' = 'maior'): MetricaComparada => {
    const variacao = arred(par.atual - par.anterior, 2);
    const variacao_pct = par.anterior === 0 ? null : arred(((par.atual - par.anterior) / par.anterior) * 100);
    const delta = variacao_pct ?? (par.atual === par.anterior ? 0 : par.atual > par.anterior ? 100 : -100);
    const leitura: Leitura = sentido === 'neutro' ? 'neutra' : Math.abs(delta) < FAIXA_ESTAVEL ? 'estavel' : delta > 0 ? 'melhora' : 'piora';
    return { chave, rotulo, unidade, atual: par.atual, anterior: par.anterior, variacao, variacao_pct, leitura };
  };

  const base = por((j) => baseAte(j).length);
  const cobertura = { atual: arred(base.atual === 0 ? 0 : (contatados(atual) / base.atual) * 100), anterior: arred(base.anterior === 0 ? 0 : (contatados(anterior) / base.anterior) * 100) };
  const metricas = [
    metrica('base_clientes', 'Clientes na carteira ao fim do período', 'clientes', base),
    metrica('base_aum', 'AUM da base ao fim do período', 'reais', por((j) => centavos(baseAte(j).map((c) => c.volume_aum)))),
    metrica('novos_clientes', 'Novos clientes', 'clientes', por((j) => ativos.filter((c) => dentro(c.data_carteirizacao, j)).length)),
    metrica('contratacoes', 'Contratações de produtos', 'quantidade', por((j) => contratos.filter((p) => dentro(p.data_contratacao, j)).length)),
    metrica('interacoes', 'Interações de relacionamento', 'quantidade', por((j) => interacoes.filter((i) => dentro(i.data, j)).length)),
    metrica('clientes_contatados', 'Clientes contatados', 'clientes', por(contatados)),
    metrica('cobertura_contato', 'Cobertura de contato (contatados ÷ base)', 'percentual', cobertura),
    metrica('movimentacoes', 'Movimentações entre posições', 'quantidade', por((j) => movimentos.filter((m) => dentro(diaDe(new Date(m.instante)), j)).length), 'neutro'),
  ];

  const posicoes = resolverAcessos(db, ctx.idGerente, ctx.instante).posicoes.map((a) => a.id_posicao).sort();
  const por_posicao = posicoes.map((id) => {
    const doGrupo = visiveis.filter((c) => c.posicao_no_instante === id);
    const gi = new Set(doGrupo.map((c) => c.id_cliente));
    return {
      id_posicao: id,
      nome_posicao: db.dim_posicoes.find((p) => p.id_posicao === id)?.nome_posicao ?? id,
      interacoes: por((j) => interacoes.filter((i) => gi.has(i.id_cliente) && dentro(i.data, j)).length),
      contratacoes: por((j) => contratos.filter((p) => gi.has(p.id_cliente) && dentro(p.data_contratacao, j)).length),
      novos_clientes: por((j) => doGrupo.filter((c) => c.status === 'Ativo' && dentro(c.data_carteirizacao, j)).length),
    };
  });

  // série alinhada: até 10 faixas de mesma largura; a faixa i do período atual é comparável à faixa i do anterior
  const largura = Math.ceil(total / 10);
  const faixas = Math.ceil(total / largura);
  const contar = (datas: string[], j: Janela, i: number): number => {
    const de = addDays(j.inicio, i * largura);
    const ate = addDays(de, largura - 1) > j.fim ? j.fim : addDays(de, largura - 1);
    return datas.filter((d) => d >= de && d <= ate).length;
  };
  const dInter = interacoes.map((i) => i.data);
  const dContr = contratos.map((p) => p.data_contratacao);
  const serie = Array.from({ length: faixas }, (_, i) => ({
    indice: i + 1,
    inicio_atual: addDays(atual.inicio, i * largura),
    inicio_anterior: addDays(anterior.inicio, i * largura),
    interacoes: { atual: contar(dInter, atual, i), anterior: contar(dInter, anterior, i) },
    contratacoes: { atual: contar(dContr, atual, i), anterior: contar(dContr, anterior, i) },
  }));

  return {
    calculado_em: ctx.instante.toISOString(),
    escopo: resolverAcessos(db, ctx.idGerente, ctx.instante).geral ? 'Agencia' : 'Carteira',
    dias: total,
    atual,
    anterior,
    metricas,
    por_posicao,
    serie,
    ressalvas: [
      'O AUM não tem histórico na POC: "base" e "AUM da base" usam o valor atual dos clientes que já estavam na carteira ao fim de cada período.',
      'Clientes inativos ou em prospecção ficam fora da base; entradas contam pela data de carteirização.',
    ],
  };
}
