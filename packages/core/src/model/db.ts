import type { Db, NomeTabela } from './types.ts';

export type TipoColuna = 'string' | 'number';

/** Esquema físico das tabelas — fonte única para adaptadores (Sheets) e para a homologação (Apps Script). */
export const TABELAS: Record<NomeTabela, { colunas: readonly (readonly [string, TipoColuna])[]; pk: readonly string[] }> = {
  ref_segmentos: { pk: ['codigo'], colunas: [['codigo', 'string'], ['nome', 'string'], ['ordem', 'number']] },
  ref_produtos: { pk: ['codigo'], colunas: [['codigo', 'string'], ['nome', 'string']] },
  dim_agencias: { pk: ['id_agencia'], colunas: [['id_agencia', 'string'], ['nome', 'string'], ['cidade', 'string']] },
  dim_posicoes: {
    pk: ['id_posicao'],
    colunas: [['id_posicao', 'string'], ['nome_posicao', 'string'], ['id_agencia', 'string'], ['segmento_especialidade', 'string'], ['capacidade_max_contas', 'number'], ['status', 'string']],
  },
  dim_gerentes: {
    pk: ['id_gerente'],
    colunas: [['id_gerente', 'string'], ['nome_completo', 'string'], ['email_corporativo', 'string'], ['perfil', 'string'], ['status', 'string']],
  },
  bridge_ocupacao_posicao: {
    pk: ['id_ocupacao'],
    colunas: [['id_ocupacao', 'string'], ['id_posicao', 'string'], ['id_gerente', 'string'], ['data_inicio', 'string'], ['data_fim', 'string'], ['tipo_vinculo', 'string']],
  },
  fct_delegacoes: {
    pk: ['id_delegacao'],
    colunas: [
      ['id_delegacao', 'string'], ['id_posicao_origem', 'string'], ['id_gerente_delegado', 'string'], ['data_inicio', 'string'], ['data_fim', 'string'],
      ['motivo', 'string'], ['escopo', 'string'], ['status_aprovacao', 'string'], ['criada_por', 'string'], ['criada_em', 'string'],
      ['decidida_por', 'string'], ['decidida_em', 'string'], ['revogada_em', 'string'],
    ],
  },
  dim_clientes: {
    pk: ['id_cliente'],
    colunas: [
      ['id_cliente', 'string'], ['nome_razao_social', 'string'], ['cpf_cnpj', 'string'], ['segmento_cliente', 'string'], ['faixa_renda_faturamento', 'number'],
      ['volume_aum', 'number'], ['score_risco', 'number'], ['id_posicao_carteira', 'string'], ['data_carteirizacao', 'string'], ['status', 'string'],
    ],
  },
  bridge_vinculo_carteira: {
    pk: ['id_vinculo'],
    colunas: [['id_vinculo', 'string'], ['id_cliente', 'string'], ['id_posicao', 'string'], ['inicio_em', 'string'], ['fim_em', 'string']],
  },
  fct_produtos_cliente: {
    pk: ['id_cliente', 'codigo_produto'],
    colunas: [['id_cliente', 'string'], ['codigo_produto', 'string'], ['status', 'string'], ['data_contratacao', 'string']],
  },
  fct_interacoes_crm: {
    pk: ['id_interacao'],
    colunas: [['id_interacao', 'string'], ['id_cliente', 'string'], ['id_posicao', 'string'], ['canal', 'string'], ['data', 'string'], ['nota', 'string']],
  },
  fct_movimentacao_carteira: {
    pk: ['id_movimentacao'],
    colunas: [
      ['id_movimentacao', 'string'], ['id_lote', 'string'], ['id_cliente', 'string'], ['id_posicao_origem', 'string'], ['id_posicao_destino', 'string'],
      ['motivo', 'string'], ['ator', 'string'], ['instante', 'string'], ['tipo', 'string'],
    ],
  },
  log_auditoria: {
    pk: ['id_log'],
    colunas: [['id_log', 'string'], ['instante', 'string'], ['ator', 'string'], ['acao', 'string'], ['entidade', 'string'], ['id_entidade', 'string'], ['detalhe', 'string']],
  },
  log_eventos: { pk: ['id_evento'], colunas: [['id_evento', 'string'], ['instante', 'string'], ['tipo', 'string'], ['payload', 'string']] },
};

export const NOMES_TABELAS = Object.keys(TABELAS) as NomeTabela[];

export function criarDbVazio(): Db {
  return Object.fromEntries(NOMES_TABELAS.map((t) => [t, []])) as unknown as Db;
}

export function clonarDb(db: Db): Db {
  return structuredClone(db);
}

/** Executa `fn` de forma atômica: se lançar, todas as tabelas voltam ao estado anterior (nenhuma escrita parcial). */
export function emTransacao<T>(db: Db, fn: () => T): T {
  const snapshot = structuredClone(db);
  try {
    return fn();
  } catch (erro) {
    for (const t of NOMES_TABELAS) (db[t] as unknown[]) = snapshot[t] as unknown[];
    throw erro;
  }
}

/** Próximo identificador sequencial `PREFIXO-0001` com base nos existentes. */
export function proximoId(prefixo: string, existentes: readonly string[], largura = 4): string {
  let max = 0;
  const re = new RegExp(`^${prefixo}-(\\d+)$`);
  for (const id of existentes) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefixo}-${String(max + 1).padStart(largura, '0')}`;
}
