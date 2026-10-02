import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { delegacao, posicoes, addDays, diaDe, FixedClock, meioDia, type Delegacao } from '@carteira/core';
import { cenario, em, esperaErro, ger, GG } from './helpers.ts';

const PERIODO = { data_inicio: '2026-11-01', data_fim: '2026-11-15' };
const base = { id_posicao_origem: 'POS-AG01-001', id_gerente_delegado: 'GER-102', motivo: 'Férias', escopo: 'Total' as const, ...PERIODO };

function comDelegacaoAprovada() {
  const ctx = cenario('minimo', '2026-10-01');
  const d = delegacao.submeter(ctx.db, ctx.clock, base, ger(101));
  delegacao.aprovar(ctx.db, ctx.clock, d.id_delegacao, GG);
  return { ...ctx, d };
}

describe('02 Delegação', () => {
  it('AC-DEL-01/02/03: vigência em datas inclusivas no fuso de negócio', () => {
    const { d } = comDelegacaoAprovada();
    expect(delegacao.vigente(d, em('2026-10-31', '23:59:59'))).toBe(false);
    expect(delegacao.vigente(d, em('2026-11-01', '00:00:00'))).toBe(true);
    expect(delegacao.vigente(d, em('2026-11-05'))).toBe(true);
    expect(delegacao.vigente(d, em('2026-11-15', '23:59:59'))).toBe(true);
    expect(delegacao.vigente(d, em('2026-11-16', '00:00:00'))).toBe(false); // expira sozinha, sem intervenção
  });

  it('situação é derivada do relógio, não persistida (FR-DEL-003)', () => {
    const { d } = comDelegacaoAprovada();
    expect(delegacao.situacao(d, em('2026-10-20'))).toBe('Agendada');
    expect(delegacao.situacao(d, em('2026-11-05'))).toBe('Em Vigor');
    expect(delegacao.situacao(d, em('2026-12-01'))).toBe('Concluída');
    expect('situacao' in d).toBe(false);
  });

  it('AC-DEL-04: delegação apenas Submetida não produz efeito', () => {
    const { db, clock } = cenario();
    const d = delegacao.submeter(db, clock, base, ger(101));
    expect(delegacao.delegacoesVigentes(db, em('2026-11-05'))).toHaveLength(0);
    expect(delegacao.situacao(d, em('2026-11-05'))).toBe('Submetida');
  });

  it('AC-DEL-05: sobreposição com delegação aprovada da mesma origem é rejeitada', () => {
    const { db, clock } = comDelegacaoAprovada();
    esperaErro(() => delegacao.submeter(db, clock, { ...base, data_inicio: '2026-11-10', data_fim: '2026-11-20', id_gerente_delegado: 'GER-103' }, GG), 'DELEGACAO_SOBREPOSTA');
    delegacao.submeter(db, clock, { ...base, data_inicio: '2026-11-16', data_fim: '2026-11-20', id_gerente_delegado: 'GER-103' }, GG); // adjacente é válida
  });

  it('AC-DEL-06: auto-delegação e delegado indisponível', () => {
    const { db, clock } = cenario();
    esperaErro(() => delegacao.submeter(db, clock, { ...base, id_gerente_delegado: 'GER-101' }, ger(101)), 'AUTO_DELEGACAO');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, id_gerente_delegado: 'GER-107' }, ger(101)), 'GERENTE_INDISPONIVEL');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, data_inicio: '2026-11-15', data_fim: '2026-11-01' }, ger(101)), 'DATAS_INVALIDAS');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, motivo: ' ' }, ger(101)), 'MOTIVO_OBRIGATORIO');
  });

  it('AC-DEL-07: quem recebeu a cobertura não pode repassá-la; terceiros não solicitam', () => {
    const { db } = comDelegacaoAprovada();
    const noMeio = new FixedClock(em('2026-11-05'));
    esperaErro(() => delegacao.submeter(db, noMeio, { ...base, data_inicio: '2026-11-06', data_fim: '2026-11-07', id_gerente_delegado: 'GER-103' }, ger(102)), 'DELEGACAO_TRANSITIVA');
    esperaErro(() => delegacao.submeter(db, noMeio, { ...base, data_inicio: '2026-12-06', data_fim: '2026-12-07', id_gerente_delegado: 'GER-102' }, ger(103)), 'NAO_AUTORIZADO');
  });

  it('AC-DEL-08: revogação cessa o efeito a partir do instante e preserva o registro', () => {
    const { db, d } = comDelegacaoAprovada();
    delegacao.revogar(db, new FixedClock(em('2026-11-05', '10:00:00')), d.id_delegacao, GG);
    const revogada = db.fct_delegacoes.find((x) => x.id_delegacao === d.id_delegacao)!;
    expect(delegacao.vigente(revogada, em('2026-11-05', '09:59:59'))).toBe(false); // status já é Revogada
    expect(revogada.status_aprovacao).toBe('Revogada');
    expect(revogada.revogada_em).not.toBeNull();
    esperaErro(() => delegacao.revogar(db, new FixedClock(em('2026-11-06')), d.id_delegacao, GG), 'ESTADO_INVALIDO');
  });

  it('AC-DEL-10: troca de titular da origem durante a vigência não encerra a delegação', () => {
    const { db, d } = comDelegacaoAprovada();
    posicoes.trocarTitular(db, new FixedClock(em('2026-11-03')), { id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2026-11-03', tipo_vinculo: 'Titular Efetivo' }, GG);
    const atual = db.fct_delegacoes.find((x) => x.id_delegacao === d.id_delegacao)!;
    expect(delegacao.vigente(atual, em('2026-11-05'))).toBe(true);
  });

  it('delegado que deixa de ser Ativo perde o efeito da delegação', () => {
    const { db, clock } = comDelegacaoAprovada();
    posicoes.desligarGerente(db, clock, 'GER-102', GG);
    expect(delegacao.delegacoesVigentes(db, em('2026-11-05'))).toHaveLength(0);
  });

  it('aprovação e rejeição são do Gerente Geral e só valem para Submetida', () => {
    const { db, clock } = cenario();
    const d = delegacao.submeter(db, clock, base, ger(101));
    esperaErro(() => delegacao.aprovar(db, clock, d.id_delegacao, ger(101)), 'NAO_AUTORIZADO');
    delegacao.rejeitar(db, clock, d.id_delegacao, GG);
    esperaErro(() => delegacao.aprovar(db, clock, d.id_delegacao, GG), 'ESTADO_INVALIDO');
    esperaErro(() => delegacao.aprovar(db, clock, 'DEL-9999', GG), 'DELEGACAO_INEXISTENTE');
  });

  it('GG pode solicitar e aprovar a própria delegação (Q-09); titular revoga a sua', () => {
    const { db, clock } = cenario();
    const d = delegacao.submeter(db, clock, base, GG);
    delegacao.aprovar(db, clock, d.id_delegacao, GG);
    delegacao.revogar(db, clock, d.id_delegacao, ger(101));
    esperaErro(() => delegacao.revogar(db, clock, d.id_delegacao, ger(103)), 'NAO_AUTORIZADO');
  });

  it('varredura de eventos é idempotente (executar 2× não duplica)', () => {
    const { db } = comDelegacaoAprovada();
    const dentro = new FixedClock(em('2026-11-05'));
    expect(delegacao.varrerEventosDeVigencia(db, dentro)).toBe(1);
    expect(delegacao.varrerEventosDeVigencia(db, dentro)).toBe(0);
    expect(delegacao.varrerEventosDeVigencia(db, new FixedClock(em('2026-11-20')))).toBe(1);
    expect(db.log_eventos.filter((e) => e.tipo === 'DelegacaoExpirada')).toHaveLength(1);
  });

  it('propriedade: vigente(d, dia) ⇔ inicio ≤ dia ≤ fim (aprovada), para qualquer período', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 60 }), fc.integer({ min: -30, max: 480 }), (ini, dur, off) => {
        const inicio = addDays('2026-01-01', ini);
        const fim = addDays(inicio, dur);
        const d = { status_aprovacao: 'Aprovada', data_inicio: inicio, data_fim: fim, revogada_em: null } as Delegacao;
        const dia = addDays('2026-01-01', off);
        expect(delegacao.vigente(d, meioDia(dia))).toBe(dia >= inicio && dia <= fim);
        expect(diaDe(meioDia(dia))).toBe(dia);
      }),
      { numRuns: 300 },
    );
  });
});
