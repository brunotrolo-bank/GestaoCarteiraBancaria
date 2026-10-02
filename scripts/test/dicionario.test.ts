import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOMES_TABELAS, TABELAS } from '@carteira/core';
import { conteudoDdl, conteudoDicionario } from '../gerar-dicionario.ts';
import { DICIONARIO } from '../dicionario.ts';

const raiz = (p: string): string => fileURLToPath(new URL(`../../${p}`, import.meta.url));

describe('06 Dicionário de dados e DDL-alvo', () => {
  it('AC-DAD-08: o dicionário cobre 100% das tabelas e colunas do esquema — e nada além dele', () => {
    for (const t of NOMES_TABELAS) {
      const esquema = TABELAS[t].colunas.map(([n]) => n).sort();
      expect(Object.keys(DICIONARIO[t].colunas).sort(), `colunas de ${t}`).toEqual(esquema);
    }
    expect(Object.keys(DICIONARIO).sort()).toEqual([...NOMES_TABELAS].sort());
  });

  it('o dicionário e o DDL versionados estão em dia com o esquema (regenerar e comparar)', () => {
    expect(readFileSync(raiz('planos/dominios/anexos/dicionario-de-dados.md'), 'utf8')).toBe(conteudoDicionario());
    expect(readFileSync(raiz('data/ddl/postgres.sql'), 'utf8')).toBe(conteudoDdl());
  });

  it('classifica LGPD: documento, nome e e-mail são Pessoal; AUM/renda/score são Financeiro sensível', () => {
    expect(DICIONARIO.dim_clientes.colunas.cpf_cnpj![2]).toBe('Pessoal');
    expect(DICIONARIO.dim_clientes.colunas.nome_razao_social![2]).toBe('Pessoal');
    expect(DICIONARIO.dim_gerentes.colunas.email_corporativo![2]).toBe('Pessoal');
    for (const c of ['volume_aum', 'faixa_renda_faturamento', 'score_risco']) expect(DICIONARIO.dim_clientes.colunas[c]![2]).toBe('Financeiro sensível');
  });

  it('o DDL é Postgres sintaticamente válido (parser do próprio Postgres) e traz as constraints que o Sheets não impõe', async () => {
    const ddl = conteudoDdl();
    const { parse, loadModule } = await import('libpg-query');
    await loadModule();
    const ast = (await parse(ddl)) as { stmts: unknown[] };
    expect(ast.stmts.length).toBeGreaterThan(30); // 14 CREATE TABLE + 14 COMMENT + extensão + índices
    expect(ddl.match(/CREATE TABLE/g)).toHaveLength(NOMES_TABELAS.length);
    expect(ddl).toContain('EXCLUDE USING gist (id_posicao WITH =');
    expect(ddl).toContain('EXCLUDE USING gist (id_gerente WITH =');
    expect(ddl).toContain('CREATE UNIQUE INDEX ux_vinculo_vigente');
    expect(ddl).toContain('UNIQUE (cpf_cnpj)');
    await expect(parse('CREATE TABLE (')).rejects.toBeTruthy(); // o parser realmente reprova SQL inválido
  });
});
