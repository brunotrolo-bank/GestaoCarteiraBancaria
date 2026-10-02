import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { posicoes, addDays, intervalosSobrepostos, FixedClock, meioDia } from '@carteira/core';
import { assinaturaCarteira, cenario, esperaErro, ger, GG, execucoes } from './helpers.ts';

describe('01 Posições e Ocupação', () => {
  it('AC-POS-01 (J1): troca de titular não altera nenhum cliente nem vínculo', () => {
    const { db, clock } = cenario();
    const antes = assinaturaCarteira(db);
    const nova = posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, GG);
    const anterior = db.bridge_ocupacao_posicao.find((o) => o.id_gerente === 'GER-103')!;
    expect(anterior.data_fim).toBe('2026-10-04');
    expect(nova.data_fim).toBeNull();
    expect(posicoes.titularVigente(db, 'POS-AG01-003', '2026-10-05')?.id_gerente).toBe('GER-106');
    expect(posicoes.titularVigente(db, 'POS-AG01-003', '2026-10-04')?.id_gerente).toBe('GER-103');
    expect(assinaturaCarteira(db)).toBe(antes);
  });

  it('AC-POS-02: segunda ocupação vigente na mesma posição é rejeitada', () => {
    const { db } = cenario();
    esperaErro(() => posicoes.validarNovaOcupacao(db, { id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2026-10-01', data_fim: null }), 'OCUPACAO_SOBREPOSTA');
  });

  it('AC-POS-03: extinguir posição com carteira é rejeitado; posição vazia pode ser extinta', () => {
    const { db, clock } = cenario();
    esperaErro(() => posicoes.alterarStatusPosicao(db, clock, 'POS-AG01-001', 'Extinta', GG), 'POSICAO_COM_CARTEIRA');
    const p = posicoes.criarPosicao(db, clock, { nome_posicao: 'Mesa Nova', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 10 }, GG);
    expect(p.id_posicao).toBe('POS-AG01-006');
    expect(posicoes.alterarStatusPosicao(db, clock, p.id_posicao, 'Extinta', GG).status).toBe('Extinta');
    esperaErro(() => posicoes.alterarStatusPosicao(db, clock, p.id_posicao, 'Ativa', GG), 'TRANSICAO_INVALIDA');
  });

  it('AC-POS-04: início da nova ocupação não pode ser anterior ao início da atual', () => {
    const { db, clock } = cenario();
    esperaErro(
      () => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2025-01-02', tipo_vinculo: 'Titular Efetivo', motivo: 'Correção' }, GG),
      'INTERVALO_INVALIDO',
    );
  });

  it('AC-POS-05: consulta as-of devolve o titular da época', () => {
    const { db } = cenario();
    expect(posicoes.titularVigente(db, 'POS-AG01-005', '2026-02-15')?.id_gerente).toBe('GER-107');
    expect(posicoes.titularVigente(db, 'POS-AG01-005', '2026-08-15')?.id_gerente).toBe('GER-105');
    esperaErro(() => posicoes.historicoDaPosicao(db, 'POS-XXX'), 'POSICAO_INEXISTENTE');
    expect(posicoes.historicoDaPosicao(db, 'POS-AG01-005').map((o) => o.id_gerente)).toEqual(['GER-107', 'GER-105']);
  });

  it('AC-POS-06: gerente desligado não recebe ocupação', () => {
    const { db, clock } = cenario();
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-107', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, GG), 'GERENTE_INDISPONIVEL');
  });

  it('AC-POS-07 (Q-01): um gerente ocupa no máximo uma posição — e a falha é atômica', () => {
    const { db, clock } = cenario();
    const antes = JSON.stringify(db.bridge_ocupacao_posicao);
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-002', id_gerente: 'GER-101', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, GG), 'GERENTE_JA_ALOCADO');
    expect(JSON.stringify(db.bridge_ocupacao_posicao)).toBe(antes); // titular anterior continua sem data_fim
  });

  it('restringe operações administrativas ao Gerente Geral e exige motivo na troca retroativa', () => {
    const { db, clock } = cenario();
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, ger(101)), 'NAO_AUTORIZADO');
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-09-20', tipo_vinculo: 'Titular Efetivo' }, GG), 'MOTIVO_OBRIGATORIO');
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-100', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, GG), 'PERFIL_INVALIDO');
    esperaErro(() => posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '05/10/2026', tipo_vinculo: 'Titular Efetivo' }, GG), 'DATAS_INVALIDAS');
  });

  it('cadastro de gerente exige e-mail único (sem diferenciar maiúsculas)', () => {
    const { db, clock } = cenario();
    const g = posicoes.cadastrarGerente(db, clock, { nome_completo: 'Nova Pessoa', email_corporativo: 'Nova.Pessoa@Banco-POC.example', perfil: 'Gerente de Contas' }, GG);
    expect(g.id_gerente).toBe('GER-108');
    expect(g.email_corporativo).toBe('nova.pessoa@banco-poc.example');
    esperaErro(() => posicoes.cadastrarGerente(db, clock, { nome_completo: 'Outra', email_corporativo: 'NOVA.PESSOA@banco-poc.example', perfil: 'Gerente de Contas' }, GG), 'EMAIL_DUPLICADO');
    esperaErro(() => posicoes.cadastrarGerente(db, clock, { nome_completo: 'X', email_corporativo: 'invalido', perfil: 'Gerente de Contas' }, GG), 'DADOS_INVALIDOS');
  });

  it('desligar o titular deixa a posição vaga e preserva a carteira (FR-POS-007/010)', () => {
    const { db, clock } = cenario();
    const antes = assinaturaCarteira(db);
    posicoes.desligarGerente(db, clock, 'GER-104', GG);
    expect(posicoes.posicaoVaga(db, 'POS-AG01-004', '2026-10-01')).toBe(true);
    expect(db.log_eventos.some((e) => e.tipo === 'PosicaoVagou')).toBe(true);
    expect(assinaturaCarteira(db)).toBe(antes);
    esperaErro(() => posicoes.desligarGerente(db, clock, 'GER-104', GG), 'TRANSICAO_INVALIDA');
  });

  it('propriedade: qualquer sequência de trocas preserva ≤1 titular por posição e ≤1 posição por gerente', () => {
    const operacao = fc.record({ pos: fc.integer({ min: 1, max: 5 }), ger: fc.integer({ min: 101, max: 106 }), passo: fc.integer({ min: 1, max: 20 }) });
    fc.assert(
      fc.property(fc.array(operacao, { minLength: 1, maxLength: 25 }), (ops) => {
        const { db } = cenario();
        let dia = '2026-10-02';
        for (const op of ops) {
          dia = addDays(dia, op.passo);
          const clock = new FixedClock(meioDia(dia));
          try {
            posicoes.trocarTitular(db, clock, { id_posicao: `POS-AG01-00${op.pos}`, id_gerente: `GER-${op.ger}`, data_inicio: dia, tipo_vinculo: 'Titular Efetivo' }, GG);
          } catch (e) {
            if ((e as { codigo?: string }).codigo === undefined) throw e;
          }
        }
        const oc = db.bridge_ocupacao_posicao;
        for (let i = 0; i < oc.length; i += 1) {
          for (let j = i + 1; j < oc.length; j += 1) {
            if (!intervalosSobrepostos({ inicio: oc[i]!.data_inicio, fim: oc[i]!.data_fim }, { inicio: oc[j]!.data_inicio, fim: oc[j]!.data_fim })) continue;
            expect(oc[i]!.id_posicao).not.toBe(oc[j]!.id_posicao);
            expect(oc[i]!.id_gerente).not.toBe(oc[j]!.id_gerente);
          }
        }
      }),
      { numRuns: execucoes(150) },
    );
  });
});
