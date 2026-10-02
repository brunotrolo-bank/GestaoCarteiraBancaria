import { describe, expect, it } from 'vitest';
import { delegacao, posicoes, FixedClock, meioDia, type Delegacao } from '@carteira/core';
import { capturaErro, cenario, em, esperaErro, ger, GG, ultimaAuditoria, ultimoEvento } from './helpers.ts';

const base = { id_posicao_origem: 'POS-AG01-001', id_gerente_delegado: 'GER-102', data_inicio: '2026-11-01', data_fim: '2026-11-15', motivo: 'Férias', escopo: 'Total' as const };

/** Testes dirigidos pelos mutantes sobreviventes do módulo de delegação. */
describe('delegação — bordas de vigência, validações, auditoria e eventos (mutação)', () => {
  it('revogação vale exatamente a partir do instante (>=), em delegação aprovada com revogada_em', () => {
    const d = { status_aprovacao: 'Aprovada', data_inicio: '2026-11-01', data_fim: '2026-11-15', revogada_em: '2026-11-05T13:00:00.000Z' } as Delegacao;
    expect(delegacao.vigente(d, new Date('2026-11-05T12:59:59.999Z'))).toBe(true);
    expect(delegacao.vigente(d, new Date('2026-11-05T13:00:00.000Z'))).toBe(false); // exatamente no instante
    expect(delegacao.vigente(d, new Date('2026-11-06T13:00:00.000Z'))).toBe(false);
  });

  it('situação nos dias exatos de início e fim: Em Vigor (inclusivo), não Agendada/Concluída', () => {
    const d = { status_aprovacao: 'Aprovada', data_inicio: '2026-11-01', data_fim: '2026-11-15' } as Delegacao;
    expect(delegacao.situacao(d, em('2026-10-31'))).toBe('Agendada');
    expect(delegacao.situacao(d, em('2026-11-01'))).toBe('Em Vigor');
    expect(delegacao.situacao(d, em('2026-11-15'))).toBe('Em Vigor');
    expect(delegacao.situacao(d, em('2026-11-16'))).toBe('Concluída');
  });

  it('delegado inexistente não quebra a consulta de vigentes e não concede efeito', () => {
    const { db } = cenario();
    db.fct_delegacoes.push({ ...base, id_delegacao: 'DEL-X', id_gerente_delegado: 'GER-999', status_aprovacao: 'Aprovada', criada_por: 'GER-100', criada_em: '2026-09-01T00:00:00.000Z', decidida_por: null, decidida_em: null, revogada_em: null });
    expect(delegacao.delegacoesVigentes(db, em('2026-11-05'))).toEqual([]);
  });

  it('sobreposição só conta delegações APROVADAS da MESMA posição', () => {
    const { db, clock } = cenario();
    const a = delegacao.submeter(db, clock, base, ger(101));
    delegacao.submeter(db, clock, { ...base, id_gerente_delegado: 'GER-103', data_inicio: '2026-11-10', data_fim: '2026-11-20' }, GG); // outra Submetida sobreposta: permitido
    delegacao.aprovar(db, clock, a.id_delegacao, GG);
    const b = delegacao.submeter(db, clock, { ...base, id_posicao_origem: 'POS-AG01-003', id_gerente_delegado: 'GER-104' }, GG);
    expect(delegacao.aprovar(db, clock, b.id_delegacao, GG).status_aprovacao).toBe('Aprovada'); // outra posição, mesmas datas: ok
    // a segunda Submetida da POS-001 não pode ser aprovada por colidir com a aprovada
    const pendente = db.fct_delegacoes.find((d) => d.id_gerente_delegado === 'GER-103')!;
    esperaErro(() => delegacao.aprovar(db, clock, pendente.id_delegacao, GG), 'DELEGACAO_SOBREPOSTA');
    expect(pendente.status_aprovacao).toBe('Submetida'); // rollback
  });

  it('validações de entrada: datas (cada uma), escopo, motivo ausente/espaços e posição vaga sem quebrar', () => {
    const { db, clock } = cenario();
    esperaErro(() => delegacao.submeter(db, clock, { ...base, data_inicio: '2026-13-01' }, GG), 'DATAS_INVALIDAS');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, data_fim: '2026-02-30' }, GG), 'DATAS_INVALIDAS');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, data_fim: '2026-10-31' }, GG), 'DATAS_INVALIDAS');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, motivo: undefined as never }, GG), 'MOTIVO_OBRIGATORIO');
    esperaErro(() => delegacao.submeter(db, clock, { ...base, motivo: '   ' }, GG), 'MOTIVO_OBRIGATORIO');
    expect(delegacao.submeter(db, clock, { ...base, data_inicio: '2026-11-15', data_fim: '2026-11-15', motivo: '  Férias  ' }, GG)).toMatchObject({ motivo: 'Férias' }); // 1 dia e motivo aparado
    posicoes.desligarGerente(db, clock, 'GER-102', GG); // POS-002 fica vaga
    esperaErro(() => delegacao.submeter(db, clock, { ...base, id_posicao_origem: 'POS-AG01-002', id_gerente_delegado: 'GER-103' }, ger(105)), 'NAO_AUTORIZADO');
  });

  it('quem recebeu cobertura de OUTRA posição não é "transitivo": é apenas não autorizado; dois vigentes não confundem', () => {
    const { db, clock } = cenario();
    const d1 = delegacao.submeter(db, clock, base, GG);
    delegacao.aprovar(db, clock, d1.id_delegacao, GG);
    const d2 = delegacao.submeter(db, clock, { ...base, id_posicao_origem: 'POS-AG01-003', id_gerente_delegado: 'GER-104' }, GG);
    delegacao.aprovar(db, clock, d2.id_delegacao, GG);
    const meio = new FixedClock(em('2026-11-05'));
    const e = capturaErro(() => delegacao.submeter(db, meio, { ...base, id_posicao_origem: 'POS-AG01-005', id_gerente_delegado: 'GER-103', data_inicio: '2026-11-06', data_fim: '2026-11-07' }, ger(102)));
    expect(e.codigo).toBe('NAO_AUTORIZADO'); // GER-102 recebeu a POS-001, mas está tentando a POS-005
    esperaErro(() => delegacao.submeter(db, meio, { ...base, data_inicio: '2026-11-06', data_fim: '2026-11-07', id_gerente_delegado: 'GER-103' }, ger(102)), 'DELEGACAO_TRANSITIVA');
    esperaErro(() => delegacao.submeter(db, meio, { ...base, id_posicao_origem: 'POS-AG01-003', data_inicio: '2026-11-06', data_fim: '2026-11-07', id_gerente_delegado: 'GER-103' }, ger(104)), 'DELEGACAO_TRANSITIVA');
  });

  it('auto-delegação usa o titular no início; se não havia titular, cai no titular de hoje', () => {
    const { db, clock } = cenario();
    esperaErro(() => delegacao.submeter(db, clock, { ...base, id_gerente_delegado: 'GER-101', data_inicio: '2024-06-01', data_fim: '2024-06-10' }, GG), 'AUTO_DELEGACAO');
  });

  it('submissão registra auditoria e evento com os dados corretos e estado inicial', () => {
    const { db, clock } = cenario();
    const d = delegacao.submeter(db, clock, base, ger(101));
    expect(d).toMatchObject({ status_aprovacao: 'Submetida', criada_por: 'GER-101', decidida_por: null, decidida_em: null, revogada_em: null });
    expect(ultimaAuditoria(db, 'DELEGACAO_SUBMETIDA')).toMatchObject({ ator: 'GER-101', entidade: 'fct_delegacoes', id_entidade: d.id_delegacao });
    expect(JSON.parse(ultimaAuditoria(db, 'DELEGACAO_SUBMETIDA')!.detalhe)).toEqual({ origem: 'POS-AG01-001', delegado: 'GER-102' });
    expect(JSON.parse(ultimoEvento(db, 'DelegacaoSubmetida')!.payload)).toEqual({ id_delegacao: d.id_delegacao });
  });

  it('aprovação, rejeição e revogação: estados válidos, mensagens, auditoria e eventos', () => {
    const { db, clock } = cenario();
    const d = delegacao.submeter(db, clock, base, ger(101));
    delegacao.aprovar(db, clock, d.id_delegacao, GG);
    expect(d).toMatchObject({ decidida_por: 'GER-100' });
    expect(ultimaAuditoria(db, 'DELEGACAO_APROVADA')).toMatchObject({ ator: 'GER-100', entidade: 'fct_delegacoes', id_entidade: d.id_delegacao });
    expect(JSON.parse(ultimoEvento(db, 'DelegacaoAprovada')!.payload)).toEqual({ id_delegacao: d.id_delegacao });
    esperaErro(() => delegacao.rejeitar(db, clock, d.id_delegacao, GG), 'ESTADO_INVALIDO'); // já aprovada
    esperaErro(() => delegacao.aprovar(db, clock, d.id_delegacao, GG), 'ESTADO_INVALIDO');
    delegacao.revogar(db, clock, d.id_delegacao, ger(101));
    expect(JSON.parse(ultimaAuditoria(db, 'DELEGACAO_REVOGADA')!.detalhe)).toEqual({ estava_aprovada: true });
    expect(JSON.parse(ultimoEvento(db, 'DelegacaoRevogada')!.payload)).toEqual({ id_delegacao: d.id_delegacao });
    const s = delegacao.submeter(db, clock, { ...base, data_inicio: '2027-01-01', data_fim: '2027-01-05' }, GG);
    delegacao.revogar(db, clock, s.id_delegacao, GG); // Submetida também pode ser cancelada
    expect(JSON.parse(ultimaAuditoria(db, 'DELEGACAO_REVOGADA')!.detalhe)).toEqual({ estava_aprovada: false });
    const r = delegacao.submeter(db, clock, { ...base, data_inicio: '2027-02-01', data_fim: '2027-02-05' }, GG);
    delegacao.rejeitar(db, clock, r.id_delegacao, GG);
    expect(ultimaAuditoria(db, 'DELEGACAO_REJEITADA')).toMatchObject({ id_entidade: r.id_delegacao });
    esperaErro(() => delegacao.revogar(db, clock, r.id_delegacao, GG), 'ESTADO_INVALIDO'); // Rejeitada não revoga
  });

  it('revogar: ator inativo, titular só da própria origem e posição vaga sem quebrar', () => {
    const { db, clock } = cenario();
    const d = delegacao.submeter(db, clock, base, ger(101));
    esperaErro(() => delegacao.revogar(db, clock, d.id_delegacao, ger(107)), 'GERENTE_INDISPONIVEL');
    esperaErro(() => delegacao.revogar(db, clock, d.id_delegacao, ger(103)), 'NAO_AUTORIZADO');
    posicoes.desligarGerente(db, clock, 'GER-101', GG); // POS-001 vaga: nenhum não-GG revoga
    esperaErro(() => delegacao.revogar(db, clock, d.id_delegacao, ger(102)), 'NAO_AUTORIZADO');
  });

  it('varredura de vigência: Submetida e Agendada não emitem; Em Vigor e Concluída emitem o evento certo', () => {
    const { db } = cenario('demo');
    expect(delegacao.varrerEventosDeVigencia(db, new FixedClock(meioDia('2026-10-01')))).toBe(0); // DEL-0001 agendada, DEL-0002 submetida
    expect(delegacao.varrerEventosDeVigencia(db, new FixedClock(meioDia('2026-11-05')))).toBe(1);
    expect(ultimoEvento(db, 'DelegacaoIniciada')).toBeDefined();
    expect(ultimoEvento(db, 'DelegacaoExpirada')).toBeUndefined();
    expect(delegacao.varrerEventosDeVigencia(db, new FixedClock(meioDia('2026-11-20')))).toBe(1);
    expect(JSON.parse(ultimoEvento(db, 'DelegacaoExpirada')!.payload)).toEqual({ id_delegacao: 'DEL-0001' });
    esperaErro(() => delegacao.obterDelegacao(db, 'DEL-9999'), 'DELEGACAO_INEXISTENTE');
  });
});
