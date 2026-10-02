import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { acesso, TABELAS, NOMES_TABELAS, type Db, type EscopoDelegacao } from '@carteira/core';
import { criarSeed, verificarIntegridade } from '@carteira/data';
import { conteudoSchema } from '../../scripts/gerar-schema-apps-script.ts';

type Fn = (...args: any[]) => any;

/** Carrega o código REAL do Apps Script (schema.js + rules.js + Codigo.js) em um sandbox, sem serviços do Google. */
function carregarAppsScript(): Record<string, any> {
  const ctx = vm.createContext({ Logger: { log: () => undefined } });
  for (const arq of ['schema.js', 'rules.js', 'Codigo.js']) {
    vm.runInContext(readFileSync(new URL(`../${arq}`, import.meta.url), 'utf8'), ctx, { filename: arq });
  }
  return ctx as Record<string, any>;
}

/** Tabelas como o Apps Script as lê da planilha: células vazias viram '' (nunca null). */
function comoPlanilha(db: Db): Record<string, Record<string, unknown>[]> {
  return Object.fromEntries(
    NOMES_TABELAS.map((t) => [t, (db[t] as unknown as Record<string, unknown>[]).map((l) => Object.fromEntries(TABELAS[t].colunas.map(([c]) => [c, l[c] ?? ''])))]),
  );
}

const gas = carregarAppsScript();
const posicoesPermitidas = gas.posicoesPermitidas as Fn;
const em = (dia: string, hora = '12:00:00'): Date => new Date(`${dia}T${hora}-03:00`);
const chave = (p: { id_posicao: string; modo: string }): string => `${p.id_posicao}:${p.modo}`;

describe('Apps Script ≡ núcleo TypeScript (homologação da lógica)', () => {
  it('schema.js está em dia com o esquema do TypeScript', () => {
    expect(readFileSync(new URL('../schema.js', import.meta.url), 'utf8')).toBe(conteudoSchema());
  });

  it('posicoesPermitidas: mesmas posições e modos que o núcleo em todos os gerentes e datas-chave', () => {
    const db = criarSeed({ cenario: 'demo' });
    const t = comoPlanilha(db);
    const instantes = ['2026-10-01', '2026-10-31', '2026-11-01', '2026-11-05', '2026-11-15', '2026-11-16', '2026-12-15'].map((d) => em(d));
    for (const g of db.dim_gerentes) {
      for (const i of instantes) {
        const esperado = acesso.resolverAcessos(db, g.id_gerente, i).posicoes.map(chave).sort();
        const obtido = (posicoesPermitidas(t, g.id_gerente, i) as { id_posicao: string; modo: string }[]).map(chave).sort();
        expect(obtido, `${g.id_gerente} em ${i.toISOString()}`).toEqual(esperado);
      }
    }
  });

  it('propriedade: equivalência com delegações aleatórias, revogações e instantes arbitrários', () => {
    const arb = fc.record({
      origem: fc.integer({ min: 1, max: 5 }),
      delegado: fc.integer({ min: 100, max: 107 }),
      ini: fc.integer({ min: 0, max: 40 }),
      dur: fc.integer({ min: 0, max: 20 }),
      status: fc.constantFrom('Aprovada', 'Submetida', 'Rejeitada', 'Revogada'),
      escopo: fc.constantFrom<EscopoDelegacao>('Total', 'Apenas Consulta', 'Apenas Emergencial'),
      revogaEm: fc.option(fc.integer({ min: 0, max: 60 }), { nil: undefined }),
    });
    fc.assert(
      fc.property(fc.array(arb, { maxLength: 6 }), fc.integer({ min: -3, max: 65 }), fc.integer({ min: 0, max: 23 }), (dels, off, hora) => {
        const db = criarSeed({ cenario: 'minimo' });
        dels.forEach((x, n) => {
          db.fct_delegacoes.push({
            id_delegacao: `DEL-T${n}`,
            id_posicao_origem: `POS-AG01-00${x.origem}`,
            id_gerente_delegado: `GER-${x.delegado}`,
            data_inicio: new Date(Date.UTC(2026, 9, 1 + x.ini)).toISOString().slice(0, 10),
            data_fim: new Date(Date.UTC(2026, 9, 1 + x.ini + x.dur)).toISOString().slice(0, 10),
            motivo: 't',
            escopo: x.escopo,
            status_aprovacao: x.status as 'Aprovada',
            criada_por: 'GER-100',
            criada_em: '2026-09-01T00:00:00.000Z',
            decidida_por: null,
            decidida_em: null,
            revogada_em: x.status === 'Revogada' && x.revogaEm !== undefined ? new Date(Date.UTC(2026, 9, 1 + x.revogaEm, 12)).toISOString() : null,
          });
        });
        const t = comoPlanilha(db);
        const instante = new Date(Date.UTC(2026, 9, 1 + off, hora, 30));
        for (const g of db.dim_gerentes) {
          const esperado = acesso.resolverAcessos(db, g.id_gerente, instante).posicoes.map(chave).sort();
          const obtido = (posicoesPermitidas(t, g.id_gerente, instante) as { id_posicao: string; modo: string }[]).map(chave).sort();
          expect(obtido).toEqual(esperado);
        }
      }),
      { numRuns: 120 },
    );
  });

  it('clientesVisiveis: mesmo conjunto de clientes e CPF/CNPJ mascarado', () => {
    const db = criarSeed({ cenario: 'demo' });
    const t = comoPlanilha(db);
    const i = em('2026-11-05');
    for (const g of ['GER-100', 'GER-101', 'GER-102', 'GER-103']) {
      const obtido = gas.clientesVisiveis(t, g, i) as { id_cliente: string; cpf_cnpj_mascarado: string }[];
      const permitidas = acesso.posicoesPermitidas(db, g, i);
      const ids = db.dim_clientes.filter((c) => permitidas.includes(c.id_posicao_carteira)).map((c) => c.id_cliente).sort();
      expect(obtido.map((c) => c.id_cliente).sort()).toEqual(ids);
      expect(obtido.every((c) => /\*/.test(c.cpf_cnpj_mascarado))).toBe(true);
    }
  });

  it('resolverPapel: GG e posição (titular vigente; vaga ⇒ null)', () => {
    const t = comoPlanilha(criarSeed({ cenario: 'demo' }));
    const resolver = gas.resolverPapel as Fn;
    expect(resolver(t, 'GG', em('2026-10-01'))).toBe('GER-100');
    expect(resolver(t, 'POS-AG01-002', em('2026-10-01'))).toBe('GER-102');
    expect(resolver(t, 'POS-AG01-005', em('2026-02-15'))).toBe('GER-107');
    expect(resolver(t, 'POS-AG01-005', em('2026-08-15'))).toBe('GER-105');
    expect(resolver(t, 'POS-AG01-009', em('2026-08-15'))).toBeNull();
  });

  it('verificarIntegridade: mesmas violações que o TypeScript, com dados corrompidos', () => {
    const db = criarSeed({ cenario: 'demo' });
    db.bridge_ocupacao_posicao.push({ id_ocupacao: 'OCU-9998', id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2026-01-01', data_fim: null, tipo_vinculo: 'Interino' });
    db.bridge_ocupacao_posicao.push({ id_ocupacao: 'OCU-9999', id_posicao: 'POS-AG01-002', id_gerente: 'GER-101', data_inicio: '2026-01-01', data_fim: null, tipo_vinculo: 'Interino' });
    db.fct_delegacoes.push({ ...db.fct_delegacoes[0]!, id_delegacao: 'DEL-0099', data_inicio: '2026-11-10', data_fim: '2026-11-20' });
    db.dim_clientes[1]!.cpf_cnpj = '12345678900';
    db.dim_clientes[2]!.cpf_cnpj = db.dim_clientes[3]!.cpf_cnpj;
    db.dim_clientes[4]!.id_posicao_carteira = 'POS-AG01-003';
    db.bridge_vinculo_carteira.push({ id_vinculo: 'VIN-X', id_cliente: 'CLI-FANTASMA', id_posicao: 'POS-AG01-001', inicio_em: '2026-01-01T00:00:00.000Z', fim_em: null });
    db.dim_gerentes.push({ ...db.dim_gerentes[0]! });
    const esperado = verificarIntegridade(db).map((v) => `${v.regra}|${v.tabela}|${v.chave}`).sort();
    const obtido = (gas.verificarIntegridade(comoPlanilha(db), gas.ESQUEMA) as { regra: string; tabela: string; chave: string }[]).map((v) => `${v.regra}|${v.tabela}|${v.chave}`).sort();
    expect(obtido).toEqual(esperado);
    expect(esperado.length).toBeGreaterThan(6);
  });

  it('homologação do dataset demo: nenhuma falha e cenários J2/J3 verificados', () => {
    const t = comoPlanilha(criarSeed({ cenario: 'demo' }));
    const r = gas.avaliarHomologacao(t, []) as { check: string; status: string; detalhe: string }[];
    expect(r.filter((x) => x.status === 'FALHA')).toEqual([]);
    const nomes = r.map((x) => x.check);
    for (const esperado of ['J2: delegado vê própria + delegada em 05/11', 'J2: acesso expira sozinho em 16/11 (00:00)', 'J3: POS-001 a 120% e POS-004 a 40% da capacidade', 'CPF/CNPJ sempre mascarado nas saídas']) {
      expect(nomes).toContain(esperado);
      expect(r.find((x) => x.check === esperado)!.status).toBe('OK');
    }
  });

  it('homologação detecta corrupção e marca J2/J3 como N/A quando o demo não está carregado', () => {
    const corrompido = criarSeed({ cenario: 'demo' });
    corrompido.dim_clientes[0]!.id_posicao_carteira = 'POS-AG01-002';
    const r = gas.avaliarHomologacao(comoPlanilha(corrompido), []) as { check: string; status: string }[];
    expect(r.find((x) => x.check === 'Integridade PROJECAO_DIVERGENTE')!.status).toBe('FALHA');
    const base = gas.avaliarHomologacao(comoPlanilha(criarSeed({ cenario: 'base' })), []) as { check: string; status: string }[];
    expect(base.filter((x) => x.status === 'FALHA')).toEqual([]);
    expect(base.find((x) => x.check === 'J2 cobertura de férias')!.status).toBe('N/A');
  });
});
