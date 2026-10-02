/** Tipos das respostas da API v1 (contrato: contracts/openapi.yaml). Só o que o front consome. */
export type Desbalanceamento = 'Acima' | 'Abaixo' | null;
export type Modo = 'Escrita' | 'Leitura';

export interface Titular { id_gerente: string; nome: string }
export interface OrigemAcesso { origem: 'Titular' | 'Delegado' | 'GerenteGeral'; id_delegacao?: string; escopo?: string; titular_ausente?: boolean }

export interface MetasPosicao { meta_aum: number; meta_clientes: number; utilizacao_minima: number; utilizacao_maxima: number }
export interface MetaPosicaoAtingimento {
  id_posicao: string; nome_posicao: string; aum: number; meta_aum: number; pct_meta_aum: number | null; clientes: number; meta_clientes: number;
  pct_meta_clientes: number | null; utilizacao: number; utilizacao_minima: number; utilizacao_maxima: number; desbalanceamento: Desbalanceamento;
}

export interface ResumoPosicao {
  id_posicao: string;
  nome_posicao: string;
  segmento_especialidade: string;
  status: string;
  titular: Titular | null;
  vaga: boolean;
  clientes_ativos: number;
  capacidade: number;
  utilizacao: number;
  aum_total: number;
  desbalanceamento: Desbalanceamento;
  metas: MetasPosicao;
  modo: Modo;
  origens: OrigemAcesso[];
}

export interface ResumoAgencia {
  calculado_em: string;
  escopo: 'Agencia' | 'Carteira';
  total_clientes: number;
  aum_total: number;
  aum_medio_por_cliente: number;
  penetracao_media: number;
  por_segmento: { segmento: string; clientes: number; aum: number }[];
  penetracao_por_produto: { codigo: string; nome: string; clientes: number; penetracao: number }[];
  posicoes: ResumoPosicao[];
  posicoes_em_alerta: number;
}

export type SeveridadeInsight = 'critico' | 'atencao' | 'info' | 'positivo';
export interface InsightNegocio { severidade: SeveridadeInsight; titulo: string; detalhe: string; destino?: 'cockpit' | 'posicoes' | 'carteira' | 'delegacoes' }
export interface ClienteResumo { id_cliente: string; nome: string; segmento: string; aum: number; id_posicao: string }
export interface AnaliseCarteira {
  calculado_em: string;
  escopo: 'Agencia' | 'Carteira';
  por_segmento: { segmento: string; clientes: number; aum: number }[];
  concentracao: { maior_cliente_pct: number; top10_pct: number; top20pct_clientes_pct: number; curva: { pct_clientes: number; pct_aum: number }[] };
  faixas_aum: { faixa: string; clientes: number; aum: number }[];
  faixas_score: { faixa: string; clientes: number }[];
  produtos_por_cliente: { produtos: string; clientes: number }[];
  serie_mensal: { mes: string; contratacoes: number; interacoes: number; novos_clientes: number }[];
  canais_90d: { canal: string; interacoes: number }[];
  mapa_posicao_segmento: { id_posicao: string; nome_posicao: string; celulas: { segmento: string; clientes: number }[] }[];
  engajamento: { sem_contato_90d: number; pct_sem_contato: number; prioritarios: (ClienteResumo & { dias_sem_contato: number | null })[] };
  oportunidades: (ClienteResumo & { produtos_ativos: number; produtos_faltantes: string[] })[];
  top_clientes: (ClienteResumo & { pct_do_total: number })[];
  delegacoes: { vigentes: number; expirando_7d: number };
  metas_posicoes: MetaPosicaoAtingimento[];
  insights: InsightNegocio[];
}

export type LeituraMetrica = 'melhora' | 'piora' | 'estavel' | 'neutra';
export interface MetricaComparada {
  chave: string; rotulo: string; unidade: 'clientes' | 'reais' | 'quantidade' | 'percentual';
  atual: number; anterior: number; variacao: number; variacao_pct: number | null; leitura: LeituraMetrica;
}
export interface ParPeriodo { atual: number; anterior: number }
export interface Comparativo {
  calculado_em: string;
  escopo: 'Agencia' | 'Carteira';
  dias: number;
  atual: { inicio: string; fim: string };
  anterior: { inicio: string; fim: string };
  metricas: MetricaComparada[];
  por_posicao: { id_posicao: string; nome_posicao: string; interacoes: ParPeriodo; contratacoes: ParPeriodo; novos_clientes: ParPeriodo }[];
  serie: { indice: number; inicio_atual: string; inicio_anterior: string; interacoes: ParPeriodo; contratacoes: ParPeriodo }[];
  ressalvas: string[];
}

export interface ClienteMascarado {
  id_cliente: string;
  nome_razao_social: string;
  cpf_cnpj_mascarado: string;
  segmento_cliente: string;
  faixa_renda_faturamento: number;
  volume_aum: number;
  score_risco: number;
  id_posicao: string;
  data_carteirizacao: string;
  status: string;
}

export interface SecaoCarteira {
  tipo: 'Propria' | 'Delegada';
  posicao: ResumoPosicao;
  cobertura?: { id_delegacao: string; escopo: string; data_fim: string; situacao: string };
  clientes: ClienteMascarado[];
}

export interface Visao360 {
  cliente: ClienteMascarado;
  posicao_atual: { id_posicao: string; nome_posicao: string };
  decisao: { modo: 'Escrita' | 'Leitura' | 'Negado'; origens: OrigemAcesso[]; motivo: string };
  linha_do_tempo: { id_posicao: string; nome_posicao: string; inicio_em: string; fim_em: string | null }[];
  produtos: { codigo: string; nome: string; contratado: boolean; data_contratacao: string | null }[];
  interacoes: { id_interacao: string; canal: string; data: string; nota: string }[];
}

export interface Ator { papel: string; rotulo: string; id_gerente: string | null }
export interface AtoresResposta { data_simulada: string; atores: Ator[] }

export interface Ocupacao { id_ocupacao: string; id_posicao: string; id_gerente: string; data_inicio: string; data_fim: string | null; tipo_vinculo: string; nome_gerente?: string }
export interface GerenteInfo { id_gerente: string; nome_completo: string; email_corporativo: string; perfil: string; status: string; posicao: string | null }

export type Situacao = 'Submetida' | 'Rejeitada' | 'Revogada' | 'Agendada' | 'Em Vigor' | 'Concluída';
export interface Delegacao {
  id_delegacao: string;
  id_posicao_origem: string;
  id_gerente_delegado: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  escopo: string;
  status_aprovacao: string;
  situacao: Situacao;
}

export interface SimulacaoRedistribuicao {
  id_posicao_destino: string;
  clientes_a_mover: string[];
  ignorados_ja_no_destino: string[];
  antes: { id_posicao: string; clientes_ativos: number; capacidade: number; utilizacao: number }[];
  depois: { id_posicao: string; clientes_ativos: number; capacidade: number; utilizacao: number }[];
  avisos: { codigo: string; mensagem: string; id_cliente?: string }[];
}

export interface ResultadoLote { id_lote: string; repetido: boolean; movimentacoes: { id_movimentacao: string; id_cliente: string }[]; capacidade_excedida: boolean }

export interface Pagina<T> { itens: T[]; total: number; proximo_cursor: number | null }

export interface Sessao { papel: string; dataSimulada: string | null }
