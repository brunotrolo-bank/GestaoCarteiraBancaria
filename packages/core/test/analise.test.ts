import { describe, expect, it } from 'vitest';
import { insights } from '@carteira/core';
import { cenario, em } from './helpers.ts';

const ctx = (idGerente: string, dia: string) => ({ idGerente, instante: em(dia) });
const soma = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe('05 Análises da carteira (Torre de Controle e Carteira)', () => {
  it('as faixas e a distribuição de produtos fecham com o total de clientes ativos', () => {
    const { db } = cenario('demo');
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    const r = insights.resumoAgencia(db, ctx('GER-100', '2026-10-01'));
    expect(soma(a.faixas_aum.map((f) => f.clientes))).toBe(r.total_clientes);
    expect(soma(a.faixas_score.map((f) => f.clientes))).toBe(r.total_clientes);
    expect(soma(a.produtos_por_cliente.map((f) => f.clientes))).toBe(r.total_clientes);
    expect(Math.round(soma(a.faixas_aum.map((f) => f.aum)) * 100) / 100).toBe(r.aum_total);
    expect(soma(a.por_segmento.map((s) => s.clientes))).toBe(r.total_clientes);
    expect(soma(a.mapa_posicao_segmento.flatMap((p) => p.celulas.map((c) => c.clientes)))).toBe(r.total_clientes);
  });

  it('a concentração é monotônica, começa em 0% e termina em 100% do AUM', () => {
    const { db } = cenario('demo');
    const { concentracao: c } = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(c.curva[0]).toEqual({ pct_clientes: 0, pct_aum: 0 });
    expect(c.curva.at(-1)).toEqual({ pct_clientes: 100, pct_aum: 100 });
    for (let i = 1; i < c.curva.length; i += 1) expect(c.curva[i]!.pct_aum).toBeGreaterThanOrEqual(c.curva[i - 1]!.pct_aum);
    expect(c.top10_pct).toBeGreaterThanOrEqual(c.maior_cliente_pct);
    expect(c.top20pct_clientes_pct).toBeGreaterThanOrEqual(c.top10_pct);
  });

  it('a série mensal cobre os 12 últimos meses completos (o mês corrente é parcial e fica de fora)', () => {
    const { db } = cenario('demo');
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(a.serie_mensal).toHaveLength(12);
    expect(a.serie_mensal[0]!.mes).toBe('2025-10');
    expect(a.serie_mensal.at(-1)!.mes).toBe('2026-09');
    const virada = insights.analiseCarteira(db, ctx('GER-100', '2026-01-15'));
    expect(virada.serie_mensal[0]!.mes).toBe('2025-01');
    expect(virada.serie_mensal.at(-1)!.mes).toBe('2025-12');
  });

  it('gera insights ordenados por severidade e o cenário demo aponta as posições em alerta', () => {
    const { db } = cenario('demo');
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    const ordem = { critico: 0, atencao: 1, info: 2, positivo: 3 } as const;
    const severidades = a.insights.map((i) => ordem[i.severidade]);
    expect(severidades).toEqual([...severidades].sort((x, y) => x - y));
    expect(a.insights.some((i) => i.titulo.includes('acima da capacidade') && i.destino === 'posicoes')).toBe(true);
    expect(a.insights.some((i) => i.titulo.includes('subutilizada'))).toBe(true);
  });

  it('gerente comum só analisa a própria carteira (escopo Carteira, sem outras posições)', () => {
    const { db } = cenario('demo');
    const a = insights.analiseCarteira(db, ctx('GER-102', '2026-10-01'));
    expect(a.escopo).toBe('Carteira');
    expect(a.mapa_posicao_segmento.map((p) => p.id_posicao)).toEqual(['POS-AG01-002']);
    const ids = new Set(db.dim_clientes.filter((c) => c.id_posicao_carteira === 'POS-AG01-002').map((c) => c.id_cliente));
    for (const c of [...a.top_clientes, ...a.oportunidades, ...a.engajamento.prioritarios]) expect(ids.has(c.id_cliente)).toBe(true);
  });

  it('um cliente sem nenhum contato registrado entra como prioritário com dias_sem_contato nulo', () => {
    const { db } = cenario('demo');
    const alvo = db.dim_clientes.find((c) => c.status === 'Ativo' && c.id_posicao_carteira === 'POS-AG01-002')!;
    alvo.volume_aum = 999_000_000;
    db.fct_interacoes_crm = db.fct_interacoes_crm.filter((i) => i.id_cliente !== alvo.id_cliente);
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(a.engajamento.prioritarios[0]).toMatchObject({ id_cliente: alvo.id_cliente, dias_sem_contato: null });
    expect(a.top_clientes[0]!.id_cliente).toBe(alvo.id_cliente);
    expect(a.insights.some((i) => i.titulo.includes('sem contato') && i.severidade === 'critico')).toBe(true);
    expect(a.insights.some((i) => i.titulo === 'Carteira concentrada')).toBe(true);
  });

  it('sem clientes ativos nenhuma métrica divide por zero', () => {
    const { db } = cenario('demo');
    for (const c of db.dim_clientes) c.status = 'Inativo';
    const a = insights.analiseCarteira(db, ctx('GER-100', '2026-10-01'));
    expect(a.concentracao.top10_pct).toBe(0);
    expect(a.engajamento.pct_sem_contato).toBe(0);
    expect(a.top_clientes).toEqual([]);
    expect(a.insights.some((i) => i.titulo === 'Carteira concentrada')).toBe(false);
  });

  it('cobertura vigente que termina em até 7 dias é sinalizada', () => {
    const { db } = cenario('demo');
    const d = db.fct_delegacoes.find((x) => x.status_aprovacao === 'Aprovada' && x.data_inicio <= '2026-11-05' && x.data_fim >= '2026-11-05')!;
    const a = insights.analiseCarteira(db, ctx('GER-100', d.data_fim));
    expect(a.delegacoes.vigentes).toBeGreaterThan(0);
    expect(a.delegacoes.expirando_7d).toBeGreaterThan(0);
    expect(a.insights.some((i) => i.destino === 'delegacoes')).toBe(true);
  });
});
