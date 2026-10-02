import type { Db, Delegacao, EscopoDelegacao, Ator } from '../model/types.ts';
import { emTransacao, proximoId } from '../model/db.ts';
import { diaDe, intervalosSobrepostos, isISODate, noIntervalo } from '../shared/dates.ts';
import type { Clock } from '../shared/clock.ts';
import { exigir } from '../shared/errors.ts';
import { auditar, publicar } from '../model/registro.ts';
import { exigirGerenteGeral, obterGerente, obterPosicao, titularVigente } from '../posicoes/index.ts';

export type Situacao = 'Submetida' | 'Rejeitada' | 'Revogada' | 'Agendada' | 'Em Vigor' | 'Concluída';
const ESCOPOS: EscopoDelegacao[] = ['Total', 'Apenas Consulta', 'Apenas Emergencial'];

/**
 * Função pura de vigência (FR-DEL-002/004/009): só delegações Aprovadas produzem efeito, em datas inclusivas
 * (fuso de negócio), e cessam no instante da revogação.
 */
export function vigente(d: Delegacao, instante: Date): boolean {
  if (d.status_aprovacao !== 'Aprovada') return false;
  if (d.revogada_em !== null && instante.getTime() >= new Date(d.revogada_em).getTime()) return false;
  return noIntervalo(diaDe(instante), d.data_inicio, d.data_fim);
}

/** Situação derivada do relógio (FR-DEL-003) — nunca persistida. */
export function situacao(d: Delegacao, instante: Date): Situacao {
  if (d.status_aprovacao !== 'Aprovada') return d.status_aprovacao;
  const dia = diaDe(instante);
  if (dia < d.data_inicio) return 'Agendada';
  if (dia > d.data_fim) return 'Concluída';
  return 'Em Vigor';
}

/** Delegações com efeito no instante: aprovadas, vigentes e com delegado Ativo (acesso cessa se ele deixar de ser Ativo). */
export function delegacoesVigentes(db: Db, instante: Date): Delegacao[] {
  return db.fct_delegacoes.filter((d) => {
    if (!vigente(d, instante)) return false;
    return db.dim_gerentes.find((g) => g.id_gerente === d.id_gerente_delegado)?.status === 'Ativo';
  });
}

export function obterDelegacao(db: Db, id: string): Delegacao {
  const d = db.fct_delegacoes.find((x) => x.id_delegacao === id);
  exigir(d, 'DELEGACAO_INEXISTENTE', `Delegação ${id} não existe.`);
  return d;
}

function exigirSemSobreposicaoAprovada(db: Db, candidata: Pick<Delegacao, 'id_delegacao' | 'id_posicao_origem' | 'data_inicio' | 'data_fim'>): void {
  const conflito = db.fct_delegacoes.some(
    (o) =>
      o.id_delegacao !== candidata.id_delegacao &&
      o.id_posicao_origem === candidata.id_posicao_origem &&
      o.status_aprovacao === 'Aprovada' &&
      intervalosSobrepostos({ inicio: candidata.data_inicio, fim: candidata.data_fim }, { inicio: o.data_inicio, fim: o.data_fim }),
  );
  exigir(!conflito, 'DELEGACAO_SOBREPOSTA', 'Já existe delegação aprovada sobreposta para esta posição.');
}

export interface NovaDelegacao {
  id_posicao_origem: string;
  id_gerente_delegado: string;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  escopo: EscopoDelegacao;
}

/** Submete delegação. Solicitam o titular da origem ou o Gerente Geral (Q-09); delegado não repassa cobertura (FR-DEL-007). */
export function submeter(db: Db, clock: Clock, entrada: NovaDelegacao, ator: Ator): Delegacao {
  exigir(isISODate(entrada.data_inicio) && isISODate(entrada.data_fim) && entrada.data_inicio <= entrada.data_fim, 'DATAS_INVALIDAS', 'Período inválido (início deve ser ≤ fim).');
  exigir(ESCOPOS.includes(entrada.escopo), 'DADOS_INVALIDOS', 'Escopo inválido.');
  exigir(entrada.motivo?.trim(), 'MOTIVO_OBRIGATORIO', 'Motivo é obrigatório.');
  const origem = obterPosicao(db, entrada.id_posicao_origem);
  exigir(origem.status !== 'Extinta', 'POSICAO_EXTINTA', 'Posição extinta.');
  const solicitante = obterGerente(db, ator.idGerente);
  exigir(solicitante.status === 'Ativo', 'GERENTE_INDISPONIVEL', 'Solicitante não está Ativo.');
  const delegado = obterGerente(db, entrada.id_gerente_delegado);
  exigir(delegado.status === 'Ativo', 'GERENTE_INDISPONIVEL', 'Delegado não está Ativo.');

  const agora = clock.agora();
  const hoje = diaDe(agora);
  if (solicitante.perfil !== 'Gerente Geral') {
    const titularHoje = titularVigente(db, origem.id_posicao, hoje);
    const ehTitular = titularHoje?.id_gerente === solicitante.id_gerente;
    if (!ehTitular) {
      const recebeuCobertura = delegacoesVigentes(db, agora).some(
        (d) => d.id_posicao_origem === origem.id_posicao && d.id_gerente_delegado === solicitante.id_gerente,
      );
      exigir(!recebeuCobertura, 'DELEGACAO_TRANSITIVA', 'Quem recebeu a cobertura não pode repassá-la.');
      exigir(false, 'NAO_AUTORIZADO', 'Apenas o titular da posição ou o Gerente Geral solicitam delegação.');
    }
  }
  const titularNoInicio = titularVigente(db, origem.id_posicao, entrada.data_inicio) ?? titularVigente(db, origem.id_posicao, hoje);
  exigir(titularNoInicio?.id_gerente !== delegado.id_gerente, 'AUTO_DELEGACAO', 'O titular não pode ser o próprio delegado.');

  const nova: Delegacao = {
    id_delegacao: proximoId('DEL', db.fct_delegacoes.map((d) => d.id_delegacao), 4),
    ...entrada,
    motivo: entrada.motivo.trim(),
    status_aprovacao: 'Submetida',
    criada_por: ator.idGerente,
    criada_em: agora.toISOString(),
    decidida_por: null,
    decidida_em: null,
    revogada_em: null,
  };
  return emTransacao(db, () => {
    exigirSemSobreposicaoAprovada(db, nova);
    db.fct_delegacoes.push(nova);
    auditar(db, clock, ator.idGerente, 'DELEGACAO_SUBMETIDA', 'fct_delegacoes', nova.id_delegacao, { origem: nova.id_posicao_origem, delegado: nova.id_gerente_delegado });
    publicar(db, clock, 'DelegacaoSubmetida', { id_delegacao: nova.id_delegacao });
    return nova;
  });
}

export function aprovar(db: Db, clock: Clock, idDelegacao: string, ator: Ator): Delegacao {
  exigirGerenteGeral(db, ator);
  const d = obterDelegacao(db, idDelegacao);
  exigir(d.status_aprovacao === 'Submetida', 'ESTADO_INVALIDO', `Delegação em estado ${d.status_aprovacao} não pode ser aprovada.`);
  return emTransacao(db, () => {
    exigirSemSobreposicaoAprovada(db, d);
    d.status_aprovacao = 'Aprovada';
    d.decidida_por = ator.idGerente;
    d.decidida_em = clock.agora().toISOString();
    auditar(db, clock, ator.idGerente, 'DELEGACAO_APROVADA', 'fct_delegacoes', d.id_delegacao, {});
    publicar(db, clock, 'DelegacaoAprovada', { id_delegacao: d.id_delegacao });
    return d;
  });
}

export function rejeitar(db: Db, clock: Clock, idDelegacao: string, ator: Ator): Delegacao {
  exigirGerenteGeral(db, ator);
  const d = obterDelegacao(db, idDelegacao);
  exigir(d.status_aprovacao === 'Submetida', 'ESTADO_INVALIDO', `Delegação em estado ${d.status_aprovacao} não pode ser rejeitada.`);
  return emTransacao(db, () => {
    d.status_aprovacao = 'Rejeitada';
    d.decidida_por = ator.idGerente;
    d.decidida_em = clock.agora().toISOString();
    auditar(db, clock, ator.idGerente, 'DELEGACAO_REJEITADA', 'fct_delegacoes', d.id_delegacao, {});
    return d;
  });
}

/** Revogação antecipada: efeito cessa a partir do instante; o registro é preservado (FR-DEL-009/010). */
export function revogar(db: Db, clock: Clock, idDelegacao: string, ator: Ator): Delegacao {
  const d = obterDelegacao(db, idDelegacao);
  const quem = obterGerente(db, ator.idGerente);
  exigir(quem.status === 'Ativo', 'GERENTE_INDISPONIVEL', 'Ator não está Ativo.');
  if (quem.perfil !== 'Gerente Geral') {
    const titular = titularVigente(db, d.id_posicao_origem, diaDe(clock.agora()));
    exigir(titular?.id_gerente === quem.id_gerente, 'NAO_AUTORIZADO', 'Apenas o titular da origem ou o Gerente Geral revogam.');
  }
  exigir(d.status_aprovacao === 'Submetida' || d.status_aprovacao === 'Aprovada', 'ESTADO_INVALIDO', `Delegação em estado ${d.status_aprovacao} não pode ser revogada.`);
  return emTransacao(db, () => {
    const eraAprovada = d.status_aprovacao === 'Aprovada';
    d.status_aprovacao = 'Revogada';
    d.revogada_em = clock.agora().toISOString();
    auditar(db, clock, ator.idGerente, 'DELEGACAO_REVOGADA', 'fct_delegacoes', d.id_delegacao, { estava_aprovada: eraAprovada });
    publicar(db, clock, 'DelegacaoRevogada', { id_delegacao: d.id_delegacao });
    return d;
  });
}

/**
 * Varredura idempotente que emite `DelegacaoIniciada`/`DelegacaoExpirada` (FR-DEL-011). O acesso NÃO depende dela:
 * a vigência é calculada na consulta.
 */
export function varrerEventosDeVigencia(db: Db, clock: Clock): number {
  const agora = clock.agora();
  const jaEmitidos = new Set(db.log_eventos.map((e) => `${e.tipo}|${e.payload}`));
  let emitidos = 0;
  for (const d of db.fct_delegacoes) {
    const s = situacao(d, agora);
    const tipo = s === 'Em Vigor' ? 'DelegacaoIniciada' : s === 'Concluída' ? 'DelegacaoExpirada' : null;
    if (!tipo) continue;
    const payload = JSON.stringify({ id_delegacao: d.id_delegacao });
    if (jaEmitidos.has(`${tipo}|${payload}`)) continue;
    publicar(db, clock, tipo, { id_delegacao: d.id_delegacao });
    emitidos += 1;
  }
  return emitidos;
}
