import type { Db, Gerente, Ocupacao, Posicao, PerfilGerente, SegmentoPosicao, StatusPosicao, TipoVinculo, Ator } from '../model/types.ts';
import { emTransacao, proximoId } from '../model/db.ts';
import { addDays, diaDe, intervalosSobrepostos, isISODate, noIntervalo, type ISODate } from '../shared/dates.ts';
import type { Clock } from '../shared/clock.ts';
import { DomainError, exigir } from '../shared/errors.ts';
import { auditar, publicar } from '../shared/registro.ts';

const SEGMENTOS_POSICAO: SegmentoPosicao[] = ['Private', 'Alta Renda', 'Middle Market', 'Misto'];
const TRANSICOES: Record<StatusPosicao, StatusPosicao[]> = {
  Ativa: ['Congelada', 'Extinta'],
  Congelada: ['Ativa', 'Extinta'],
  Extinta: [],
};

export function exigirGerenteGeral(db: Db, ator: Ator): Gerente {
  const g = db.dim_gerentes.find((x) => x.id_gerente === ator.idGerente);
  exigir(g && g.status === 'Ativo' && g.perfil === 'Gerente Geral', 'NAO_AUTORIZADO', 'Operação restrita ao Gerente Geral.');
  return g;
}

export function obterPosicao(db: Db, id: string): Posicao {
  const p = db.dim_posicoes.find((x) => x.id_posicao === id);
  exigir(p, 'POSICAO_INEXISTENTE', `Posição ${id} não existe.`);
  return p;
}

export function obterGerente(db: Db, id: string): Gerente {
  const g = db.dim_gerentes.find((x) => x.id_gerente === id);
  exigir(g, 'GERENTE_INEXISTENTE', `Gerente ${id} não existe.`);
  return g;
}

/** Titular vigente da posição no dia (FR-POS-009, *as-of*). */
export function titularVigente(db: Db, idPosicao: string, dia: ISODate): Ocupacao | null {
  return db.bridge_ocupacao_posicao.find((o) => o.id_posicao === idPosicao && noIntervalo(dia, o.data_inicio, o.data_fim)) ?? null;
}

/** Posição ocupada pelo gerente no dia, ou null (um gerente tem no máximo uma — FR-POS-012). */
export function ocupacaoDoGerente(db: Db, idGerente: string, dia: ISODate): Ocupacao | null {
  return db.bridge_ocupacao_posicao.find((o) => o.id_gerente === idGerente && noIntervalo(dia, o.data_inicio, o.data_fim)) ?? null;
}

export function historicoDaPosicao(db: Db, idPosicao: string): Ocupacao[] {
  obterPosicao(db, idPosicao);
  return db.bridge_ocupacao_posicao.filter((o) => o.id_posicao === idPosicao).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
}

export function criarPosicao(
  db: Db,
  clock: Clock,
  entrada: { nome_posicao: string; id_agencia: string; segmento_especialidade: SegmentoPosicao; capacidade_max_contas: number },
  ator: Ator,
): Posicao {
  exigirGerenteGeral(db, ator);
  exigir(entrada.nome_posicao?.trim(), 'DADOS_INVALIDOS', 'Nome da posição é obrigatório.');
  exigir(SEGMENTOS_POSICAO.includes(entrada.segmento_especialidade), 'DADOS_INVALIDOS', 'Segmento de especialidade inválido.');
  exigir(Number.isInteger(entrada.capacidade_max_contas) && entrada.capacidade_max_contas > 0, 'DADOS_INVALIDOS', 'Capacidade deve ser inteiro positivo.');
  exigir(db.dim_agencias.some((a) => a.id_agencia === entrada.id_agencia), 'DADOS_INVALIDOS', 'Agência inexistente.');
  const prefixo = `POS-${entrada.id_agencia}`;
  const posicao: Posicao = {
    id_posicao: proximoId(prefixo, db.dim_posicoes.map((p) => p.id_posicao), 3),
    nome_posicao: entrada.nome_posicao.trim(),
    id_agencia: entrada.id_agencia,
    segmento_especialidade: entrada.segmento_especialidade,
    capacidade_max_contas: entrada.capacidade_max_contas,
    status: 'Ativa',
  };
  return emTransacao(db, () => {
    db.dim_posicoes.push(posicao);
    auditar(db, clock, ator.idGerente, 'POSICAO_CRIADA', 'dim_posicoes', posicao.id_posicao, { nome: posicao.nome_posicao });
    publicar(db, clock, 'PosicaoCriada', { id_posicao: posicao.id_posicao });
    return posicao;
  });
}

export function alterarStatusPosicao(db: Db, clock: Clock, idPosicao: string, novo: StatusPosicao, ator: Ator): Posicao {
  exigirGerenteGeral(db, ator);
  const p = obterPosicao(db, idPosicao);
  exigir(TRANSICOES[p.status].includes(novo), 'TRANSICAO_INVALIDA', `Transição ${p.status} → ${novo} não permitida.`);
  if (novo === 'Extinta') {
    const carteira = db.dim_clientes.filter((c) => c.id_posicao_carteira === idPosicao).length;
    exigir(carteira === 0, 'POSICAO_COM_CARTEIRA', 'Não é possível extinguir posição com clientes vinculados.', { clientes: carteira });
  }
  return emTransacao(db, () => {
    const anterior = p.status;
    p.status = novo;
    auditar(db, clock, ator.idGerente, 'POSICAO_STATUS_ALTERADO', 'dim_posicoes', idPosicao, { de: anterior, para: novo });
    publicar(db, clock, 'PosicaoStatusAlterado', { id_posicao: idPosicao, de: anterior, para: novo });
    return p;
  });
}

export function cadastrarGerente(
  db: Db,
  clock: Clock,
  entrada: { nome_completo: string; email_corporativo: string; perfil: PerfilGerente },
  ator: Ator,
): Gerente {
  exigirGerenteGeral(db, ator);
  exigir(entrada.nome_completo?.trim(), 'DADOS_INVALIDOS', 'Nome é obrigatório.');
  exigir(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entrada.email_corporativo ?? ''), 'DADOS_INVALIDOS', 'E-mail inválido.');
  exigir(['Gerente de Contas', 'Gerente Geral'].includes(entrada.perfil), 'DADOS_INVALIDOS', 'Perfil inválido.');
  const email = entrada.email_corporativo.toLowerCase();
  exigir(!db.dim_gerentes.some((g) => g.email_corporativo.toLowerCase() === email), 'EMAIL_DUPLICADO', 'E-mail já cadastrado.');
  const gerente: Gerente = {
    id_gerente: proximoId('GER', db.dim_gerentes.map((g) => g.id_gerente), 3),
    nome_completo: entrada.nome_completo.trim(),
    email_corporativo: email,
    perfil: entrada.perfil,
    status: 'Ativo',
  };
  return emTransacao(db, () => {
    db.dim_gerentes.push(gerente);
    auditar(db, clock, ator.idGerente, 'GERENTE_CADASTRADO', 'dim_gerentes', gerente.id_gerente, { perfil: gerente.perfil });
    return gerente;
  });
}

/**
 * Valida (sem gravar) uma nova ocupação: sem sobreposição na posição (FR-POS-006) e gerente com uma única
 * posição (FR-POS-012). `ignorarId` permite validar a própria ocupação em edição.
 */
export function validarNovaOcupacao(db: Db, nova: Pick<Ocupacao, 'id_posicao' | 'id_gerente' | 'data_inicio' | 'data_fim'>): void {
  const intervalo = { inicio: nova.data_inicio, fim: nova.data_fim };
  const sobrepoe = db.bridge_ocupacao_posicao.some(
    (o) => o.id_posicao === nova.id_posicao && intervalosSobrepostos(intervalo, { inicio: o.data_inicio, fim: o.data_fim }),
  );
  exigir(!sobrepoe, 'OCUPACAO_SOBREPOSTA', 'A posição já possui titular no período informado.');
  const duplaAlocacao = db.bridge_ocupacao_posicao.some(
    (o) => o.id_gerente === nova.id_gerente && intervalosSobrepostos(intervalo, { inicio: o.data_inicio, fim: o.data_fim }),
  );
  exigir(!duplaAlocacao, 'GERENTE_JA_ALOCADO', 'O gerente já ocupa uma posição no período informado.');
}

export interface TrocaTitular {
  id_posicao: string;
  id_gerente: string;
  data_inicio: ISODate;
  tipo_vinculo: TipoVinculo;
  motivo?: string;
}

/** Troca de titular (J1): encerra a ocupação vigente e cria a nova, atomicamente. Não escreve em clientes (FR-POS-008). */
export function trocarTitular(db: Db, clock: Clock, entrada: TrocaTitular, ator: Ator): Ocupacao {
  exigirGerenteGeral(db, ator);
  exigir(isISODate(entrada.data_inicio), 'DATAS_INVALIDAS', 'Data de início inválida.');
  const posicao = obterPosicao(db, entrada.id_posicao);
  exigir(posicao.status !== 'Extinta', 'POSICAO_EXTINTA', 'Posição extinta não aceita titular.');
  const gerente = obterGerente(db, entrada.id_gerente);
  exigir(gerente.status === 'Ativo', 'GERENTE_INDISPONIVEL', 'Gerente não está Ativo.');
  exigir(gerente.perfil !== 'Gerente Geral', 'PERFIL_INVALIDO', 'O Gerente Geral não ocupa posição.');
  exigir(['Titular Efetivo', 'Trainee', 'Interino'].includes(entrada.tipo_vinculo), 'DADOS_INVALIDOS', 'Tipo de vínculo inválido.');
  const hoje = diaDe(clock.agora());
  if (entrada.data_inicio < hoje) exigir(entrada.motivo?.trim(), 'MOTIVO_OBRIGATORIO', 'Troca retroativa exige motivo.');

  return emTransacao(db, () => {
    const vigente = titularVigente(db, entrada.id_posicao, entrada.data_inicio);
    if (vigente) {
      exigir(entrada.data_inicio > vigente.data_inicio, 'INTERVALO_INVALIDO', 'Início da nova ocupação deve ser posterior ao início da atual.');
      vigente.data_fim = addDays(entrada.data_inicio, -1);
    }
    const nova: Ocupacao = {
      id_ocupacao: proximoId('OCU', db.bridge_ocupacao_posicao.map((o) => o.id_ocupacao), 4),
      id_posicao: entrada.id_posicao,
      id_gerente: entrada.id_gerente,
      data_inicio: entrada.data_inicio,
      data_fim: null,
      tipo_vinculo: entrada.tipo_vinculo,
    };
    validarNovaOcupacao(db, nova);
    db.bridge_ocupacao_posicao.push(nova);
    auditar(db, clock, ator.idGerente, 'TITULAR_ALTERADO', 'bridge_ocupacao_posicao', nova.id_ocupacao, {
      id_posicao: nova.id_posicao, anterior: vigente?.id_gerente ?? null, novo: nova.id_gerente, inicio: nova.data_inicio, motivo: entrada.motivo ?? null,
    });
    publicar(db, clock, 'TitularAlterado', { id_posicao: nova.id_posicao, id_gerente: nova.id_gerente, data_inicio: nova.data_inicio });
    return nova;
  });
}

/** Desliga o gerente; se for titular vigente, a posição fica vaga e mantém a carteira (FR-POS-007/010). */
export function desligarGerente(db: Db, clock: Clock, idGerente: string, ator: Ator): Gerente {
  exigirGerenteGeral(db, ator);
  const g = obterGerente(db, idGerente);
  exigir(g.status !== 'Desligado', 'TRANSICAO_INVALIDA', 'Gerente já desligado.');
  return emTransacao(db, () => {
    const hoje = diaDe(clock.agora());
    const ocupacao = ocupacaoDoGerente(db, idGerente, hoje);
    g.status = 'Desligado';
    if (ocupacao) {
      // A vacância começa hoje; só se a ocupação iniciou hoje o intervalo fica com 1 dia (fim ≥ início).
      const ontem = addDays(hoje, -1);
      ocupacao.data_fim = ontem >= ocupacao.data_inicio ? ontem : hoje;
      publicar(db, clock, 'PosicaoVagou', { id_posicao: ocupacao.id_posicao });
    }
    auditar(db, clock, ator.idGerente, 'GERENTE_DESLIGADO', 'dim_gerentes', idGerente, { posicao: ocupacao?.id_posicao ?? null });
    return g;
  });
}

export function posicaoVaga(db: Db, idPosicao: string, dia: ISODate): boolean {
  return titularVigente(db, idPosicao, dia) === null;
}

export { DomainError };
