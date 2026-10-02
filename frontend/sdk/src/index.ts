import * as React from 'react';
import type {
  AtoresResposta, ClienteMascarado, Delegacao, GerenteInfo, Ocupacao, Pagina, ResultadoLote, ResumoAgencia, ResumoPosicao,
  SecaoCarteira, Sessao, SimulacaoRedistribuicao, Visao360,
} from './tipos';

export * from './tipos';

/** Erro de API (problem+json, RFC 9457) com `codigo_dominio` estável. */
export class ApiErro extends Error {
  constructor(public readonly status: number, public readonly codigo: string, mensagem: string, public readonly correlationId?: string) {
    super(mensagem);
    this.name = 'ApiErro';
  }
}

export interface ConfigApi {
  baseUrl: string;
  /** Sessão atual (papel simulado e data de demonstração); lida a cada chamada. */
  obterSessao: () => Sessao;
  fetchImpl?: typeof fetch;
}

/** Cliente tipado da API v1. Nenhuma regra de negócio: só transporte (FR-UX-014). */
export function criarApi(cfg: ConfigApi) {
  const f = cfg.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, opcoes: { corpo?: unknown; chave?: string; semSessao?: boolean } = {}): Promise<T> {
    const sessao = cfg.obterSessao();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opcoes.corpo !== undefined) headers['Content-Type'] = 'application/json';
    if (!opcoes.semSessao || sessao.dataSimulada) {
      if (sessao.dataSimulada) headers['X-Data-Simulada'] = sessao.dataSimulada;
    }
    if (!opcoes.semSessao && sessao.papel) headers['X-Papel-Simulado'] = sessao.papel;
    if (opcoes.chave) headers['Idempotency-Key'] = opcoes.chave;
    const resp = await f(`${cfg.baseUrl}${caminho}`, { method: metodo, headers, body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo) });
    const texto = await resp.text();
    const corpo = texto ? (JSON.parse(texto) as unknown) : null;
    if (!resp.ok) {
      const p = (corpo ?? {}) as { codigo_dominio?: string; detail?: string; correlation_id?: string };
      throw new ApiErro(resp.status, p.codigo_dominio ?? 'ERRO', p.detail ?? `Falha ${resp.status}`, p.correlation_id);
    }
    return corpo as T;
  }

  const q = (params: Record<string, string | number | undefined | null>): string => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
    const r = s.toString();
    return r ? `?${r}` : '';
  };

  return {
    atores: () => chamar<AtoresResposta>('GET', '/simulacao/atores', { semSessao: true }),
    reiniciarCenario: () => chamar<{ reiniciado: boolean }>('POST', '/simulacao/reset', { semSessao: true }),

    posicoes: () => chamar<{ itens: ResumoPosicao[] }>('GET', '/posicoes'),
    historico: (id: string) => chamar<{ itens: (Ocupacao & { nome_gerente: string })[] }>('GET', `/posicoes/${id}/historico`),
    trocarTitular: (id: string, corpo: { id_gerente: string; data_inicio: string; tipo_vinculo: string; motivo?: string }) => chamar<Ocupacao>('POST', `/posicoes/${id}/titular`, { corpo }),
    gerentes: () => chamar<{ itens: GerenteInfo[] }>('GET', '/gerentes'),

    delegacoes: () => chamar<{ itens: Delegacao[] }>('GET', '/delegacoes'),
    submeterDelegacao: (corpo: { id_posicao_origem: string; id_gerente_delegado: string; data_inicio: string; data_fim: string; motivo: string; escopo: string }) => chamar<Delegacao>('POST', '/delegacoes', { corpo }),
    aprovarDelegacao: (id: string) => chamar<Delegacao>('POST', `/delegacoes/${id}/aprovacao`),
    rejeitarDelegacao: (id: string) => chamar<Delegacao>('POST', `/delegacoes/${id}/rejeicao`),
    revogarDelegacao: (id: string) => chamar<Delegacao>('POST', `/delegacoes/${id}/revogacao`),

    minhaCarteira: () => chamar<{ secoes: SecaoCarteira[] }>('GET', '/carteira/minha'),
    clientes: (p: { posicao?: string; segmento?: string; status?: string; q?: string; limit?: number; cursor?: number } = {}) =>
      chamar<Pagina<Omit<ClienteMascarado, 'faixa_renda_faturamento' | 'data_carteirizacao'> & Partial<ClienteMascarado>>>('GET', `/carteira/clientes${q(p)}`),
    visao360: (id: string) => chamar<Visao360>('GET', `/clientes/${id}/visao-360`),
    transferir: (id: string, corpo: { id_posicao_destino: string; motivo: string; justificativa?: string }, chave?: string) => chamar<ResultadoLote>('POST', `/clientes/${id}/transferencia`, { corpo, chave }),
    revelarDocumento: (id: string) => chamar<{ cpf_cnpj: string }>('POST', `/clientes/${id}/documento:revelar`),

    simularRedistribuicao: (corpo: { ids_clientes: string[]; id_posicao_destino: string }) => chamar<SimulacaoRedistribuicao>('POST', '/carteira/redistribuicoes:simular', { corpo }),
    redistribuir: (corpo: { ids_clientes: string[]; id_posicao_destino: string; motivo: string; justificativa?: string }, chave: string) => chamar<ResultadoLote>('POST', '/carteira/redistribuicoes', { corpo, chave }),
    desfazerLote: (id: string) => chamar<ResultadoLote>('POST', `/carteira/redistribuicoes/${id}:desfazer`),

    agencia: () => chamar<ResumoAgencia>('GET', '/insights/agencia'),
    desbalanceamento: () => chamar<{ itens: ResumoPosicao[] }>('GET', '/insights/desbalanceamento'),
  };
}

export type Api = ReturnType<typeof criarApi>;

/* ----------------------------------------------------------------------------------------------
 * Contrato de micro-frontend (FR-UX-001/004): props de entrada = ator/instante + API; saída = eventos tipados.
 * Nenhum MFE importa outro MFE nem compartilha estado global ad hoc.
 * -------------------------------------------------------------------------------------------- */
export type EventoMfe =
  | { tipo: 'navegar'; destino: 'cockpit' | 'posicoes' | 'carteira' | 'delegacoes' }
  | { tipo: 'cliente-selecionado'; idCliente: string }
  | { tipo: 'abrir-redistribuicao'; idPosicaoOrigem?: string }
  | { tipo: 'dados-alterados'; origem: 'posicoes' | 'delegacao' | 'carteira' | 'cockpit' };

/** Comando do shell para um MFE (ex.: abrir o assistente de redistribuição vindo da Torre de Controle). */
export type ComandoMfe = { tipo: 'abrir-redistribuicao'; idPosicaoOrigem?: string; nonce: number };

export interface PropsMfe {
  api: Api;
  sessao: Sessao;
  /** Id da posição do ator (null para o GG) — só para destaque visual; a autorização é do servidor. */
  ehGerenteGeral: boolean;
  /** Incrementa a cada mutação para que as consultas se atualizem. */
  versao: number;
  emitir: (evento: EventoMfe) => void;
  comando?: ComandoMfe;
}

export const EVENTO_MFE = 'carteira:evento';

/** Estado de uma consulta assíncrona com carregamento, erro e recarga — usa só o contrato da API. */
export function useConsulta<T>(buscar: () => Promise<T>, deps: React.DependencyList) {
  const [estado, setEstado] = React.useState<{ dados: T | null; erro: ApiErro | Error | null; carregando: boolean }>({ dados: null, erro: null, carregando: true });
  const [tentativa, setTentativa] = React.useState(0);
  React.useEffect(() => {
    let atual = true;
    setEstado((e) => ({ ...e, erro: null, carregando: true }));
    buscar().then(
      (dados) => { if (atual) setEstado({ dados, erro: null, carregando: false }); },
      (erro: unknown) => { if (atual) setEstado({ dados: null, erro: erro instanceof Error ? erro : new Error(String(erro)), carregando: false }); },
    );
    return () => { atual = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tentativa]);
  return { ...estado, recarregar: () => setTentativa((n) => n + 1) };
}
