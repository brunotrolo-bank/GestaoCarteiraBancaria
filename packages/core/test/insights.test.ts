import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { insights, clientes, delegacao, posicoes, FixedClock, type Db } from '@carteira/core';
import { cenario, em, esperaErro, GG, ger } from './helpers.ts';
import { criarSeed } from '@carteira/data';

const ctx = (idGerente: string, dia: string) => ({ idGerente, instante: em(dia) });

function oraculoAgencia(db: Db) {
  const ativos = db.dim_clientes.filter((c) => c.status === 'Ativo');
  const centavos = ativos.reduce((a, c) => a + Math.round(c.volume_aum * 100), 0);
  return { total: ativos.length, aum: centavos / 100 };
}

describe('05 Insights, 360° e Torre de Controle', () => {
  it('AC-INS-01 (J3): a Torre mostra exatamente os totais do dataset', () => {
    const { db } = cenario('demo');
    const r = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01'));
    const esperado = oraculoAgencia(db);
    expect(r.escopo).toBe('Agencia');
    expect(r.total_clientes).toBe(esperado.total);
    expect(r.aum_total).toBe(esperado.aum);
    expect(r.aum_medio_por_cliente).toBeCloseTo(esperado.aum / esperado.total, 2);
    expect(r.total_clientes).toBe(96 + 75 + 70 + 32 + 75);
  });

  it('AC-INS-02: 120% e 40% aparecem em desbalanceamento; 94%, 87,5% e 94% não', () => {
    const { db } = cenario('demo');
    const alertas = insights.desbalanceamentos(db, ctx('GER-100', '2026-10-01'));
    expect(alertas.map((a) => [a.id_posicao, a.desbalanceamento])).toEqual([['POS-AG01-001', 'Acima'], ['POS-AG01-004', 'Abaixo']]);
    expect(insights.classificarUtilizacao(1)).toBeNull(); // exatamente 100% não é excesso
    expect(insights.classificarUtilizacao(0.5)).toBeNull();
    expect(insights.classificarUtilizacao(0.4999)).toBe('Abaixo');
    expect(insights.classificarUtilizacao(1.0001)).toBe('Acima');
  });

  it('AC-INS-03: gerente comum só vê a própria carteira, nunca a soma da agência', () => {
    const { db } = cenario('demo');
    const r = insights.resumoAgencia(db, ctx('GER-102', '2026-10-01'));
    expect(r.escopo).toBe('Carteira');
    expect(r.posicoes.map((p) => p.id_posicao)).toEqual(['POS-AG01-002']);
    expect(r.total_clientes).toBe(75);
    const visiveis = insights.clientesVisiveis(db, ctx('GER-102', '2026-10-01'));
    expect(visiveis.every((c) => c.id_posicao_carteira === 'POS-AG01-002')).toBe(true);
  });

  it('AC-INS-04 (FR-INS-009): soma das posições = total da agência (propriedade, várias sementes)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), (semente) => {
        const db = criarSeed({ cenario: 'minimo', semente });
        const r = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01'));
        expect(r.posicoes.reduce((a, p) => a + p.clientes_ativos, 0)).toBe(r.total_clientes);
        expect(Math.round(r.posicoes.reduce((a, p) => a + p.aum_total * 100, 0))).toBe(Math.round(r.aum_total * 100));
        expect(r.por_segmento.reduce((a, s) => a + s.clientes, 0)).toBe(r.total_clientes);
      }),
      { numRuns: 40 },
    );
  });

  it('AC-INS-05: 360° de cliente de outra posição é negado', () => {
    const { db } = cenario('demo');
    const alheio = db.dim_clientes.find((c) => c.id_posicao_carteira === 'POS-AG01-003')!;
    esperaErro(() => insights.visao360(db, ctx('GER-102', '2026-10-01'), alheio.id_cliente), 'ACESSO_NEGADO');
    esperaErro(() => insights.visao360(db, ctx('GER-102', '2026-10-01'), 'CLI-9999'), 'ACESSO_NEGADO'); // não revela existência
  });

  it('360° completo: cadastro mascarado, produtos, CRM e linha do tempo', () => {
    const { db } = cenario('demo');
    const c = db.dim_clientes.find((x) => x.id_posicao_carteira === 'POS-AG01-001' && x.status === 'Ativo')!;
    const v = insights.visao360(db, ctx('GER-101', '2026-10-01'), c.id_cliente);
    expect(v.cliente.cpf_cnpj_mascarado).toMatch(/\*/);
    expect(JSON.stringify(v)).not.toContain(c.cpf_cnpj);
    expect(v.produtos).toHaveLength(5);
    expect(v.linha_do_tempo).toHaveLength(1);
    expect(v.decisao.modo).toBe('Escrita');
  });

  it('AC-INS-06: consulta as-of reproduz a carteira anterior à redistribuição', () => {
    const { db } = cenario('demo');
    const hoje = new FixedClock(em('2026-10-01', '15:00:00'));
    const ids = db.dim_clientes.filter((c) => c.id_posicao_carteira === 'POS-AG01-001' && c.status === 'Ativo').slice(0, 20).map((c) => c.id_cliente);
    clientes.executarRedistribuicao(db, hoje, { ids_clientes: ids, id_posicao_destino: 'POS-AG01-004', motivo: 'J3' }, GG);
    const antes = insights.resumoAgencia(db, { idGerente: 'GER-100', instante: em('2026-10-01', '09:00:00') });
    const depois = insights.resumoAgencia(db, { idGerente: 'GER-100', instante: em('2026-10-01', '18:00:00') });
    expect(antes.posicoes.find((p) => p.id_posicao === 'POS-AG01-001')!.clientes_ativos).toBe(96);
    expect(depois.posicoes.find((p) => p.id_posicao === 'POS-AG01-001')!.clientes_ativos).toBe(76);
    expect(depois.posicoes_em_alerta).toBeLessThan(antes.posicoes_em_alerta + 1);
  });

  it('AC-INS-07: carteira vazia devolve zeros, sem divisão por zero', () => {
    const { db, clock } = cenario();
    const p = posicoes.criarPosicao(db, clock, { nome_posicao: 'Mesa Vazia', id_agencia: 'AG01', segmento_especialidade: 'Misto', capacidade_max_contas: 10 }, GG);
    const r = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01')).posicoes.find((x) => x.id_posicao === p.id_posicao)!;
    expect(r).toMatchObject({ clientes_ativos: 0, aum_total: 0, utilizacao: 0, vaga: true });
    expect(Number.isNaN(r.utilizacao)).toBe(false);
    const vazio = criarSeed({ cenario: 'minimo' });
    vazio.dim_clientes = [];
    vazio.bridge_vinculo_carteira = [];
    const resumo = insights.resumoAgencia(vazio, ctx('GER-100', '2026-10-01'));
    expect(resumo.aum_medio_por_cliente).toBe(0);
    expect(resumo.penetracao_media).toBe(0);
  });

  it('AC-INS-08: delegado vê duas seções durante a vigência e uma depois', () => {
    const { db } = cenario('demo');
    const dentro = insights.carteiraDoAtor(db, ctx('GER-102', '2026-11-05'));
    expect(dentro.map((s) => s.tipo)).toEqual(['Propria', 'Delegada']);
    expect(dentro[1]!.cobertura).toMatchObject({ id_delegacao: 'DEL-0001', data_fim: '2026-11-15', situacao: 'Em Vigor' });
    expect(dentro[1]!.posicao.id_posicao).toBe('POS-AG01-001');
    expect(dentro[1]!.clientes.length).toBeGreaterThan(90);
    const fora = insights.carteiraDoAtor(db, ctx('GER-102', '2026-11-16'));
    expect(fora.map((s) => s.tipo)).toEqual(['Propria']);
  });

  it('GG recebe uma seção própria por posição; titular ausente aparece como leitura', () => {
    const { db } = cenario('demo');
    expect(insights.carteiraDoAtor(db, ctx('GER-100', '2026-10-01'))).toHaveLength(5);
    const ausente = insights.carteiraDoAtor(db, ctx('GER-101', '2026-11-05'));
    expect(ausente[0]!.posicao.modo).toBe('Leitura');
  });

  it('penetração por produto usa só clientes Ativos com produto Ativo', () => {
    const { db } = cenario('demo');
    const r = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01'));
    const black = r.penetracao_por_produto.find((p) => p.codigo === 'CARTAO_BLACK')!;
    const manual = db.dim_clientes.filter((c) => c.status === 'Ativo' && db.fct_produtos_cliente.some((x) => x.id_cliente === c.id_cliente && x.codigo_produto === 'CARTAO_BLACK' && x.status === 'Ativo')).length;
    expect(black.clientes).toBe(manual);
    expect(black.penetracao).toBeCloseTo(manual / r.total_clientes, 10);
  });

  it('métricas somam em centavos (sem erro de ponto flutuante)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 99_999_999 }), { minLength: 1, maxLength: 50 }), (cents) => {
        const db = criarSeed({ cenario: 'minimo' });
        db.dim_clientes.forEach((c, i) => { c.volume_aum = (cents[i % cents.length]!) / 100; c.status = 'Ativo'; });
        const r = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01'));
        const esperado = db.dim_clientes.reduce((a, c) => a + Math.round(c.volume_aum * 100), 0) / 100;
        expect(r.aum_total).toBe(esperado);
      }),
      { numRuns: 60 },
    );
    void delegacao; void ger;
  });

  it('exigirAtorAtivo rejeita ator desconhecido ou desligado', () => {
    const { db } = cenario();
    expect(insights.exigirAtorAtivo(db, 'GER-101').nome_completo).toBe('Carlos Silva');
    esperaErro(() => insights.exigirAtorAtivo(db, 'GER-107'), 'ATOR_DESCONHECIDO');
    esperaErro(() => insights.exigirAtorAtivo(db, 'GER-999'), 'ATOR_DESCONHECIDO');
  });
});
