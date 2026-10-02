/**
 * Fumaça do backend do Apps Script: executa apps-script/backend.js num sandbox SEM os recursos que o Apps Script não tem
 * (structuredClone, URL, URLSearchParams, Request/Response, TextEncoder, Intl) e com uma planilha simulada em memória.
 * Uso: npx tsx scripts/gas-smoke.ts
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { NOMES_TABELAS } from '@carteira/core';
import { criarSeed, tabelaParaMatriz } from '@carteira/data';

const abas = new Map<string, unknown[][]>();
const demo = criarSeed({ cenario: 'demo' });
for (const t of NOMES_TABELAS) abas.set(t, tabelaParaMatriz(demo, t));
let escritas = 0;

const aba = (nome: string) => ({
  getDataRange: () => ({ getValues: () => abas.get(nome)!.map((l) => [...l]) }),
  getMaxRows: () => 100000, getMaxColumns: () => 26, insertRowsAfter: () => undefined, insertColumnsAfter: () => undefined,
  clearContents: () => { abas.set(nome, []); },
  getRange: (_r: number, _c: number, linhas?: number, colunas?: number) => ({
    setNumberFormat: () => undefined, setFontWeight: () => undefined,
    setValues: (v: unknown[][]) => { if (linhas === v.length && colunas === v[0]!.length && _r === 1) { abas.set(nome, v); escritas += 1; } },
  }),
  setFrozenRows: () => undefined,
});
const contexto: Record<string, unknown> = {
  SPREADSHEET_ID: 'planilha-simulada',
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n: string) => (abas.has(n) ? aba(n) : null), insertSheet: (n: string) => { abas.set(n, []); return aba(n); } }) },
  Utilities: { formatDate: () => '1970-01-01' },
  console,
};
const ctx = vm.createContext(contexto);
// Remove do sandbox o que o Apps Script não oferece
vm.runInContext('delete globalThis.structuredClone; delete globalThis.URL; delete globalThis.URLSearchParams; delete globalThis.Request; delete globalThis.Response; delete globalThis.TextEncoder; delete globalThis.TextDecoder; delete globalThis.Intl; delete globalThis.fetch; delete globalThis.process;', ctx);
vm.runInContext(readFileSync(new URL('../apps-script/backend.js', import.meta.url), 'utf8'), ctx, { filename: 'backend.js' });
const apiChamar = vm.runInContext('CARTEIRA.apiChamar', ctx) as (r: unknown) => { status: number; corpo: any; headers: Record<string, string> };

const chamar = (metodo: string, caminho: string, extra: { papel?: string; data?: string; corpo?: unknown; consulta?: Record<string, string> } = {}) =>
  apiChamar({ metodo, caminho, consulta: extra.consulta ?? {}, headers: { ...(extra.papel ? { 'x-papel-simulado': extra.papel } : {}), ...(extra.data ? { 'x-data-simulada': extra.data } : {}) }, corpo: extra.corpo });

let falhas = 0;
const ok = (nome: string, cond: boolean, detalhe = ''): void => { console.log(`${cond ? 'OK  ' : 'FALHA'} ${nome} ${detalhe}`); if (!cond) falhas += 1; };

const atores = chamar('GET', '/api/v1/simulacao/atores');
ok('atores (rota pública)', atores.status === 200 && atores.corpo.atores.length === 6);
const torre = chamar('GET', '/api/v1/insights/agencia', { papel: 'GG' });
ok('Torre de Controle: 348 clientes ativos, 2 posições em alerta', torre.corpo.total_clientes === 348 && torre.corpo.posicoes_em_alerta === 2, JSON.stringify([torre.corpo.total_clientes, torre.corpo.posicoes_em_alerta]));
const coberta = chamar('GET', '/api/v1/carteira/minha', { papel: 'POS-AG01-002', data: '2026-11-05' });
ok('J2: delegado vê Minha Carteira + Delegada em 05/11', coberta.corpo.secoes.map((s: any) => s.tipo).join() === 'Propria,Delegada');
const fim = chamar('GET', '/api/v1/carteira/minha', { papel: 'POS-AG01-002', data: '2026-11-16' });
ok('J2: só a própria em 16/11', fim.corpo.secoes.length === 1);
const lista = chamar('GET', '/api/v1/carteira/clientes', { papel: 'POS-AG01-003', consulta: { limit: '5' } });
ok('isolamento + documento mascarado', lista.corpo.itens.every((c: any) => c.id_posicao === 'POS-AG01-003' && /\*/.test(c.cpf_cnpj_mascarado) && !('cpf_cnpj' in c)));
const antes = escritas;
const troca = chamar('POST', '/api/v1/posicoes/POS-AG01-003/titular', { papel: 'GG', corpo: { id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' } });
ok('J1: troca de titular grava na planilha', troca.status === 201 && escritas > antes, `status ${troca.status}; escritas ${escritas - antes}`);
const hist = chamar('GET', '/api/v1/posicoes/POS-AG01-003/historico', { papel: 'GG' });
ok('histórico persistiu entre execuções (relido da planilha)', hist.corpo.itens.length === 2);
const negado = chamar('GET', '/api/v1/clientes/CLI-0300/visao-360', { papel: 'POS-AG01-001' });
ok('acesso negado → 403 problem+json', negado.status === 403 && negado.corpo.codigo_dominio === 'ACESSO_NEGADO');
const reset = chamar('POST', '/api/v1/simulacao/reset');
ok('reiniciar cenário', reset.status === 200 && chamar('GET', '/api/v1/posicoes/POS-AG01-003/historico', { papel: 'GG' }).corpo.itens.length === 1);
console.log(falhas === 0 ? '\nBackend do Apps Script OK no sandbox restrito.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
