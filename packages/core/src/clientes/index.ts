import type { Cliente, Db, Movimentacao, Ator, SegmentoCliente, SegmentoPosicao } from '../model/types.ts';
import { emTransacao, proximoId } from '../model/db.ts';
import { diaDe } from '../shared/dates.ts';
import type { Clock } from '../shared/clock.ts';
import { exigir } from '../shared/errors.ts';
import { auditar, publicar } from '../model/registro.ts';
import { exigirGerenteGeral, obterPosicao } from '../posicoes/index.ts';
import { decidirCliente, exigirAcessoCliente } from '../acesso/index.ts';
import { apenasDigitos, documentoValido, mascararDocumento } from './documento.ts';

export * from './documento.ts';

const SEGMENTOS: SegmentoCliente[] = ['UHNW', 'Private', 'Alta Renda', 'Varejo'];

/** Segmentos de cliente aderentes à especialidade da posição (FR-CLI-005); posição Mista aceita todos. */
const ADERENCIA: Record<SegmentoPosicao, SegmentoCliente[]> = {
  Private: ['UHNW', 'Private'],
  'Alta Renda': ['Alta Renda'],
  'Middle Market': ['Varejo'],
  Misto: SEGMENTOS,
};

export interface Utilizacao {
  id_posicao: string;
  clientes_ativos: number;
  capacidade: number;
  /** Razão 0..n (1 = 100%). Só clientes Ativos contam (Q-15). */
  utilizacao: number;
}

export function utilizacaoPosicao(db: Db, idPosicao: string, delta = 0): Utilizacao {
  const p = obterPosicao(db, idPosicao);
  const ativos = db.dim_clientes.filter((c) => c.id_posicao_carteira === idPosicao && c.status === 'Ativo').length + delta;
  return { id_posicao: idPosicao, clientes_ativos: ativos, capacidade: p.capacidade_max_contas, utilizacao: ativos / p.capacidade_max_contas };
}

export function contarClientesDaPosicao(db: Db, idPosicao: string): number {
  return db.dim_clientes.filter((c) => c.id_posicao_carteira === idPosicao).length;
}

export function obterCliente(db: Db, id: string): Cliente {
  const c = db.dim_clientes.find((x) => x.id_cliente === id);
  exigir(c, 'CLIENTE_INEXISTENTE', `Cliente ${id} não existe.`);
  return c;
}

export function aderenteAoSegmento(segmentoPosicao: SegmentoPosicao, segmentoCliente: SegmentoCliente): boolean {
  return ADERENCIA[segmentoPosicao].includes(segmentoCliente);
}

/** Cliente com documento mascarado — formato de saída padrão para API/MCP/tela (Q-24). */
export function clienteMascarado(c: Cliente): Omit<Cliente, 'cpf_cnpj'> & { cpf_cnpj_mascarado: string } {
  const { cpf_cnpj, ...resto } = c;
  return { ...resto, cpf_cnpj_mascarado: mascararDocumento(cpf_cnpj) };
}

export interface NovoCliente {
  nome_razao_social: string;
  cpf_cnpj: string;
  segmento_cliente: SegmentoCliente;
  faixa_renda_faturamento: number;
  volume_aum: number;
  score_risco: number;
  id_posicao_carteira: string;
  status?: Cliente['status'];
}

export function cadastrarCliente(db: Db, clock: Clock, entrada: NovoCliente, ator: Ator): Cliente {
  exigirGerenteGeral(db, ator);
  exigir(entrada.nome_razao_social?.trim(), 'DADOS_INVALIDOS', 'Nome é obrigatório.');
  exigir(documentoValido(entrada.cpf_cnpj), 'DOCUMENTO_INVALIDO', 'CPF/CNPJ inválido.');
  const doc = apenasDigitos(entrada.cpf_cnpj);
  exigir(!db.dim_clientes.some((c) => apenasDigitos(c.cpf_cnpj) === doc), 'DOCUMENTO_DUPLICADO', 'CPF/CNPJ já cadastrado.');
  exigir(SEGMENTOS.includes(entrada.segmento_cliente), 'DADOS_INVALIDOS', 'Segmento inválido.');
  exigir(Number.isInteger(entrada.score_risco) && entrada.score_risco >= 1 && entrada.score_risco <= 1000, 'DADOS_INVALIDOS', 'Score deve estar entre 1 e 1000.');
  exigir(entrada.volume_aum >= 0 && entrada.faixa_renda_faturamento >= 0, 'DADOS_INVALIDOS', 'Valores monetários não podem ser negativos.');
  const posicao = obterPosicao(db, entrada.id_posicao_carteira);
  exigir(posicao.status === 'Ativa', 'POSICAO_DESTINO_INDISPONIVEL', 'A posição não está Ativa.');
  const agora = clock.agora();
  const cliente: Cliente = {
    id_cliente: proximoId('CLI', db.dim_clientes.map((c) => c.id_cliente), 4),
    nome_razao_social: entrada.nome_razao_social.trim(),
    cpf_cnpj: doc,
    segmento_cliente: entrada.segmento_cliente,
    faixa_renda_faturamento: entrada.faixa_renda_faturamento,
    volume_aum: entrada.volume_aum,
    score_risco: entrada.score_risco,
    id_posicao_carteira: posicao.id_posicao,
    data_carteirizacao: diaDe(agora),
    status: entrada.status ?? 'Ativo',
  };
  return emTransacao(db, () => {
    db.dim_clientes.push(cliente);
    db.bridge_vinculo_carteira.push({
      id_vinculo: proximoId('VIN', db.bridge_vinculo_carteira.map((v) => v.id_vinculo), 5),
      id_cliente: cliente.id_cliente,
      id_posicao: posicao.id_posicao,
      inicio_em: agora.toISOString(),
      fim_em: null,
    });
    auditar(db, clock, ator.idGerente, 'CLIENTE_CARTEIRIZADO', 'dim_clientes', cliente.id_cliente, { id_posicao: posicao.id_posicao });
    publicar(db, clock, 'ClienteCarteirizado', { id_cliente: cliente.id_cliente, id_posicao: posicao.id_posicao });
    return cliente;
  });
}

export interface ResultadoSimulacao {
  id_posicao_destino: string;
  clientes_a_mover: string[];
  ignorados_ja_no_destino: string[];
  antes: Utilizacao[];
  depois: Utilizacao[];
  avisos: { codigo: 'ADERENCIA_SEGMENTO' | 'CAPACIDADE_EXCEDIDA' | 'CLIENTE_INATIVO'; mensagem: string; id_cliente?: string }[];
}

/** Dry-run (FR-CLI-006): calcula antes/depois e avisos sem gravar nada. */
export function simularRedistribuicao(db: Db, entrada: { ids_clientes: string[]; id_posicao_destino: string }): ResultadoSimulacao {
  const destino = obterPosicao(db, entrada.id_posicao_destino);
  const ids = [...new Set(entrada.ids_clientes)];
  const clientes = ids.map((id) => obterCliente(db, id));
  const mover = clientes.filter((c) => c.id_posicao_carteira !== destino.id_posicao);
  const ignorados = clientes.filter((c) => c.id_posicao_carteira === destino.id_posicao).map((c) => c.id_cliente);
  const posicoesEnvolvidas = [...new Set([destino.id_posicao, ...mover.map((c) => c.id_posicao_carteira)])];
  const antes = posicoesEnvolvidas.map((p) => utilizacaoPosicao(db, p));
  const depois = posicoesEnvolvidas.map((p) => {
    const saindo = mover.filter((c) => c.id_posicao_carteira === p && c.status === 'Ativo').length;
    const entrando = p === destino.id_posicao ? mover.filter((c) => c.status === 'Ativo').length : 0;
    return utilizacaoPosicao(db, p, entrando - saindo);
  });
  const avisos: ResultadoSimulacao['avisos'] = [];
  for (const c of mover) {
    if (!aderenteAoSegmento(destino.segmento_especialidade, c.segmento_cliente)) {
      avisos.push({ codigo: 'ADERENCIA_SEGMENTO', id_cliente: c.id_cliente, mensagem: `Segmento ${c.segmento_cliente} não é aderente à especialidade ${destino.segmento_especialidade}.` });
    }
    if (c.status === 'Inativo') avisos.push({ codigo: 'CLIENTE_INATIVO', id_cliente: c.id_cliente, mensagem: 'Cliente inativo não pode ser redistribuído.' });
  }
  const depoisDestino = depois.find((u) => u.id_posicao === destino.id_posicao)!;
  if (depoisDestino.utilizacao > 1) avisos.push({ codigo: 'CAPACIDADE_EXCEDIDA', mensagem: `Destino ficaria com ${Math.round(depoisDestino.utilizacao * 100)}% da capacidade.` });
  return { id_posicao_destino: destino.id_posicao, clientes_a_mover: mover.map((c) => c.id_cliente), ignorados_ja_no_destino: ignorados, antes, depois, avisos };
}

export interface EntradaRedistribuicao {
  ids_clientes: string[];
  id_posicao_destino: string;
  motivo: string;
  justificativa?: string;
  /** Chave de idempotência = identificador do lote (FR-CLI-008). */
  chave_idempotencia?: string;
}

export interface ResultadoLote {
  id_lote: string;
  repetido: boolean;
  movimentacoes: Movimentacao[];
  capacidade_excedida: boolean;
}

function moverCliente(db: Db, clock: Clock, c: Cliente, destino: string, lote: string, motivo: string, ator: string, tipo: Movimentacao['tipo']): Movimentacao {
  const agora = clock.agora().toISOString();
  const atual = db.bridge_vinculo_carteira.find((v) => v.id_cliente === c.id_cliente && v.fim_em === null);
  if (atual) atual.fim_em = agora;
  db.bridge_vinculo_carteira.push({
    id_vinculo: proximoId('VIN', db.bridge_vinculo_carteira.map((v) => v.id_vinculo), 5),
    id_cliente: c.id_cliente,
    id_posicao: destino,
    inicio_em: agora,
    fim_em: null,
  });
  const origem = c.id_posicao_carteira;
  c.id_posicao_carteira = destino;
  c.data_carteirizacao = diaDe(clock.agora());
  const mov: Movimentacao = {
    id_movimentacao: proximoId('MOV', db.fct_movimentacao_carteira.map((m) => m.id_movimentacao), 6),
    id_lote: lote,
    id_cliente: c.id_cliente,
    id_posicao_origem: origem,
    id_posicao_destino: destino,
    motivo,
    ator,
    instante: agora,
    tipo,
  };
  db.fct_movimentacao_carteira.push(mov);
  publicar(db, clock, 'ClienteRealocado', { id_cliente: c.id_cliente, de: origem, para: destino, id_lote: lote });
  return mov;
}

/** Redistribuição em bloco (J3). Só o Gerente Geral (Q-16); atômica e idempotente por lote (FR-CLI-007/008). */
export function executarRedistribuicao(db: Db, clock: Clock, entrada: EntradaRedistribuicao, ator: Ator): ResultadoLote {
  exigirGerenteGeral(db, ator);
  return aplicarLote(db, clock, entrada, ator);
}

/** Núcleo do lote, sem checagem de perfil: quem chama já autorizou o ator (GG no bloco; escrita na carteira na transferência). */
function aplicarLote(db: Db, clock: Clock, entrada: EntradaRedistribuicao, ator: Ator): ResultadoLote {
  exigir(entrada.motivo?.trim(), 'MOTIVO_OBRIGATORIO', 'Motivo é obrigatório.');
  const idLote = entrada.chave_idempotencia?.trim() || proximoId('LOTE', [...new Set(db.fct_movimentacao_carteira.map((m) => m.id_lote))], 4);
  const existentes = db.fct_movimentacao_carteira.filter((m) => m.id_lote === idLote);
  if (existentes.length > 0) return { id_lote: idLote, repetido: true, movimentacoes: existentes, capacidade_excedida: false };

  const destino = obterPosicao(db, entrada.id_posicao_destino);
  exigir(destino.status === 'Ativa', 'POSICAO_DESTINO_INDISPONIVEL', 'A posição de destino não está Ativa.');
  const ids = [...new Set(entrada.ids_clientes)];
  const clientes = ids.map((id) => obterCliente(db, id));
  const inativos = clientes.filter((c) => c.status === 'Inativo');
  exigir(inativos.length === 0, 'CLIENTE_INATIVO', 'Há clientes inativos no lote.', { ids: inativos.map((c) => c.id_cliente) });
  const mover = clientes.filter((c) => c.id_posicao_carteira !== destino.id_posicao);
  exigir(mover.length > 0, 'LOTE_VAZIO', 'Nenhum cliente a mover.');
  const sim = simularRedistribuicao(db, entrada);
  const excedida = sim.depois.find((u) => u.id_posicao === destino.id_posicao)!.utilizacao > 1;
  if (excedida) exigir(entrada.justificativa?.trim(), 'JUSTIFICATIVA_OBRIGATORIA', 'Capacidade excedida exige justificativa.');

  return emTransacao(db, () => {
    const movimentacoes = mover.map((c) => moverCliente(db, clock, c, destino.id_posicao, idLote, entrada.motivo.trim(), ator.idGerente, mover.length === 1 ? 'Transferencia' : 'Redistribuicao'));
    auditar(db, clock, ator.idGerente, 'LOTE_REDISTRIBUIDO', 'fct_movimentacao_carteira', idLote, {
      destino: destino.id_posicao, clientes: movimentacoes.length, motivo: entrada.motivo.trim(), justificativa: entrada.justificativa ?? null,
    });
    publicar(db, clock, 'LoteRedistribuido', { id_lote: idLote, destino: destino.id_posicao, clientes: movimentacoes.length });
    if (excedida) publicar(db, clock, 'CapacidadeExcedida', { id_posicao: destino.id_posicao, id_lote: idLote });
    return { id_lote: idLote, repetido: false, movimentacoes, capacidade_excedida: excedida };
  });
}

/** Transferência de um cliente (visão 360°): GG ou quem tem escrita sobre a carteira de origem (US-CLI-4). */
export function transferirCliente(
  db: Db,
  clock: Clock,
  entrada: { id_cliente: string; id_posicao_destino: string; motivo: string; justificativa?: string; chave_idempotencia?: string },
  ator: Ator,
): ResultadoLote {
  const ator_ = db.dim_gerentes.find((g) => g.id_gerente === ator.idGerente);
  exigir(ator_ && ator_.status === 'Ativo', 'NAO_AUTORIZADO', 'Ator desconhecido ou inativo.');
  if (ator_.perfil !== 'Gerente Geral') exigirAcessoCliente(db, ator.idGerente, entrada.id_cliente, clock.agora(), 'Escrita');
  return aplicarLote(
    db,
    clock,
    { ids_clientes: [entrada.id_cliente], id_posicao_destino: entrada.id_posicao_destino, motivo: entrada.motivo, justificativa: entrada.justificativa, chave_idempotencia: entrada.chave_idempotencia },
    ator,
  );
}

/** Desfaz um lote com movimentações compensatórias; nunca edita nem apaga o histórico (FR-CLI-009). */
export function desfazerLote(db: Db, clock: Clock, idLote: string, ator: Ator): ResultadoLote {
  exigirGerenteGeral(db, ator);
  const originais = db.fct_movimentacao_carteira.filter((m) => m.id_lote === idLote && m.tipo !== 'Compensacao');
  exigir(originais.length > 0, 'LOTE_INEXISTENTE', `Lote ${idLote} não existe.`);
  const idDesfazer = `${idLote}-DESFAZER`;
  exigir(!db.fct_movimentacao_carteira.some((m) => m.id_lote === idDesfazer), 'LOTE_JA_DESFEITO', 'Lote já foi desfeito.');
  for (const m of originais) {
    const c = obterCliente(db, m.id_cliente);
    exigir(c.id_posicao_carteira === m.id_posicao_destino, 'LOTE_NAO_DESFAZIVEL', 'Cliente já foi movimentado depois do lote.', { id_cliente: c.id_cliente });
  }
  return emTransacao(db, () => {
    const movimentacoes = originais.map((m) => moverCliente(db, clock, obterCliente(db, m.id_cliente), m.id_posicao_origem, idDesfazer, `Desfazer ${idLote}`, ator.idGerente, 'Compensacao'));
    auditar(db, clock, ator.idGerente, 'LOTE_DESFEITO', 'fct_movimentacao_carteira', idLote, { clientes: movimentacoes.length });
    publicar(db, clock, 'LoteDesfeito', { id_lote: idLote });
    return { id_lote: idDesfazer, repetido: false, movimentacoes, capacidade_excedida: false };
  });
}

/** Revela o documento completo — única forma de ver CPF/CNPJ em claro; titular da posição ou GG, sempre auditada (Q-24). */
export function revelarDocumento(db: Db, clock: Clock, idCliente: string, ator: Ator): string {
  const g = db.dim_gerentes.find((x) => x.id_gerente === ator.idGerente);
  exigir(g && g.status === 'Ativo', 'NAO_AUTORIZADO', 'Ator desconhecido ou inativo.');
  const c = obterCliente(db, idCliente);
  const decisao = decidirCliente(db, ator.idGerente, idCliente, clock.agora());
  const ehTitular = decisao.origens.some((o) => o.origem === 'Titular');
  exigir(g.perfil === 'Gerente Geral' || ehTitular, 'ACESSO_NEGADO', 'Apenas o titular da posição ou o Gerente Geral revelam o documento.');
  auditar(db, clock, ator.idGerente, 'DOCUMENTO_REVELADO', 'dim_clientes', idCliente, {});
  return c.cpf_cnpj;
}

export function produtosDoCliente(db: Db, idCliente: string) {
  return db.fct_produtos_cliente.filter((p) => p.id_cliente === idCliente);
}

export function interacoesDoCliente(db: Db, idCliente: string) {
  return db.fct_interacoes_crm.filter((i) => i.id_cliente === idCliente).sort((a, b) => b.data.localeCompare(a.data));
}
