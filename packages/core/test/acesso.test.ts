import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { acesso, delegacao, posicoes, noIntervalo, diaDe, FixedClock, type Db, type EscopoDelegacao } from '@carteira/core';
import { cenario, em, GG, ger } from './helpers.ts';

const ids = (db: Db, g: string, instante: Date): string[] => acesso.posicoesPermitidas(db, g, instante).sort();

function comCobertura(escopo: EscopoDelegacao = 'Total') {
  const ctx = cenario();
  const d = delegacao.submeter(ctx.db, ctx.clock, { id_posicao_origem: 'POS-AG01-001', id_gerente_delegado: 'GER-102', data_inicio: '2026-11-01', data_fim: '2026-11-15', motivo: 'Férias', escopo }, ger(101));
  delegacao.aprovar(ctx.db, ctx.clock, d.id_delegacao, GG);
  return { ...ctx, d };
}

describe('04 Acesso e Visibilidade', () => {
  it('AC-ACE-01: titular enxerga só a própria posição, com escrita', () => {
    const { db } = cenario();
    expect(ids(db, 'GER-102', em('2026-10-01'))).toEqual(['POS-AG01-002']);
    expect(acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-002', em('2026-10-01')).modo).toBe('Escrita');
    expect(acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-003', em('2026-10-01')).permitido).toBe(false);
  });

  it('AC-ACE-02 (J2): delegado vê própria + delegada durante a vigência; depois só a própria', () => {
    const { db } = comCobertura();
    expect(ids(db, 'GER-102', em('2026-11-05'))).toEqual(['POS-AG01-001', 'POS-AG01-002']);
    expect(ids(db, 'GER-102', em('2026-11-16'))).toEqual(['POS-AG01-002']);
    expect(ids(db, 'GER-102', em('2026-10-31'))).toEqual(['POS-AG01-002']);
  });

  it('AC-ACE-03: delegação submetida, rejeitada ou revogada não concede acesso', () => {
    const { db, clock, d } = comCobertura();
    delegacao.revogar(db, new FixedClock(em('2026-10-02')), d.id_delegacao, GG);
    expect(ids(db, 'GER-102', em('2026-11-05'))).toEqual(['POS-AG01-002']);
    const s = delegacao.submeter(db, clock, { id_posicao_origem: 'POS-AG01-003', id_gerente_delegado: 'GER-102', data_inicio: '2026-11-01', data_fim: '2026-11-15', motivo: 'x', escopo: 'Total' }, ger(103));
    expect(s.status_aprovacao).toBe('Submetida');
    expect(ids(db, 'GER-102', em('2026-11-05'))).toEqual(['POS-AG01-002']);
  });

  it('AC-ACE-04: Gerente Geral enxerga todas as posições em leitura', () => {
    const { db } = cenario();
    const r = acesso.resolverAcessos(db, 'GER-100', em('2026-10-01'));
    expect(r.geral).toBe(true);
    expect(r.posicoes).toHaveLength(5);
    expect(r.posicoes.every((p) => p.modo === 'Leitura')).toBe(true);
  });

  it('AC-ACE-05: ator desconhecido ou inativo é negado, sem erro', () => {
    const { db } = cenario();
    expect(ids(db, 'GER-999', em('2026-10-01'))).toEqual([]);
    expect(ids(db, 'GER-107', em('2026-10-01'))).toEqual([]);
    expect(acesso.decidirCliente(db, 'GER-999', 'CLI-0001', em('2026-10-01')).permitido).toBe(false);
  });

  it('AC-ACE-06 (J1): o novo titular ganha acesso imediato e o antigo perde', () => {
    const { db, clock } = cenario();
    posicoes.trocarTitular(db, clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, GG);
    expect(ids(db, 'GER-106', em('2026-10-05'))).toEqual(['POS-AG01-003']);
    expect(ids(db, 'GER-103', em('2026-10-05'))).toEqual([]);
    expect(ids(db, 'GER-103', em('2026-10-04'))).toEqual(['POS-AG01-003']);
  });

  it('AC-ACE-07: escopo Apenas Consulta e Emergencial concedem só leitura', () => {
    for (const escopo of ['Apenas Consulta', 'Apenas Emergencial'] as const) {
      const { db } = comCobertura(escopo);
      expect(acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-001', em('2026-11-05')).modo).toBe('Leitura');
      expect(acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-002', em('2026-11-05')).modo).toBe('Escrita');
    }
  });

  it('AC-ACE-08 (Q-08): titular ausente fica somente leitura; volta à escrita após a vigência', () => {
    const { db } = comCobertura();
    expect(acesso.decidirPosicao(db, 'GER-101', 'POS-AG01-001', em('2026-11-05')).modo).toBe('Leitura');
    expect(acesso.decidirPosicao(db, 'GER-101', 'POS-AG01-001', em('2026-11-16')).modo).toBe('Escrita');
  });

  it('AC-ACE-10: consulta as-of reproduz a visibilidade da época, inclusive após redistribuição', () => {
    const { db } = comCobertura();
    const antes = acesso.decidirCliente(db, 'GER-101', 'CLI-0001', em('2026-10-01'));
    expect(antes.permitido).toBe(true);
    expect(acesso.decidirCliente(db, 'GER-102', 'CLI-0001', em('2026-11-05')).modo).toBe('Escrita');
  });

  it('AC-ACE-11: posição vaga — ninguém acessa por titularidade; GG sim; delegação ainda funciona', () => {
    const { db, clock } = cenario();
    posicoes.desligarGerente(db, clock, 'GER-104', GG);
    expect(acesso.resolverAcessos(db, 'GER-104', em('2026-10-02')).posicoes).toEqual([]);
    expect(acesso.resolverAcessos(db, 'GER-100', em('2026-10-02')).posicoes.some((p) => p.id_posicao === 'POS-AG01-004')).toBe(true);
    const d = delegacao.submeter(db, clock, { id_posicao_origem: 'POS-AG01-004', id_gerente_delegado: 'GER-102', data_inicio: '2026-10-02', data_fim: '2026-10-30', motivo: 'Cobrir vacância', escopo: 'Total' }, GG);
    delegacao.aprovar(db, clock, d.id_delegacao, GG);
    expect(ids(db, 'GER-102', em('2026-10-05'))).toEqual(['POS-AG01-002', 'POS-AG01-004']);
  });

  it('delegado que deixa de ser Ativo perde acesso; titular volta à escrita', () => {
    const { db, clock } = comCobertura();
    posicoes.desligarGerente(db, clock, 'GER-102', GG);
    expect(acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-001', em('2026-11-05')).permitido).toBe(false);
    expect(acesso.decidirPosicao(db, 'GER-101', 'POS-AG01-001', em('2026-11-05')).modo).toBe('Escrita');
  });

  it('explica a origem do acesso (FR-ACE-004)', () => {
    const { db } = comCobertura();
    const d = acesso.decidirPosicao(db, 'GER-102', 'POS-AG01-001', em('2026-11-05'));
    expect(d.origens[0]).toMatchObject({ origem: 'Delegado', id_delegacao: 'DEL-0001' });
    expect(d.motivo).toContain('DEL-0001');
  });

  it('exigirAcessoCliente nega sem revelar detalhes e respeita o modo mínimo', () => {
    const { db } = comCobertura('Apenas Consulta');
    expect(() => acesso.exigirAcessoCliente(db, 'GER-103', 'CLI-0001', em('2026-11-05'))).toThrow(/negado/i);
    expect(() => acesso.exigirAcessoCliente(db, 'GER-102', 'CLI-0001', em('2026-11-05'), 'Leitura')).not.toThrow();
    expect(() => acesso.exigirAcessoCliente(db, 'GER-102', 'CLI-0001', em('2026-11-05'), 'Escrita')).toThrow(/negado/i);
  });

  /** Oráculo ingênuo e independente da implementação (laços simples sobre as tabelas). */
  function oraculo(db: Db, idGerente: string, idPosicao: string, instante: Date): boolean {
    const g = db.dim_gerentes.find((x) => x.id_gerente === idGerente);
    if (!g || g.status !== 'Ativo') return false;
    if (g.perfil === 'Gerente Geral') return true;
    const dia = diaDe(instante);
    for (const o of db.bridge_ocupacao_posicao) if (o.id_gerente === idGerente && o.id_posicao === idPosicao && noIntervalo(dia, o.data_inicio, o.data_fim)) return true;
    for (const d of db.fct_delegacoes) {
      const ok = d.status_aprovacao === 'Aprovada' && d.id_gerente_delegado === idGerente && d.id_posicao_origem === idPosicao
        && noIntervalo(dia, d.data_inicio, d.data_fim) && (d.revogada_em === null || instante.getTime() < new Date(d.revogada_em).getTime());
      if (ok) return true;
    }
    return false;
  }

  it('propriedade: decisão ≡ oráculo ingênuo para históricos, delegações e instantes aleatórios', () => {
    const delegacaoArb = fc.record({
      origem: fc.integer({ min: 1, max: 5 }), delegado: fc.integer({ min: 101, max: 107 }), ini: fc.integer({ min: 0, max: 40 }), dur: fc.integer({ min: 0, max: 20 }),
      aprovar: fc.boolean(), escopo: fc.constantFrom<EscopoDelegacao>('Total', 'Apenas Consulta', 'Apenas Emergencial'),
    });
    fc.assert(
      fc.property(fc.array(delegacaoArb, { maxLength: 6 }), fc.integer({ min: -5, max: 70 }), fc.integer({ min: 100, max: 110 }), fc.integer({ min: 1, max: 5 }), (dels, off, g, p) => {
        const { db, clock } = cenario();
        for (const x of dels) {
          const inicio = new Date(Date.UTC(2026, 9, 1 + x.ini)).toISOString().slice(0, 10);
          const fim = new Date(Date.UTC(2026, 9, 1 + x.ini + x.dur)).toISOString().slice(0, 10);
          try {
            const d = delegacao.submeter(db, clock, { id_posicao_origem: `POS-AG01-00${x.origem}`, id_gerente_delegado: `GER-${x.delegado}`, data_inicio: inicio, data_fim: fim, motivo: 'teste', escopo: x.escopo }, GG);
            if (x.aprovar) delegacao.aprovar(db, clock, d.id_delegacao, GG);
          } catch (e) {
            if ((e as { codigo?: string }).codigo === undefined) throw e;
          }
        }
        const instante = new Date(Date.UTC(2026, 9, 1 + off, 15));
        const idGerente = `GER-${g}`;
        const idPosicao = `POS-AG01-00${p}`;
        const decisao = acesso.decidirPosicao(db, idGerente, idPosicao, instante);
        expect(decisao.permitido).toBe(oraculo(db, idGerente, idPosicao, instante));
        expect(decisao.modo === 'Negado').toBe(!decisao.permitido);
      }),
      { numRuns: 400 },
    );
  });
});
