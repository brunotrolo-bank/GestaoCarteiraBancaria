import { describe, expect, it } from 'vitest';
import { posicoes, FixedClock, meioDia } from '@carteira/core';
import { capturaErro, cenario, esperaErro, ger, GG, ultimaAuditoria, ultimoEvento } from './helpers.ts';

/** Testes dirigidos pelos mutantes sobreviventes do módulo de posições: provam o CONTEÚDO de auditoria/eventos, guardas e bordas. */
describe('posições — auditoria, eventos, guardas e bordas (mutação)', () => {
  it('só o GG ATIVO administra: desconhecido, não-GG e GG afastado são barrados em todas as operações', () => {
    const { db, clock } = cenario();
    const ops: ((a: { idGerente: string }) => unknown)[] = [
      (a) => posicoes.criarPosicao(db, clock, { nome_posicao: 'X', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 5 }, a),
      (a) => posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Congelada', a),
      (a) => posicoes.cadastrarGerente(db, clock, { nome_completo: 'N', email_corporativo: 'n@b.co', perfil: 'Gerente de Contas' }, a),
      (a) => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Interino' }, a),
      (a) => posicoes.desligarGerente(db, clock, 'GER-106', a),
    ];
    for (const op of ops) {
      esperaErro(() => op(ger(101)), 'NAO_AUTORIZADO');
      esperaErro(() => op({ idGerente: 'GER-999' }), 'NAO_AUTORIZADO');
    }
    db.dim_gerentes.find((g) => g.id_gerente === 'GER-100')!.status = 'Afastado';
    for (const op of ops) esperaErro(() => op(GG), 'NAO_AUTORIZADO');
  });

  it('criar posição: aceita os 4 segmentos, apara o nome, valida a agência entre várias e registra auditoria/evento', () => {
    const { db, clock } = cenario();
    db.dim_agencias.push({ id_agencia: 'AG02', nome: 'Outra', cidade: 'Rio' });
    for (const seg of ['Private', 'Alta Renda', 'Middle Market', 'Misto'] as const) {
      expect(posicoes.criarPosicao(db, clock, { nome_posicao: `  Mesa ${seg}  `, id_agencia: 'AG01', segmento_especialidade: seg, capacidade_max_contas: 5 }, GG).nome_posicao).toBe(`Mesa ${seg}`);
    }
    esperaErro(() => posicoes.criarPosicao(db, clock, { nome_posicao: 'Z', id_agencia: 'AG99', segmento_especialidade: 'Misto', capacidade_max_contas: 5 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.criarPosicao(db, clock, { nome_posicao: 'Z', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 2.5 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.criarPosicao(db, clock, { nome_posicao: 'Z', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: -1 }, GG), 'DADOS_INVALIDOS');
    const ultima = db.dim_posicoes.at(-1)!;
    expect(ultima).toMatchObject({ status: 'Ativa', id_agencia: 'AG01' });
    expect(ultimaAuditoria(db, 'POSICAO_CRIADA')).toMatchObject({ ator: 'GER-100', entidade: 'dim_posicoes', id_entidade: ultima.id_posicao });
    expect(JSON.parse(ultimaAuditoria(db, 'POSICAO_CRIADA')!.detalhe)).toEqual({ nome: ultima.nome_posicao });
    expect(JSON.parse(ultimoEvento(db, 'PosicaoCriada')!.payload)).toEqual({ id_posicao: ultima.id_posicao });
  });

  it('status da posição: todas as transições, detalhe do erro de carteira e auditoria/evento com de/para', () => {
    const { db, clock } = cenario();
    const e = capturaErro(() => posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-001', 'Extinta', GG));
    expect(e.codigo).toBe('POSICAO_COM_CARTEIRA');
    expect(e.detalhe).toEqual({ clientes: db.dim_clientes.filter((c) => c.id_posicao_carteira === 'POS-AG01-001').length });
    posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Congelada', GG);
    expect(JSON.parse(ultimaAuditoria(db, 'POSICAO_STATUS_ALTERADO')!.detalhe)).toEqual({ de: 'Ativa', para: 'Congelada' });
    expect(JSON.parse(ultimoEvento(db, 'PosicaoStatusAlterado')!.payload)).toEqual({ id_posicao: 'POS-AG01-004', de: 'Ativa', para: 'Congelada' });
    posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Ativa', GG);
    posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Congelada', GG);
    const vazia = posicoes.criarPosicao(db, clock, { nome_posicao: 'Vazia', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 5 }, GG);
    expect(posicoes.alterarStatusPosicao(db, clock, vazia.id_posicao, 'Extinta', GG).status).toBe('Extinta');
    db.dim_clientes.filter((c) => c.id_posicao_carteira === 'POS-AG01-004').forEach((c) => { c.id_posicao_carteira = 'POS-AG01-001'; });
    expect(posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-004', 'Extinta', GG).status).toBe('Extinta');
    for (const alvo of ['Ativa', 'Congelada', 'Extinta'] as const) esperaErro(() => posicoes.alterarStatusPosicao(db, clock, vazia.id_posicao, alvo, GG), 'TRANSICAO_INVALIDA');
    esperaErro(() => posicoes.obterPosicao(db, 'POS-NAO-EXISTE'), 'POSICAO_INEXISTENTE');
  });

  it('cadastro de gerente: apara nome, valida e-mail com âncoras, status Ativo e auditoria', () => {
    const { db, clock } = cenario();
    const base = { nome_completo: '  Pessoa Nova  ', perfil: 'Gerente de Contas' as const };
    for (const invalido of ['a@b.co x', ' a@b.co', 'a@b', '@b.co', 'a b@c.co', 'a@b.co\nx']) {
      esperaErro(() => posicoes.cadastrarGerente(db, clock, { ...base, email_corporativo: invalido }, GG), 'DADOS_INVALIDOS');
    }
    const g = posicoes.cadastrarGerente(db, clock, { ...base, email_corporativo: 'pessoa.nova@banco-poc.example' }, GG);
    expect(g).toMatchObject({ nome_completo: 'Pessoa Nova', status: 'Ativo', perfil: 'Gerente de Contas' });
    expect(ultimaAuditoria(db, 'GERENTE_CADASTRADO')).toMatchObject({ entidade: 'dim_gerentes', id_entidade: g.id_gerente });
    expect(JSON.parse(ultimaAuditoria(db, 'GERENTE_CADASTRADO')!.detalhe)).toEqual({ perfil: 'Gerente de Contas' });
    esperaErro(() => posicoes.cadastrarGerente(db, clock, { ...base, email_corporativo: 'PESSOA.NOVA@banco-poc.example' }, GG), 'EMAIL_DUPLICADO');
    expect(posicoes.cadastrarGerente(db, clock, { nome_completo: 'GG2', email_corporativo: 'gg2@b.co', perfil: 'Gerente Geral' }, GG).perfil).toBe('Gerente Geral');
  });

  it('troca de titular: identificador sequencial, auditoria completa, evento e retroatividade com motivo só de espaços', () => {
    const { db, clock } = cenario();
    const nova = posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Trainee', motivo: 'Promoção' }, GG);
    expect(nova.id_ocupacao).toBe('OCU-0007');
    expect(nova.tipo_vinculo).toBe('Trainee');
    const aud = ultimaAuditoria(db, 'TITULAR_ALTERADO')!;
    expect(aud).toMatchObject({ ator: 'GER-100', entidade: 'bridge_ocupacao_posicao', id_entidade: 'OCU-0007' });
    expect(JSON.parse(aud.detalhe)).toEqual({ id_posicao: 'POS-AG01-003', anterior: 'GER-103', novo: 'GER-106', inicio: '2026-10-05', motivo: 'Promoção' });
    expect(JSON.parse(ultimoEvento(db, 'TitularAlterado')!.payload)).toEqual({ id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05' });
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2026-09-01', tipo_vinculo: 'Interino', motivo: '   ' }, GG), 'MOTIVO_OBRIGATORIO');
    posicoes.desligarGerente(db, clock, 'GER-104', GG);
    posicoes.cadastrarGerente(db, clock, { nome_completo: 'Reserva', email_corporativo: 'reserva@b.co', perfil: 'Gerente de Contas' }, GG);
    posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-004', id_gerente: 'GER-108', data_inicio: '2026-10-02', tipo_vinculo: 'Interino' }, GG);
    expect(JSON.parse(ultimaAuditoria(db, 'TITULAR_ALTERADO')!.detalhe)).toMatchObject({ anterior: null, motivo: null });
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-004', id_gerente: 'GER-106', data_inicio: '2026-10-02', tipo_vinculo: 'Interino' }, GG), 'INTERVALO_INVALIDO');
  });

  it('um gerente pode reocupar outra posição depois que a ocupação anterior terminou (sem sobreposição)', () => {
    const { db } = cenario();
    const c = new FixedClock(meioDia('2026-10-01'));
    posicoes.trocarTitular(db, c, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Interino' }, GG);
    posicoes.trocarTitular(db, c, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-103', data_inicio: '2026-10-20', tipo_vinculo: 'Titular Efetivo' }, GG);
    expect(db.bridge_ocupacao_posicao.find((o) => o.id_gerente === 'GER-106')!.data_fim).toBe('2026-10-19');
    const outra = posicoes.trocarTitular(db, c, { id_posicao: 'POS-AG01-004', id_gerente: 'GER-106', data_inicio: '2026-11-01', tipo_vinculo: 'Interino' }, GG);
    expect(outra.id_gerente).toBe('GER-106');
    const vaga = posicoes.criarPosicao(db, c, { nome_posicao: 'Vaga', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 5 }, GG).id_posicao;
    esperaErro(() => posicoes.validarNovaOcupacao(db, { id_posicao: vaga, id_gerente: 'GER-106', data_inicio: '2026-11-10', data_fim: null }), 'GERENTE_JA_ALOCADO');
    esperaErro(() => posicoes.validarNovaOcupacao(db, { id_posicao: vaga, id_gerente: 'GER-102', data_inicio: '2026-09-01', data_fim: '2026-09-30' }), 'GERENTE_JA_ALOCADO');
    posicoes.validarNovaOcupacao(db, { id_posicao: vaga, id_gerente: 'GER-102', data_inicio: '2024-01-01', data_fim: '2024-12-31' }); // antes de qualquer ocupação dele: ok
  });

  it('desligar: gerente sem posição não gera vacância; vacância começa hoje; auditoria e evento', () => {
    const { db, clock } = cenario();
    posicoes.desligarGerente(db, clock, 'GER-106', GG);
    expect(db.log_eventos.some((e) => e.tipo === 'PosicaoVagou')).toBe(false);
    expect(JSON.parse(ultimaAuditoria(db, 'GERENTE_DESLIGADO')!.detalhe)).toEqual({ posicao: null });
    posicoes.desligarGerente(db, clock, 'GER-104', GG);
    expect(db.bridge_ocupacao_posicao.find((o) => o.id_gerente === 'GER-104')!.data_fim).toBe('2026-09-30');
    expect(JSON.parse(ultimoEvento(db, 'PosicaoVagou')!.payload)).toEqual({ id_posicao: 'POS-AG01-004' });
    expect(JSON.parse(ultimaAuditoria(db, 'GERENTE_DESLIGADO')!.detalhe)).toEqual({ posicao: 'POS-AG01-004' });
    expect(posicoes.posicaoVaga(db, 'POS-AG01-004', '2026-10-01')).toBe(true);
    expect(posicoes.posicaoVaga(db, 'POS-AG01-003', '2026-10-01')).toBe(false);
  });

  it('desligar quem assumiu ontem: fim = ontem (= início), nunca hoje', () => {
    const { db, clock } = cenario();
    posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-09-30', tipo_vinculo: 'Interino', motivo: 'Correção retroativa' }, GG);
    posicoes.desligarGerente(db, clock, 'GER-106', GG);
    expect(db.bridge_ocupacao_posicao.find((o) => o.id_gerente === 'GER-106')!.data_fim).toBe('2026-09-30');
  });

  it('histórico: ordenado por início mesmo com inserção fora de ordem e só da posição pedida', () => {
    const { db } = cenario();
    db.bridge_ocupacao_posicao.push({ id_ocupacao: 'OCU-9000', id_posicao: 'POS-AG01-005', id_gerente: 'GER-106', data_inicio: '2024-01-01', data_fim: '2024-12-31', tipo_vinculo: 'Interino' });
    const h = posicoes.historicoDaPosicao(db, 'POS-AG01-005');
    expect(h.map((o) => o.id_ocupacao)).toEqual(['OCU-9000', 'OCU-0005', 'OCU-0006']);
    expect(h.every((o) => o.id_posicao === 'POS-AG01-005')).toBe(true);
    expect(posicoes.ocupacaoDoGerente(db, 'GER-106', '2024-06-01')?.id_ocupacao).toBe('OCU-9000');
    expect(posicoes.ocupacaoDoGerente(db, 'GER-106', '2025-06-01')).toBeNull();
  });
});
