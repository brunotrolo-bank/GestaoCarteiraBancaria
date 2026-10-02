import { describe, expect, it } from 'vitest';
import { insights, posicoes } from '@carteira/core';
import { cenario, em, esperaErro, GG, ger } from './helpers.ts';

const ctx = (idGerente: string, dia: string) => ({ idGerente, instante: em(dia) });
const metas = { meta_aum: 2_000_000_000, meta_clientes: 90, utilizacao_minima: 0.6, utilizacao_maxima: 0.9 };

describe('01 Metas e limites de alerta por posição', () => {
  it('sem configuração: sem meta e limites padrão de 50% a 100%', () => {
    const { db } = cenario('demo');
    db.cfg_metas_posicao = [];
    expect(posicoes.metasDaPosicao(db, 'POS-AG01-002')).toEqual({ meta_aum: 0, meta_clientes: 0, utilizacao_minima: 0.5, utilizacao_maxima: 1 });
  });

  it('só o Gerente Geral define; grava a configuração, a auditoria e o evento', () => {
    const { db, clock } = cenario('demo');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', metas, ger(102)), 'NAO_AUTORIZADO');
    const linha = posicoes.definirMetas(db, clock, 'POS-AG01-002', metas, GG);
    expect(linha).toMatchObject({ id_posicao: 'POS-AG01-002', ...metas, atualizado_por: 'GER-100' });
    expect(posicoes.metasDaPosicao(db, 'POS-AG01-002')).toEqual(metas);
    expect(db.log_auditoria.at(-1)).toMatchObject({ acao: 'POSICAO_METAS_DEFINIDAS', id_entidade: 'POS-AG01-002' });
    expect(db.log_eventos.at(-1)!.tipo).toBe('MetasPosicaoDefinidas');
    const n = db.cfg_metas_posicao.length;
    posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, meta_clientes: 70 }, GG);
    expect(db.cfg_metas_posicao).toHaveLength(n); // atualiza a mesma linha, não duplica
  });

  it('rejeita valores inválidos sem gravar nada', () => {
    const { db, clock } = cenario('demo');
    const antes = JSON.stringify(db.cfg_metas_posicao);
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-INEXISTENTE', metas, GG), 'POSICAO_INEXISTENTE');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, meta_aum: -1 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, meta_clientes: 10.5 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, utilizacao_minima: 1 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, utilizacao_maxima: 0.6 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, utilizacao_maxima: 3.5 }, GG), 'DADOS_INVALIDOS');
    esperaErro(() => posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, meta_aum: Number.NaN }, GG), 'DADOS_INVALIDOS');
    expect(JSON.stringify(db.cfg_metas_posicao)).toBe(antes);
  });

  it('o limite configurado muda o alerta da posição (93,8% passa a "Acima" com máximo de 90%)', () => {
    const { db, clock } = cenario('demo');
    const antes = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01')).posicoes.find((p) => p.id_posicao === 'POS-AG01-002')!;
    expect(antes.desbalanceamento).toBeNull();
    posicoes.definirMetas(db, clock, 'POS-AG01-002', { ...metas, utilizacao_maxima: 0.9 }, GG);
    const depois = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01')).posicoes.find((p) => p.id_posicao === 'POS-AG01-002')!;
    expect(depois.desbalanceamento).toBe('Acima');
    expect(depois.metas).toEqual({ ...metas, utilizacao_maxima: 0.9 });
    expect(insights.resumoAgencia(db, ctx('GER-100', '2026-10-01')).posicoes_em_alerta).toBe(3);
  });

  it('o atingimento das metas aparece na análise e gera insights', () => {
    const { db } = cenario('demo');
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(a.metas_posicoes).toHaveLength(5);
    const m = a.metas_posicoes.find((x) => x.id_posicao === 'POS-AG01-004')!;
    expect(m.pct_meta_aum).toBeLessThan(70);
    expect(m.pct_meta_clientes).toBeLessThan(70);
    expect(a.insights.some((i) => i.titulo.includes('abaixo de 70% da meta de AUM') && i.severidade === 'atencao')).toBe(true);
    expect(a.insights.some((i) => i.titulo.includes('abaixo de 70% da meta de clientes'))).toBe(true);
    db.cfg_metas_posicao = [];
    const sem = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(sem.metas_posicoes.every((x) => x.pct_meta_aum === null && x.pct_meta_clientes === null)).toBe(true);
    expect(sem.insights.some((i) => i.titulo.includes('meta'))).toBe(false);
  });

  it('posição que bateu a meta de AUM gera insight positivo', () => {
    const { db } = cenario('demo');
    db.cfg_metas_posicao.find((x) => x.id_posicao === 'POS-AG01-001')!.meta_aum = 1_000_000;
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(a.insights.some((i) => i.severidade === 'positivo' && i.titulo.includes('atingiram a meta de AUM'))).toBe(true);
  });
});

describe('05 Comparativo entre períodos', () => {
  const pedido = { inicio: '2026-09-01', fim: '2026-09-30' };

  it('compara o período com o anterior de mesma duração, sem sobreposição', () => {
    const { db } = cenario('demo');
    const c = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido);
    expect(c.dias).toBe(30);
    expect(c.atual).toEqual(pedido);
    expect(c.anterior).toEqual({ inicio: '2026-08-02', fim: '2026-08-31' });
    expect(c.metricas.map((m) => m.chave)).toEqual(['base_clientes', 'base_aum', 'novos_clientes', 'contratacoes', 'interacoes', 'clientes_contatados', 'cobertura_contato', 'movimentacoes']);
    expect(c.ressalvas.length).toBeGreaterThan(0);
  });

  it('os números batem com a contagem direta das tabelas', () => {
    const { db } = cenario('demo');
    const c = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido);
    const m = Object.fromEntries(c.metricas.map((x) => [x.chave, x]));
    const nosSet = (d: string) => d >= '2026-09-01' && d <= '2026-09-30';
    const ativos = new Set(db.dim_clientes.filter((x) => x.status === 'Ativo').map((x) => x.id_cliente));
    expect(m.interacoes!.atual).toBe(db.fct_interacoes_crm.filter((i) => nosSet(i.data)).length);
    expect(m.contratacoes!.atual).toBe(db.fct_produtos_cliente.filter((p) => p.status === 'Ativo' && nosSet(p.data_contratacao)).length);
    expect(m.novos_clientes!.atual).toBe(db.dim_clientes.filter((x) => x.status === 'Ativo' && nosSet(x.data_carteirizacao)).length);
    expect(m.base_clientes!.atual).toBe(db.dim_clientes.filter((x) => x.status === 'Ativo' && x.data_carteirizacao <= '2026-09-30').length);
    expect(m.clientes_contatados!.atual).toBe(new Set(db.fct_interacoes_crm.filter((i) => nosSet(i.data) && ativos.has(i.id_cliente)).map((i) => i.id_cliente)).size);
    expect(m.variacao_pct).toBeUndefined();
    const soma = (k: 'interacoes' | 'contratacoes' | 'novos_clientes', lado: 'atual' | 'anterior') => c.por_posicao.reduce((a, p) => a + p[k][lado], 0);
    expect(soma('interacoes', 'atual')).toBe(m.interacoes!.atual);
    expect(soma('contratacoes', 'anterior')).toBe(m.contratacoes!.anterior);
    expect(soma('novos_clientes', 'atual')).toBe(m.novos_clientes!.atual);
  });

  it('a série alinhada cobre o período e fecha com os totais', () => {
    const { db } = cenario('demo');
    const c = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido);
    expect(c.serie).toHaveLength(10);
    expect(c.serie[0]!.inicio_atual).toBe('2026-09-01');
    const total = (lado: 'atual' | 'anterior') => c.serie.reduce((a, s) => a + s.interacoes[lado], 0);
    expect(total('atual')).toBe(c.metricas.find((x) => x.chave === 'interacoes')!.atual);
    expect(total('anterior')).toBe(c.metricas.find((x) => x.chave === 'interacoes')!.anterior);
    const curto = insights.comparativo(db, ctx('GER-100', '2026-10-01'), { inicio: '2026-09-25', fim: '2026-09-30' });
    expect(curto.serie).toHaveLength(6);
  });

  it('classifica a leitura: melhora, piora, estável e neutra', () => {
    const { db } = cenario('demo');
    const c = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido);
    expect(c.metricas.find((x) => x.chave === 'movimentacoes')!.leitura).toBe('neutra');
    const leituras = new Set(c.metricas.map((x) => x.leitura));
    for (const l of leituras) expect(['melhora', 'piora', 'estavel', 'neutra']).toContain(l);
    // zera o período anterior: variação sem base vira melhora (e percentual nulo), nunca divisão por zero
    db.fct_interacoes_crm = db.fct_interacoes_crm.filter((i) => i.data >= '2026-09-01');
    const sem = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido).metricas.find((x) => x.chave === 'interacoes')!;
    expect(sem.anterior).toBe(0);
    expect(sem.variacao_pct).toBeNull();
    expect(sem.leitura).toBe('melhora');
    db.fct_interacoes_crm = [];
    const nada = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido).metricas.find((x) => x.chave === 'interacoes')!;
    expect(nada).toMatchObject({ atual: 0, anterior: 0, leitura: 'estavel' });
  });

  it('gerente comum só compara a própria carteira', () => {
    const { db } = cenario('demo');
    const c = insights.comparativo(db, ctx('GER-102', '2026-10-01'), pedido);
    expect(c.escopo).toBe('Carteira');
    expect(c.por_posicao.map((p) => p.id_posicao)).toEqual(['POS-AG01-002']);
    const geral = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido);
    expect(c.metricas.find((x) => x.chave === 'interacoes')!.atual).toBeLessThan(geral.metricas.find((x) => x.chave === 'interacoes')!.atual);
  });

  it('valida o período', () => {
    const { db } = cenario('demo');
    const c = (p: { inicio: string; fim: string }) => () => insights.comparativo(db, ctx('GER-100', '2026-10-01'), p);
    esperaErro(c({ inicio: 'ontem', fim: '2026-09-30' }), 'DADOS_INVALIDOS');
    esperaErro(c({ inicio: '2026-09-30', fim: '2026-09-01' }), 'DADOS_INVALIDOS');
    esperaErro(c({ inicio: '2026-09-01', fim: '2026-10-05' }), 'DADOS_INVALIDOS');
    esperaErro(c({ inicio: '2025-01-01', fim: '2026-09-30' }), 'DADOS_INVALIDOS');
  });

  it('conta as movimentações entre posições no período', () => {
    const { db } = cenario('demo');
    const cli = db.dim_clientes.find((x) => x.status === 'Ativo' && x.id_posicao_carteira === 'POS-AG01-002')!;
    db.fct_movimentacao_carteira.push({ id_movimentacao: 'MOV-9', id_lote: 'LOT-9', id_cliente: cli.id_cliente, id_posicao_origem: 'POS-AG01-001', id_posicao_destino: 'POS-AG01-002', motivo: 'teste', ator: 'GER-100', instante: '2026-09-15T15:00:00.000Z', tipo: 'Redistribuicao' });
    const m = insights.comparativo(db, ctx('GER-100', '2026-10-01'), pedido).metricas.find((x) => x.chave === 'movimentacoes')!;
    expect(m.atual).toBe(1);
    expect(m.anterior).toBe(0);
  });
});
