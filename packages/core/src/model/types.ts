/** Linhas das tabelas (nomes = colunas do dicionário de dados, domínio 06). */
export type PerfilGerente = 'Gerente de Contas' | 'Gerente Geral';
export type StatusGerente = 'Ativo' | 'Afastado' | 'Desligado';
export type StatusPosicao = 'Ativa' | 'Congelada' | 'Extinta';
export type SegmentoPosicao = 'Private' | 'Alta Renda' | 'Middle Market' | 'Misto';
export type SegmentoCliente = 'UHNW' | 'Private' | 'Alta Renda' | 'Varejo';
export type TipoVinculo = 'Titular Efetivo' | 'Trainee' | 'Interino';
export type EscopoDelegacao = 'Total' | 'Apenas Consulta' | 'Apenas Emergencial';
export type StatusAprovacao = 'Submetida' | 'Aprovada' | 'Rejeitada' | 'Revogada';
export type StatusCliente = 'Ativo' | 'Em Prospecção' | 'Inativo';
export type TipoMovimentacao = 'Redistribuicao' | 'Transferencia' | 'Compensacao';

export interface RefSegmento { codigo: string; nome: string; ordem: number }
export interface RefProduto { codigo: string; nome: string }
export interface Agencia { id_agencia: string; nome: string; cidade: string }

export interface Posicao {
  id_posicao: string;
  nome_posicao: string;
  id_agencia: string;
  segmento_especialidade: SegmentoPosicao;
  capacidade_max_contas: number;
  status: StatusPosicao;
}

export interface Gerente {
  id_gerente: string;
  nome_completo: string;
  email_corporativo: string;
  perfil: PerfilGerente;
  status: StatusGerente;
}

export interface Ocupacao {
  id_ocupacao: string;
  id_posicao: string;
  id_gerente: string;
  data_inicio: string;
  data_fim: string | null;
  tipo_vinculo: TipoVinculo;
}

export interface Delegacao {
  id_delegacao: string;
  id_posicao_origem: string;
  id_gerente_delegado: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  escopo: EscopoDelegacao;
  status_aprovacao: StatusAprovacao;
  criada_por: string;
  criada_em: string;
  decidida_por: string | null;
  decidida_em: string | null;
  revogada_em: string | null;
}

export interface Cliente {
  id_cliente: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  segmento_cliente: SegmentoCliente;
  faixa_renda_faturamento: number;
  volume_aum: number;
  score_risco: number;
  id_posicao_carteira: string;
  data_carteirizacao: string;
  status: StatusCliente;
}

export interface VinculoCarteira {
  id_vinculo: string;
  id_cliente: string;
  id_posicao: string;
  inicio_em: string;
  fim_em: string | null;
}

export interface ProdutoCliente { id_cliente: string; codigo_produto: string; status: 'Ativo' | 'Inativo'; data_contratacao: string }
export interface InteracaoCrm { id_interacao: string; id_cliente: string; id_posicao: string; canal: string; data: string; nota: string }

export interface Movimentacao {
  id_movimentacao: string;
  id_lote: string;
  id_cliente: string;
  id_posicao_origem: string;
  id_posicao_destino: string;
  motivo: string;
  ator: string;
  instante: string;
  tipo: TipoMovimentacao;
}

/** Metas e limites de alerta de uma posição (configuráveis pelo Gerente Geral). 0 em uma meta = sem meta. */
export interface MetaPosicao {
  id_posicao: string;
  meta_aum: number;
  meta_clientes: number;
  utilizacao_minima: number;
  utilizacao_maxima: number;
  atualizado_por: string;
  atualizado_em: string;
}

export interface LogAuditoria { id_log: string; instante: string; ator: string; acao: string; entidade: string; id_entidade: string; detalhe: string }
export interface LogEvento { id_evento: string; instante: string; tipo: string; payload: string }

export interface Db {
  ref_segmentos: RefSegmento[];
  ref_produtos: RefProduto[];
  dim_agencias: Agencia[];
  dim_posicoes: Posicao[];
  dim_gerentes: Gerente[];
  bridge_ocupacao_posicao: Ocupacao[];
  fct_delegacoes: Delegacao[];
  dim_clientes: Cliente[];
  bridge_vinculo_carteira: VinculoCarteira[];
  fct_produtos_cliente: ProdutoCliente[];
  fct_interacoes_crm: InteracaoCrm[];
  fct_movimentacao_carteira: Movimentacao[];
  cfg_metas_posicao: MetaPosicao[];
  log_auditoria: LogAuditoria[];
  log_eventos: LogEvento[];
}

export type NomeTabela = keyof Db;

export interface Ator { idGerente: string }
