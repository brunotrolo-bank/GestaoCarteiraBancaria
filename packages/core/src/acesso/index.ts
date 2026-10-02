import type { Db, EscopoDelegacao, Gerente } from '../model/types.ts';
import { diaDe } from '../shared/dates.ts';
import { DomainError } from '../shared/errors.ts';
import { delegacoesVigentes } from '../delegacao/index.ts';
import { ocupacaoDoGerente } from '../posicoes/index.ts';

export type Modo = 'Escrita' | 'Leitura' | 'Negado';
export type Origem = 'Titular' | 'Delegado' | 'GerenteGeral';

export interface OrigemAcesso {
  origem: Origem;
  id_delegacao?: string;
  escopo?: EscopoDelegacao;
  /** Titular em posição sob cobertura vigente: Somente Leitura (Q-08). */
  titular_ausente?: boolean;
}

export interface AcessoPosicao {
  id_posicao: string;
  modo: Exclude<Modo, 'Negado'>;
  origens: OrigemAcesso[];
}

export interface Acessos {
  ativo: boolean;
  geral: boolean;
  posicoes: AcessoPosicao[];
}

export interface Decisao {
  permitido: boolean;
  modo: Modo;
  origens: OrigemAcesso[];
  motivo: string;
}

const PESO: Record<Modo, number> = { Negado: 0, Leitura: 1, Escrita: 2 };

function modoDoEscopo(escopo: EscopoDelegacao): 'Escrita' | 'Leitura' {
  // Total concede escrita; Consulta e Emergencial concedem leitura (Emergencial = leitura + nota de atendimento, Q-23).
  return escopo === 'Total' ? 'Escrita' : 'Leitura';
}

/**
 * Núcleo único de decisão de acesso (constituição C6). Função determinística sobre o estado do banco e um instante.
 * Regra central: Acesso(G,C) ⇔ C.posição = PosiçãoTitular(G,t) ∨ ∃ delegação vigente de C.posição para G.
 * Negação por padrão (FR-ACE-003); modo mais permissivo prevalece quando há mais de uma origem (FR-ACE-007).
 */
export function resolverAcessos(db: Db, idGerente: string, instante: Date): Acessos {
  const g: Gerente | undefined = db.dim_gerentes.find((x) => x.id_gerente === idGerente);
  if (!g || g.status !== 'Ativo') return { ativo: false, geral: false, posicoes: [] };

  const mapa = new Map<string, AcessoPosicao>();
  const somar = (id_posicao: string, modo: 'Escrita' | 'Leitura', origem: OrigemAcesso): void => {
    const atual = mapa.get(id_posicao);
    if (!atual) mapa.set(id_posicao, { id_posicao, modo, origens: [origem] });
    else {
      atual.origens.push(origem);
      if (PESO[modo] > PESO[atual.modo]) atual.modo = modo;
    }
  };

  if (g.perfil === 'Gerente Geral') {
    for (const p of db.dim_posicoes) somar(p.id_posicao, 'Leitura', { origem: 'GerenteGeral' });
    return { ativo: true, geral: true, posicoes: [...mapa.values()] };
  }

  const dia = diaDe(instante);
  const vigentes = delegacoesVigentes(db, instante);
  const ocupacao = ocupacaoDoGerente(db, g.id_gerente, dia);
  if (ocupacao) {
    const sobCobertura = vigentes.some((d) => d.id_posicao_origem === ocupacao.id_posicao);
    somar(ocupacao.id_posicao, sobCobertura ? 'Leitura' : 'Escrita', sobCobertura ? { origem: 'Titular', titular_ausente: true } : { origem: 'Titular' });
  }
  for (const d of vigentes.filter((x) => x.id_gerente_delegado === g.id_gerente)) {
    somar(d.id_posicao_origem, modoDoEscopo(d.escopo), { origem: 'Delegado', id_delegacao: d.id_delegacao, escopo: d.escopo });
  }
  return { ativo: true, geral: false, posicoes: [...mapa.values()] };
}

export function decidirPosicao(db: Db, idGerente: string, idPosicao: string, instante: Date): Decisao {
  const acessos = resolverAcessos(db, idGerente, instante);
  if (!acessos.ativo) return { permitido: false, modo: 'Negado', origens: [], motivo: 'Ator desconhecido ou inativo.' };
  const a = acessos.posicoes.find((p) => p.id_posicao === idPosicao);
  if (!a) return { permitido: false, modo: 'Negado', origens: [], motivo: 'Sem titularidade nem delegação vigente para a posição.' };
  return { permitido: true, modo: a.modo, origens: a.origens, motivo: explicar(a) };
}

/** Posição em que o cliente estava no instante (histórico de vínculo); cai na projeção se não houver histórico. */
export function posicaoDoClienteEm(db: Db, idCliente: string, instante: Date): string | null {
  const t = instante.getTime();
  const v = db.bridge_vinculo_carteira.find(
    (x) => x.id_cliente === idCliente && new Date(x.inicio_em).getTime() <= t && (x.fim_em === null || t < new Date(x.fim_em).getTime()),
  );
  if (v) return v.id_posicao;
  const aindaNaoCarteirizado = db.bridge_vinculo_carteira.some((x) => x.id_cliente === idCliente && new Date(x.inicio_em).getTime() > t);
  if (aindaNaoCarteirizado) return null;
  return db.dim_clientes.find((c) => c.id_cliente === idCliente)?.id_posicao_carteira ?? null;
}

export function decidirCliente(db: Db, idGerente: string, idCliente: string, instante: Date): Decisao {
  const posicao = posicaoDoClienteEm(db, idCliente, instante);
  if (!posicao) return { permitido: false, modo: 'Negado', origens: [], motivo: 'Cliente inexistente ou sem carteira no instante.' };
  return decidirPosicao(db, idGerente, posicao, instante);
}

export function exigirAcessoCliente(db: Db, idGerente: string, idCliente: string, instante: Date, minimo: 'Leitura' | 'Escrita' = 'Leitura'): Decisao {
  const d = decidirCliente(db, idGerente, idCliente, instante);
  if (!d.permitido || PESO[d.modo] < PESO[minimo]) {
    throw new DomainError('ACESSO_NEGADO', 'Acesso negado ao cliente.', { modo: d.modo });
  }
  return d;
}

/** Predicado de linha: conjunto de posições visíveis (usado por API, MCP e camada semântica — FR-ACE-011). */
export function posicoesPermitidas(db: Db, idGerente: string, instante: Date): string[] {
  return resolverAcessos(db, idGerente, instante).posicoes.map((p) => p.id_posicao);
}

function explicar(a: AcessoPosicao): string {
  return a.origens
    .map((o) => {
      if (o.origem === 'GerenteGeral') return 'Gerente Geral: visão consolidada da agência.';
      if (o.origem === 'Titular') return o.titular_ausente ? 'Titular com posição sob cobertura vigente: somente leitura.' : 'Titular vigente da posição.';
      return `Delegado (${o.escopo}) pela delegação ${o.id_delegacao}.`;
    })
    .join(' ');
}
