import { z, ZodError } from 'zod';
import {
  acesso, auditar, clientes, delegacao, DomainError, FixedClock, insights, isISODate, meioDia, diaDe, posicoes,
  type Clock, type Db, type Ator, type CodigoErro,
} from '@carteira/core';
import type { Store } from './store.ts';

/**
 * API REST v1 (domínio 07): adaptador fino sobre os casos de uso do núcleo. Não contém regra de negócio.
 * - O ator vem do contexto da requisição (nunca de e-mail na URL — achado 8). Na POC, papel simulado por cabeçalho
 *   sob a *feature flag* SIMULACAO_PAPEL (FR-ACE-009); desligada, não há autenticação real ainda ⇒ 401.
 * - Erros em application/problem+json com `codigo_dominio` estável (RFC 9457).
 */

/** Parâmetros de query (substitui URLSearchParams, que o Apps Script não tem). */
export interface Consulta {
  get(nome: string): string | null;
}

/** Requisição já decomposta e SÍNCRONA — o mesmo manipulador roda em Node (fetch) e no Apps Script (google.script.run). */
export interface RequisicaoApi {
  metodo: string;
  /** Caminho sem query, com ou sem o prefixo /api/v1. */
  caminho: string;
  consulta: Record<string, string>;
  /** Cabeçalhos em minúsculas. */
  headers: Record<string, string>;
  corpo?: unknown;
  corpoInvalido?: boolean;
}

export interface RespostaApi {
  status: number;
  headers: Record<string, string>;
  corpo: unknown;
}

export interface OpcoesApp {
  store: Store;
  simulacaoPapel: boolean;
  log?: (linha: Record<string, unknown>) => void;
}

interface Contexto {
  store: Store;
  db: Db;
  ator: Ator;
  clock: Clock;
  instante: Date;
  corpo: unknown;
  params: Record<string, string>;
  consulta: Consulta;
  idempotencia: string | undefined;
}

type Tratador = (c: Contexto) => unknown;
interface Rota {
  metodo: 'GET' | 'POST';
  caminho: string;
  tratador: Tratador;
  /** Escreve no banco ⇒ persistir após sucesso. */
  escrita?: boolean;
  /** Não exige ator (ex.: saúde, lista de papéis da simulação). */
  publica?: boolean;
  status?: number;
}

const STATUS: Partial<Record<CodigoErro, number>> = {
  ACESSO_NEGADO: 403, NAO_AUTORIZADO: 403, ATOR_DESCONHECIDO: 403,
  POSICAO_INEXISTENTE: 404, GERENTE_INEXISTENTE: 404, DELEGACAO_INEXISTENTE: 404, CLIENTE_INEXISTENTE: 404, LOTE_INEXISTENTE: 404,
  OCUPACAO_SOBREPOSTA: 409, GERENTE_JA_ALOCADO: 409, DELEGACAO_SOBREPOSTA: 409, DOCUMENTO_DUPLICADO: 409, EMAIL_DUPLICADO: 409,
  ESTADO_INVALIDO: 409, LOTE_JA_DESFEITO: 409, LOTE_NAO_DESFAZIVEL: 409, POSICAO_COM_CARTEIRA: 409, TRANSICAO_INVALIDA: 409,
};

const data = z.string().refine(isISODate, 'Data deve estar no formato AAAA-MM-DD');
const tipoVinculo = z.enum(['Titular Efetivo', 'Trainee', 'Interino']);
const corpos = {
  titular: z.object({ id_gerente: z.string().min(1), data_inicio: data, tipo_vinculo: tipoVinculo, motivo: z.string().optional() }),
  delegacao: z.object({
    id_posicao_origem: z.string().min(1), id_gerente_delegado: z.string().min(1), data_inicio: data, data_fim: data,
    motivo: z.string().min(1), escopo: z.enum(['Total', 'Apenas Consulta', 'Apenas Emergencial']),
  }),
  transferencia: z.object({ id_posicao_destino: z.string().min(1), motivo: z.string().min(1), justificativa: z.string().optional() }),
  simulacao: z.object({ ids_clientes: z.array(z.string()).min(1), id_posicao_destino: z.string().min(1) }),
  redistribuicao: z.object({ ids_clientes: z.array(z.string()).min(1), id_posicao_destino: z.string().min(1), motivo: z.string().min(1), justificativa: z.string().optional() }),
};

function analisar<T>(esquema: z.ZodType<T>, corpo: unknown): T {
  const r = esquema.safeParse(corpo);
  if (!r.success) throw new DomainError('DADOS_INVALIDOS', r.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`).join('; '));
  return r.data;
}

function instanteDe(c: Contexto, asof: string | null): Date {
  if (!asof) return c.instante;
  if (!isISODate(asof)) throw new DomainError('DADOS_INVALIDOS', 'asof deve estar no formato AAAA-MM-DD');
  return meioDia(asof);
}

const ctxInsights = (c: Contexto, asof?: string | null) => ({ idGerente: c.ator.idGerente, instante: instanteDe(c, asof ?? null) });

function exigirGG(c: Contexto): void {
  const g = c.db.dim_gerentes.find((x) => x.id_gerente === c.ator.idGerente);
  if (g?.perfil !== 'Gerente Geral') throw new DomainError('NAO_AUTORIZADO', 'Operação restrita ao Gerente Geral.');
}

function exigirPosicaoVisivel(c: Contexto, idPosicao: string, instante = c.instante): void {
  posicoes.obterPosicao(c.db, idPosicao);
  if (!acesso.decidirPosicao(c.db, c.ator.idGerente, idPosicao, instante).permitido) throw new DomainError('ACESSO_NEGADO', 'Acesso negado à posição.');
}

function visaoDelegacao(c: Contexto, d: ReturnType<typeof delegacao.obterDelegacao>) {
  return { ...d, situacao: delegacao.situacao(d, c.instante) };
}

const ROTAS: Rota[] = [
  { metodo: 'GET', caminho: '/saude', publica: true, tratador: () => ({ status: 'ok' }) },
  {
    metodo: 'GET', caminho: '/simulacao/atores', publica: true,
    tratador: (c) => {
      const dia = diaDe(c.instante);
      const gg = c.db.dim_gerentes.find((g) => g.perfil === 'Gerente Geral' && g.status === 'Ativo');
      return {
        data_simulada: dia,
        atores: [
          ...(gg ? [{ papel: 'GG', rotulo: `Gerente Geral — ${gg.nome_completo}`, id_gerente: gg.id_gerente }] : []),
          ...c.db.dim_posicoes.map((p) => {
            const t = posicoes.titularVigente(c.db, p.id_posicao, dia);
            const nome = t ? c.db.dim_gerentes.find((g) => g.id_gerente === t.id_gerente)?.nome_completo : null;
            return { papel: p.id_posicao, rotulo: `${p.nome_posicao} — ${nome ?? 'vaga'}`, id_gerente: t?.id_gerente ?? null };
          }),
        ],
      };
    },
  },
  { metodo: 'POST', caminho: '/simulacao/reset', publica: true, escrita: false, tratador: (c) => { c.store.reiniciar(); return { reiniciado: true }; } },

  { metodo: 'GET', caminho: '/posicoes', tratador: (c) => ({ itens: insights.resumoAgencia(c.db, ctxInsights(c)).posicoes }) },
  {
    metodo: 'GET', caminho: '/posicoes/{id}/titular',
    tratador: (c) => {
      const dia = diaDe(instanteDe(c, c.consulta.get('asof')));
      exigirPosicaoVisivel(c, c.params.id!, instanteDe(c, c.consulta.get('asof')));
      const o = posicoes.titularVigente(c.db, c.params.id!, dia);
      const g = o ? c.db.dim_gerentes.find((x) => x.id_gerente === o.id_gerente) : undefined;
      return { id_posicao: c.params.id, data: dia, vaga: !o, ocupacao: o, gerente: g ? { id_gerente: g.id_gerente, nome_completo: g.nome_completo } : null };
    },
  },
  {
    metodo: 'GET', caminho: '/posicoes/{id}/historico',
    tratador: (c) => {
      exigirPosicaoVisivel(c, c.params.id!);
      return { itens: posicoes.historicoDaPosicao(c.db, c.params.id!).map((o) => ({ ...o, nome_gerente: c.db.dim_gerentes.find((g) => g.id_gerente === o.id_gerente)?.nome_completo ?? o.id_gerente })) };
    },
  },
  {
    metodo: 'POST', caminho: '/posicoes/{id}/titular', escrita: true, status: 201,
    tratador: (c) => posicoes.trocarTitular(c.db, c.clock, { id_posicao: c.params.id!, ...analisar(corpos.titular, c.corpo) }, c.ator),
  },
  {
    metodo: 'GET', caminho: '/gerentes',
    tratador: (c) => { exigirGG(c); return { itens: c.db.dim_gerentes.map((g) => ({ ...g, posicao: posicoes.ocupacaoDoGerente(c.db, g.id_gerente, diaDe(c.instante))?.id_posicao ?? null })) }; },
  },

  {
    metodo: 'GET', caminho: '/delegacoes',
    tratador: (c) => {
      const gg = c.db.dim_gerentes.find((g) => g.id_gerente === c.ator.idGerente)?.perfil === 'Gerente Geral';
      const dia = diaDe(c.instante);
      const pos = c.consulta.get('posicao');
      const itens = c.db.fct_delegacoes
        .filter((d) => !pos || d.id_posicao_origem === pos)
        .filter((d) => gg || d.id_gerente_delegado === c.ator.idGerente || d.criada_por === c.ator.idGerente || posicoes.titularVigente(c.db, d.id_posicao_origem, dia)?.id_gerente === c.ator.idGerente)
        .map((d) => visaoDelegacao(c, d));
      return { itens };
    },
  },
  { metodo: 'POST', caminho: '/delegacoes', escrita: true, status: 201, tratador: (c) => visaoDelegacao(c, delegacao.submeter(c.db, c.clock, analisar(corpos.delegacao, c.corpo), c.ator)) },
  { metodo: 'POST', caminho: '/delegacoes/{id}/aprovacao', escrita: true, tratador: (c) => visaoDelegacao(c, delegacao.aprovar(c.db, c.clock, c.params.id!, c.ator)) },
  { metodo: 'POST', caminho: '/delegacoes/{id}/rejeicao', escrita: true, tratador: (c) => visaoDelegacao(c, delegacao.rejeitar(c.db, c.clock, c.params.id!, c.ator)) },
  { metodo: 'POST', caminho: '/delegacoes/{id}/revogacao', escrita: true, tratador: (c) => visaoDelegacao(c, delegacao.revogar(c.db, c.clock, c.params.id!, c.ator)) },

  {
    metodo: 'GET', caminho: '/carteira/clientes',
    tratador: (c) => {
      const limite = Math.min(Number(c.consulta.get('limit') ?? 50) || 50, 200);
      const inicio = Number(c.consulta.get('cursor') ?? 0) || 0;
      const q = (c.consulta.get('q') ?? '').toLowerCase();
      const filtrados = insights
        .clientesVisiveis(c.db, ctxInsights(c, c.consulta.get('asof')))
        .filter((x) => (!c.consulta.get('posicao') || x.posicao_no_instante === c.consulta.get('posicao'))
          && (!c.consulta.get('segmento') || x.segmento_cliente === c.consulta.get('segmento'))
          && (!c.consulta.get('status') || x.status === c.consulta.get('status'))
          && (!q || x.nome_razao_social.toLowerCase().includes(q) || x.id_cliente.toLowerCase().includes(q)))
        .sort((a, b) => a.id_cliente.localeCompare(b.id_cliente));
      const pagina = filtrados.slice(inicio, inicio + limite).map(({ posicao_no_instante, ...resto }) => ({ ...clientes.clienteMascarado(resto), id_posicao: posicao_no_instante }));
      return { itens: pagina, total: filtrados.length, proximo_cursor: inicio + limite < filtrados.length ? inicio + limite : null };
    },
  },
  { metodo: 'GET', caminho: '/carteira/minha', tratador: (c) => ({ secoes: insights.carteiraDoAtor(c.db, ctxInsights(c, c.consulta.get('asof'))) }) },
  { metodo: 'GET', caminho: '/clientes/{id}/visao-360', tratador: (c) => insights.visao360(c.db, ctxInsights(c, c.consulta.get('asof')), c.params.id!) },
  {
    metodo: 'POST', caminho: '/clientes/{id}/transferencia', escrita: true,
    tratador: (c) => clientes.transferirCliente(c.db, c.clock, { id_cliente: c.params.id!, ...analisar(corpos.transferencia, c.corpo), chave_idempotencia: c.idempotencia }, c.ator),
  },
  { metodo: 'POST', caminho: '/clientes/{id}/documento:revelar', escrita: true, tratador: (c) => ({ cpf_cnpj: clientes.revelarDocumento(c.db, c.clock, c.params.id!, c.ator) }) },

  { metodo: 'POST', caminho: '/carteira/redistribuicoes:simular', tratador: (c) => { exigirGG(c); return clientes.simularRedistribuicao(c.db, analisar(corpos.simulacao, c.corpo)); } },
  {
    metodo: 'POST', caminho: '/carteira/redistribuicoes', escrita: true, status: 201,
    tratador: (c) => clientes.executarRedistribuicao(c.db, c.clock, { ...analisar(corpos.redistribuicao, c.corpo), chave_idempotencia: c.idempotencia }, c.ator),
  },
  { metodo: 'POST', caminho: '/carteira/redistribuicoes/{id}:desfazer', escrita: true, tratador: (c) => clientes.desfazerLote(c.db, c.clock, c.params.id!, c.ator) },

  { metodo: 'GET', caminho: '/insights/agencia', tratador: (c) => insights.resumoAgencia(c.db, ctxInsights(c, c.consulta.get('asof'))) },
  {
    metodo: 'GET', caminho: '/insights/posicoes/{id}',
    tratador: (c) => {
      const r = insights.resumoAgencia(c.db, ctxInsights(c, c.consulta.get('asof'))).posicoes.find((p) => p.id_posicao === c.params.id);
      if (!r) throw new DomainError('ACESSO_NEGADO', 'Acesso negado à posição.');
      return r;
    },
  },
  { metodo: 'GET', caminho: '/insights/desbalanceamento', tratador: (c) => ({ itens: insights.desbalanceamentos(c.db, ctxInsights(c, c.consulta.get('asof'))) }) },
  {
    metodo: 'GET', caminho: '/acesso/explicacao',
    tratador: (c) => {
      const cliente = c.consulta.get('cliente');
      if (!cliente) throw new DomainError('DADOS_INVALIDOS', 'Informe ?cliente=');
      return acesso.decidirCliente(c.db, c.ator.idGerente, cliente, instanteDe(c, c.consulta.get('asof')));
    },
  },
];

/** Contrato publicado: lista de rotas para o teste de consistência com o OpenAPI. */
export const ROTAS_PUBLICADAS = ROTAS.map((r) => `${r.metodo} ${r.caminho}`);

function compilar(caminho: string): { re: RegExp; nomes: string[] } {
  const nomes: string[] = [];
  const re = caminho.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_m, n: string) => { nomes.push(n); return '([^/:]+)'; });
  return { re: new RegExp(`^${re}$`), nomes };
}
const COMPILADAS = ROTAS.map((r) => ({ rota: r, ...compilar(r.caminho) }));

function problema(status: number, codigo: string, detalhe: string, correlacao: string, extra: Record<string, unknown> = {}): RespostaApi {
  return {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
    corpo: { type: `https://carteira.example/erros/${codigo}`, title: codigo, status, detail: detalhe, codigo_dominio: codigo, correlation_id: correlacao, ...extra },
  };
}

/**
 * Manipulador SÍNCRONO da API (roda igual em Node e no Apps Script). A persistência assíncrona do Sheets em Node é
 * enfileirada por `store.persistir()` e aguardada por quem chama (`store.drenar`).
 */
export function criarManipulador(opcoes: OpcoesApp): (req: RequisicaoApi) => RespostaApi {
  const log = opcoes.log ?? (() => undefined);
  let contador = 0;

  return function tratar(req: RequisicaoApi): RespostaApi {
    const correlacao = req.headers['x-correlation-id'] ?? `c-${Date.now().toString(36)}-${(contador += 1)}`;
    const cabecalhos: Record<string, string> = { 'X-Correlation-Id': correlacao };
    if (opcoes.simulacaoPapel) cabecalhos['X-Modo-Simulacao'] = 'true';
    const cors: Record<string, string> = opcoes.simulacaoPapel
      ? { 'Access-Control-Allow-Origin': req.headers.origin ?? '*', 'Access-Control-Allow-Headers': 'content-type,x-papel-simulado,x-data-simulada,idempotency-key,x-correlation-id', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Expose-Headers': 'x-modo-simulacao,x-correlation-id' }
      : {};
    const finalizar = (resp: RespostaApi): RespostaApi => ({ ...resp, headers: { ...resp.headers, ...cabecalhos, ...cors } });
    if (req.metodo === 'OPTIONS') return finalizar({ status: 204, headers: {}, corpo: null });

    const caminho = req.caminho.replace(/^\/api\/v1/, '') || '/';
    const alvo = COMPILADAS.find((r) => r.rota.metodo === req.metodo && r.re.test(caminho));
    if (!alvo) {
      const existe = COMPILADAS.some((r) => r.re.test(caminho));
      return finalizar(problema(existe ? 405 : 404, existe ? 'METODO_NAO_PERMITIDO' : 'ROTA_INEXISTENTE', `${req.metodo} ${req.caminho}`, correlacao));
    }
    const m = alvo.re.exec(caminho)!;
    const params = Object.fromEntries(alvo.nomes.map((n, i) => [n, decodeURIComponent(m[i + 1]!)]));
    const consulta: Consulta = { get: (nome) => (Object.prototype.hasOwnProperty.call(req.consulta, nome) ? req.consulta[nome]! : null) };
    const inicio = Date.now();
    let status = 200;
    let ator = '-';
    try {
      const store = opcoes.store;
      const dataSimulada = opcoes.simulacaoPapel ? (req.headers['x-data-simulada'] ?? null) : null;
      if (dataSimulada && !isISODate(dataSimulada)) throw new DomainError('DADOS_INVALIDOS', 'X-Data-Simulada deve estar no formato AAAA-MM-DD');
      const clock: Clock = dataSimulada ? new FixedClock(meioDia(dataSimulada)) : store.clock;
      const instante = clock.agora();

      let idGerente = '';
      if (!alvo.rota.publica) {
        const papel = opcoes.simulacaoPapel ? (req.headers['x-papel-simulado'] ?? null) : null;
        if (!opcoes.simulacaoPapel) return finalizar(problema(401, 'NAO_AUTENTICADO', 'Autenticação real ainda não implementada; habilite SIMULACAO_PAPEL somente na POC.', correlacao));
        if (!papel) return finalizar(problema(401, 'NAO_AUTENTICADO', 'Informe o cabeçalho X-Papel-Simulado (GG ou id da posição).', correlacao));
        const g = papel === 'GG'
          ? store.db.dim_gerentes.find((x) => x.perfil === 'Gerente Geral' && x.status === 'Ativo')?.id_gerente
          : posicoes.titularVigente(store.db, papel, diaDe(instante))?.id_gerente;
        if (!g) throw new DomainError('ATOR_DESCONHECIDO', 'Papel sem titular vigente ou desconhecido.');
        idGerente = g;
        ator = g;
      }

      if (req.corpoInvalido) throw new DomainError('DADOS_INVALIDOS', 'Corpo não é JSON válido.');
      const resultado = alvo.rota.tratador({
        store, db: store.db, ator: { idGerente }, clock, instante, corpo: req.corpo, params, consulta,
        idempotencia: req.headers['idempotency-key'],
      });
      if (alvo.rota.escrita) store.persistir();
      status = alvo.rota.status ?? 200;
      return finalizar({ status, headers: { 'Content-Type': 'application/json' }, corpo: resultado });
    } catch (erro) {
      if (erro instanceof DomainError) {
        status = STATUS[erro.codigo] ?? 422;
        // FR-ACE-012: decisões de acesso NEGADAS são auditadas (sem corpo nem PII; só rota, código e ator).
        if ((erro.codigo === 'ACESSO_NEGADO' || erro.codigo === 'NAO_AUTORIZADO') && ator !== '-') {
          auditar(opcoes.store.db, opcoes.store.clock, ator, 'ACESSO_NEGADO', 'api', alvo.rota.caminho, { codigo: erro.codigo, metodo: req.metodo });
          opcoes.store.persistir();
        }
        return finalizar(problema(status, erro.codigo, erro.message, correlacao, erro.detalhe ? { detalhe: erro.detalhe } : {}));
      }
      if (erro instanceof ZodError) { status = 400; return finalizar(problema(400, 'DADOS_INVALIDOS', erro.message, correlacao)); }
      status = 500;
      log({ nivel: 'erro', correlation_id: correlacao, mensagem: erro instanceof Error ? erro.message : String(erro) });
      return finalizar(problema(500, 'ERRO_INTERNO', 'Erro inesperado.', correlacao));
    } finally {
      // Log estruturado sem PII: nunca registra corpo, query de busca nem documentos.
      log({ nivel: 'info', correlation_id: correlacao, metodo: req.metodo, rota: alvo.rota.caminho, status, ator, ms: Date.now() - inicio });
    }
  };
}

/** Adaptador fetch (Node/testes): decompõe a Request, chama o manipulador síncrono e aguarda a persistência enfileirada. */
export function criarApp(opcoes: OpcoesApp): { fetch: (req: Request) => Promise<Response> } {
  const manipular = criarManipulador(opcoes);
  return {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const consulta: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { if (!(k in consulta)) consulta[k] = v; });
      let corpo: unknown;
      let corpoInvalido = false;
      if (req.method === 'POST') {
        const texto = await req.text();
        if (texto) {
          try { corpo = JSON.parse(texto); } catch { corpoInvalido = true; }
        }
      }
      const r = manipular({ metodo: req.method, caminho: url.pathname, consulta, headers, corpo, corpoInvalido });
      await opcoes.store.drenar?.();
      return new Response(r.status === 204 ? null : JSON.stringify(r.corpo), { status: r.status, headers: r.headers });
    },
  };
}
