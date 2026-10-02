import type { Cliente, Db, EscopoDelegacao, Gerente, SegmentoCliente } from '../model/types.ts';
import { diaDe } from '../shared/dates.ts';
import { DomainError, exigir } from '../shared/errors.ts';
import { posicaoDoClienteEm, resolverAcessos, exigirAcessoCliente, type AcessoPosicao, type Decisao } from '../acesso/index.ts';
import { situacao } from '../delegacao/index.ts';
import { titularVigente } from '../posicoes/index.ts';
import { clienteMascarado, interacoesDoCliente, produtosDoCliente } from '../clientes/index.ts';

/**
 * Camada semântica (D-06: métricas em código, definidas uma única vez — FR-INS-001).
 * Toda consulta recebe o contexto de segurança (ator + instante) e só enxerga o que o domínio 04 permite (FR-INS-002).
 */
export interface Contexto {
  idGerente: string;
  instante: Date;
}

/** Limiares de desbalanceamento (Q-27): acima de 100% ou abaixo de 50% da capacidade. */
export const LIMITE_SUPERIOR = 1;
export const LIMITE_INFERIOR = 0.5;
const SEGMENTOS: SegmentoCliente[] = ['UHNW', 'Private', 'Alta Renda', 'Varejo'];

export type Desbalanceamento = 'Acima' | 'Abaixo' | null;

export function classificarUtilizacao(utilizacao: number): Desbalanceamento {
  if (utilizacao > LIMITE_SUPERIOR) return 'Acima';
  if (utilizacao < LIMITE_INFERIOR) return 'Abaixo';
  return null;
}

export interface ResumoPosicao {
  id_posicao: string;
  nome_posicao: string;
  segmento_especialidade: string;
  status: string;
  titular: { id_gerente: string; nome: string } | null;
  vaga: boolean;
  clientes_ativos: number;
  capacidade: number;
  utilizacao: number;
  aum_total: number;
  desbalanceamento: Desbalanceamento;
  modo: AcessoPosicao['modo'];
  origens: AcessoPosicao['origens'];
}

export interface ResumoAgencia {
  calculado_em: string;
  escopo: 'Agencia' | 'Carteira';
  total_clientes: number;
  aum_total: number;
  aum_medio_por_cliente: number;
  penetracao_media: number;
  por_segmento: { segmento: SegmentoCliente; clientes: number; aum: number }[];
  penetracao_por_produto: { codigo: string; nome: string; clientes: number; penetracao: number }[];
  posicoes: ResumoPosicao[];
  posicoes_em_alerta: number;
}

function posicaoVisivel(db: Db, ctx: Contexto): Map<string, AcessoPosicao> {
  return new Map(resolverAcessos(db, ctx.idGerente, ctx.instante).posicoes.map((p) => [p.id_posicao, p]));
}

/** Clientes visíveis ao ator no instante, com a posição vigente naquele instante (histórico de vínculo). */
export function clientesVisiveis(db: Db, ctx: Contexto): (Cliente & { posicao_no_instante: string })[] {
  const permitidas = posicaoVisivel(db, ctx);
  const resultado: (Cliente & { posicao_no_instante: string })[] = [];
  for (const c of db.dim_clientes) {
    const posicao = posicaoDoClienteEm(db, c.id_cliente, ctx.instante);
    if (posicao && permitidas.has(posicao)) resultado.push({ ...c, posicao_no_instante: posicao });
  }
  return resultado;
}

/** Soma monetária exata em centavos (C11): evita erro de ponto flutuante. */
const soma = (xs: number[]): number => xs.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
const razao = (a: number, b: number): number => (b === 0 ? 0 : a / b);

export function resumoPosicao(db: Db, ctx: Contexto, acesso: AcessoPosicao): ResumoPosicao {
  const p = db.dim_posicoes.find((x) => x.id_posicao === acesso.id_posicao)!;
  const ativos = db.dim_clientes.filter(
    (c) => c.status === 'Ativo' && posicaoDoClienteEm(db, c.id_cliente, ctx.instante) === p.id_posicao,
  );
  const ocupacao = titularVigente(db, p.id_posicao, diaDe(ctx.instante));
  const titular: Gerente | undefined = ocupacao ? db.dim_gerentes.find((g) => g.id_gerente === ocupacao.id_gerente) : undefined;
  const utilizacao = razao(ativos.length, p.capacidade_max_contas);
  return {
    id_posicao: p.id_posicao,
    nome_posicao: p.nome_posicao,
    segmento_especialidade: p.segmento_especialidade,
    status: p.status,
    titular: titular ? { id_gerente: titular.id_gerente, nome: titular.nome_completo } : null,
    vaga: !titular,
    clientes_ativos: ativos.length,
    capacidade: p.capacidade_max_contas,
    utilizacao,
    aum_total: soma(ativos.map((c) => c.volume_aum)),
    desbalanceamento: classificarUtilizacao(utilizacao),
    modo: acesso.modo,
    origens: acesso.origens,
  };
}

/** Torre de Controle / resumo da carteira visível (FR-INS-005, FR-INS-009: soma das partes = total). */
export function resumoAgencia(db: Db, ctx: Contexto): ResumoAgencia {
  const acessos = resolverAcessos(db, ctx.idGerente, ctx.instante);
  const posicoes = acessos.posicoes.map((a) => resumoPosicao(db, ctx, a)).sort((a, b) => a.id_posicao.localeCompare(b.id_posicao));
  const ativos = clientesVisiveis(db, ctx).filter((c) => c.status === 'Ativo');
  const aumTotal = soma(ativos.map((c) => c.volume_aum));
  const penetracaoPorProduto = db.ref_produtos.map((prod) => {
    const clientes = ativos.filter((c) => db.fct_produtos_cliente.some((x) => x.id_cliente === c.id_cliente && x.codigo_produto === prod.codigo && x.status === 'Ativo')).length;
    return { codigo: prod.codigo, nome: prod.nome, clientes, penetracao: razao(clientes, ativos.length) };
  });
  return {
    calculado_em: ctx.instante.toISOString(),
    escopo: acessos.geral ? 'Agencia' : 'Carteira',
    total_clientes: ativos.length,
    aum_total: aumTotal,
    aum_medio_por_cliente: razao(aumTotal, ativos.length),
    penetracao_media: razao(soma(penetracaoPorProduto.map((p) => p.penetracao)), penetracaoPorProduto.length),
    por_segmento: SEGMENTOS.map((s) => {
      const doSegmento = ativos.filter((c) => c.segmento_cliente === s);
      return { segmento: s, clientes: doSegmento.length, aum: soma(doSegmento.map((c) => c.volume_aum)) };
    }),
    penetracao_por_produto: penetracaoPorProduto,
    posicoes,
    posicoes_em_alerta: posicoes.filter((p) => p.desbalanceamento !== null && p.status !== 'Extinta').length,
  };
}

export function desbalanceamentos(db: Db, ctx: Contexto): ResumoPosicao[] {
  return resumoAgencia(db, ctx).posicoes.filter((p) => p.desbalanceamento !== null && p.status === 'Ativa');
}

export interface SecaoCarteira {
  tipo: 'Propria' | 'Delegada';
  posicao: ResumoPosicao;
  cobertura?: { id_delegacao: string; escopo: EscopoDelegacao; data_fim: string; situacao: string };
  clientes: ReturnType<typeof clienteMascarado>[];
}

/** "Minha Carteira" e "Carteira Delegada" separadas, com marca de cobertura temporária (FR-INS-006). */
export function carteiraDoAtor(db: Db, ctx: Contexto): SecaoCarteira[] {
  const acessos = resolverAcessos(db, ctx.idGerente, ctx.instante);
  const visiveis = clientesVisiveis(db, ctx);
  const secoes: SecaoCarteira[] = [];
  for (const a of acessos.posicoes) {
    const resumo = resumoPosicao(db, ctx, a);
    const clientes = visiveis.filter((c) => c.posicao_no_instante === a.id_posicao).map(clienteMascarado);
    const delegada = a.origens.find((o) => o.origem === 'Delegado');
    const propria = a.origens.some((o) => o.origem === 'Titular');
    if (propria || acessos.geral) secoes.push({ tipo: 'Propria', posicao: resumo, clientes });
    if (delegada && !acessos.geral) {
      const d = db.fct_delegacoes.find((x) => x.id_delegacao === delegada.id_delegacao)!;
      secoes.push({
        tipo: 'Delegada',
        posicao: resumo,
        cobertura: { id_delegacao: d.id_delegacao, escopo: d.escopo, data_fim: d.data_fim, situacao: situacao(d, ctx.instante) },
        clientes,
      });
    }
  }
  return secoes.sort((a, b) => (a.tipo === b.tipo ? a.posicao.id_posicao.localeCompare(b.posicao.id_posicao) : a.tipo === 'Propria' ? -1 : 1));
}

export interface Visao360 {
  cliente: ReturnType<typeof clienteMascarado>;
  posicao_atual: { id_posicao: string; nome_posicao: string };
  decisao: Pick<Decisao, 'modo' | 'origens' | 'motivo'>;
  linha_do_tempo: { id_posicao: string; nome_posicao: string; inicio_em: string; fim_em: string | null }[];
  produtos: { codigo: string; nome: string; contratado: boolean; data_contratacao: string | null }[];
  interacoes: { id_interacao: string; canal: string; data: string; nota: string }[];
}

/** Visão 360° (FR-INS-003). Sem acesso ⇒ ACESSO_NEGADO sem revelar existência dos dados. */
export function visao360(db: Db, ctx: Contexto, idCliente: string): Visao360 {
  const cliente = db.dim_clientes.find((c) => c.id_cliente === idCliente);
  if (!cliente) throw new DomainError('ACESSO_NEGADO', 'Acesso negado ao cliente.');
  const decisao = exigirAcessoCliente(db, ctx.idGerente, idCliente, ctx.instante, 'Leitura');
  const posId = posicaoDoClienteEm(db, idCliente, ctx.instante)!;
  const nomePosicao = (id: string): string => db.dim_posicoes.find((p) => p.id_posicao === id)?.nome_posicao ?? id;
  const contratados = new Map(produtosDoCliente(db, idCliente).filter((p) => p.status === 'Ativo').map((p) => [p.codigo_produto, p.data_contratacao]));
  return {
    cliente: clienteMascarado(cliente),
    posicao_atual: { id_posicao: posId, nome_posicao: nomePosicao(posId) },
    decisao: { modo: decisao.modo, origens: decisao.origens, motivo: decisao.motivo },
    linha_do_tempo: db.bridge_vinculo_carteira
      .filter((v) => v.id_cliente === idCliente)
      .sort((a, b) => a.inicio_em.localeCompare(b.inicio_em))
      .map((v) => ({ id_posicao: v.id_posicao, nome_posicao: nomePosicao(v.id_posicao), inicio_em: v.inicio_em, fim_em: v.fim_em })),
    produtos: db.ref_produtos.map((p) => ({ codigo: p.codigo, nome: p.nome, contratado: contratados.has(p.codigo), data_contratacao: contratados.get(p.codigo) ?? null })),
    interacoes: interacoesDoCliente(db, idCliente).map((i) => ({ id_interacao: i.id_interacao, canal: i.canal, data: i.data, nota: i.nota })),
  };
}

export function exigirAtorAtivo(db: Db, idGerente: string): Gerente {
  const g = db.dim_gerentes.find((x) => x.id_gerente === idGerente);
  exigir(g && g.status === 'Ativo', 'ATOR_DESCONHECIDO', 'Ator desconhecido ou inativo.');
  return g;
}
