import { describe, expect, it } from 'vitest';
import { apenasDigitos, documentoValido, ehDocumentoSintetico, NOMES_TABELAS, TABELAS } from '@carteira/core';
import { criarSeed, hashDb, verificarIntegridade, tabelaParaMatriz, matrizParaTabela } from '../src/index.ts';

describe('06 Plataforma de Dados — dados sintéticos e qualidade', () => {
  it('AC-DAD-01: mesma semente ⇒ hash idêntico; semente diferente ⇒ dataset diferente', () => {
    expect(hashDb(criarSeed({ cenario: 'demo' }))).toBe(hashDb(criarSeed({ cenario: 'demo' })));
    expect(hashDb(criarSeed({ cenario: 'demo', semente: 1 }))).not.toBe(hashDb(criarSeed({ cenario: 'demo', semente: 2 })));
  });

  it('AC-DAD-02: o dataset não tem nenhuma violação de integridade, domínio ou regra', () => {
    for (const cenario of ['demo', 'base', 'minimo'] as const) {
      expect(verificarIntegridade(criarSeed({ cenario }))).toEqual([]);
    }
  });

  it('AC-DAD-03: cenário J2 tem a delegação aprovada POS-001 → gerente da POS-002 (01–15/11)', () => {
    const db = criarSeed({ cenario: 'demo' });
    expect(db.fct_delegacoes[0]).toMatchObject({ id_posicao_origem: 'POS-AG01-001', id_gerente_delegado: 'GER-102', data_inicio: '2026-11-01', data_fim: '2026-11-15', status_aprovacao: 'Aprovada' });
    expect(db.fct_delegacoes[1]!.status_aprovacao).toBe('Submetida');
  });

  it('AC-DAD-04: cenário J3 — POS-001 a 120% e POS-004 a 40% da capacidade', () => {
    const db = criarSeed({ cenario: 'demo' });
    const util = (p: string): number => db.dim_clientes.filter((c) => c.id_posicao_carteira === p && c.status === 'Ativo').length / db.dim_posicoes.find((x) => x.id_posicao === p)!.capacidade_max_contas;
    expect(util('POS-AG01-001')).toBeCloseTo(1.2, 10);
    expect(util('POS-AG01-004')).toBeCloseTo(0.4, 10);
    expect(db.dim_posicoes).toHaveLength(5);
    expect(db.dim_clientes.length).toBeGreaterThan(330);
  });

  it('AC-DAD-06: a verificação detecta ocupação sobreposta, gerente em duas posições e projeção divergente', () => {
    const db = criarSeed({ cenario: 'minimo' });
    db.bridge_ocupacao_posicao.push({ id_ocupacao: 'OCU-9998', id_posicao: 'POS-AG01-001', id_gerente: 'GER-106', data_inicio: '2026-01-01', data_fim: null, tipo_vinculo: 'Interino' });
    db.bridge_ocupacao_posicao.push({ id_ocupacao: 'OCU-9999', id_posicao: 'POS-AG01-002', id_gerente: 'GER-101', data_inicio: '2026-01-01', data_fim: null, tipo_vinculo: 'Interino' });
    db.dim_clientes[0]!.id_posicao_carteira = 'POS-AG01-003';
    const regras = new Set(verificarIntegridade(db).map((x) => x.regra));
    expect(regras).toContain('OCUPACAO_SOBREPOSTA');
    expect(regras).toContain('GERENTE_EM_DUAS_POSICOES');
    expect(regras).toContain('PROJECAO_DIVERGENTE');
  });

  it('detecta delegações aprovadas sobrepostas, FK órfã, documento inválido/duplicado e PK repetida', () => {
    const db = criarSeed({ cenario: 'demo' });
    db.fct_delegacoes.push({ ...db.fct_delegacoes[0]!, id_delegacao: 'DEL-0099', data_inicio: '2026-11-10', data_fim: '2026-11-20' });
    db.dim_clientes[1]!.cpf_cnpj = '12345678900';
    db.dim_clientes[2]!.cpf_cnpj = db.dim_clientes[3]!.cpf_cnpj;
    db.bridge_vinculo_carteira.push({ id_vinculo: 'VIN-X', id_cliente: 'CLI-FANTASMA', id_posicao: 'POS-AG01-001', inicio_em: '2026-01-01T00:00:00.000Z', fim_em: null });
    db.dim_gerentes.push({ ...db.dim_gerentes[0]! });
    const regras = new Set(verificarIntegridade(db).map((x) => x.regra));
    for (const r of ['DELEGACAO_SOBREPOSTA', 'DOCUMENTO_INVALIDO', 'DOCUMENTO_DUPLICADO', 'FK', 'PK_DUPLICADA']) expect(regras).toContain(r);
  });

  it('AC-DAD-07: todos os documentos são válidos e carregam o marcador sintético', () => {
    for (const c of criarSeed({ cenario: 'demo' }).dim_clientes) {
      expect(documentoValido(c.cpf_cnpj)).toBe(true);
      expect(ehDocumentoSintetico(c.cpf_cnpj)).toBe(true);
      expect(apenasDigitos(c.cpf_cnpj)).toBe(c.cpf_cnpj);
    }
  });

  it('nota adversarial só existe quando solicitada (fixture de segurança do MCP)', () => {
    expect(criarSeed({ cenario: 'minimo' }).fct_interacoes_crm.some((i) => /ignore as instruções/i.test(i.nota))).toBe(false);
    expect(criarSeed({ cenario: 'minimo', incluirNotaAdversarial: true }).fct_interacoes_crm.some((i) => /ignore as instruções/i.test(i.nota))).toBe(true);
  });

  it('serialização para planilha: ida e volta preserva cada tabela (RAW, CPF com zeros, nulos como vazio)', () => {
    const db = criarSeed({ cenario: 'demo' });
    for (const t of NOMES_TABELAS) {
      const matriz = tabelaParaMatriz(db, t);
      expect(matriz[0]).toEqual(TABELAS[t].colunas.map(([n]) => n));
      expect(matrizParaTabela(t, matriz)).toEqual(db[t]);
    }
    expect(() => matrizParaTabela('dim_posicoes', [['id_posicao'], ['X']])).toThrow(/coluna ausente/);
  });

  it('tabelas e nomes de coluna seguem o dicionário (snake_case, prefixos dim_/fct_/bridge_/ref_/log_)', () => {
    for (const t of NOMES_TABELAS) {
      expect(t).toMatch(/^(dim|fct|bridge|ref|log)_[a-z_]+$/);
      for (const [c] of TABELAS[t].colunas) expect(c).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
