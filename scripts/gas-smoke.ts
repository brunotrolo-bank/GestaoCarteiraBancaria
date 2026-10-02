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
const cacheMem = new Map<string, string>();
let locks = 0;
let leiturasPlanilha = 0;
const demo = criarSeed({ cenario: 'demo' });
for (const t of NOMES_TABELAS) abas.set(t, tabelaParaMatriz(demo, t));
let escritas = 0;

const aba = (nome: string) => ({
  getDataRange: () => ({ getValues: () => { leiturasPlanilha += 1; return abas.get(nome)!.map((l) => [...l]); } }),
  getMaxRows: () => 100000, getMaxColumns: () => 26, insertRowsAfter: () => undefined, insertColumnsAfter: () => undefined,
  clearContents: () => { abas.set(nome, []); },
  getRange: (_r: number, _c: number, linhas?: number, colunas?: number) => ({
    setNumberFormat: () => undefined, setFontWeight: () => undefined,
    setValues: (v: unknown[][]) => { if (linhas === v.length && colunas === v[0]!.length && _r === 1) { abas.set(nome, v); escritas += 1; } },
  }),
  setFrozenRows: () => undefined,
});
const contexto: Record<string, unknown> = {
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n: string) => (abas.has(n) ? aba(n) : null), insertSheet: (n: string) => { abas.set(n, []); return aba(n); } }) },
  Utilities: {
    formatDate: () => '1970-01-01',
    gzip: (b: { s: string }) => ({ getBytes: () => Buffer.from(Buffer.from(b.s).toString('base64')) }),
    newBlob: (x: unknown) => (typeof x === 'string' ? { s: x } : { bytes: x, getDataAsString: () => Buffer.from(Buffer.from(x as Buffer).toString(), 'base64').toString() }),
    base64Encode: (bytes: Buffer) => Buffer.from(bytes).toString(),
    base64Decode: (b64: string) => Buffer.from(b64),
    ungzip: (b: { getDataAsString(): string }) => b,
  },
  CacheService: {
    getScriptCache: () => ({
      get: (k: string) => cacheMem.get(k) ?? null,
      getAll: (ks: string[]) => Object.fromEntries(ks.filter((k) => cacheMem.has(k)).map((k) => [k, cacheMem.get(k)])),
      putAll: (o: Record<string, string>) => { for (const [k, v] of Object.entries(o)) { if (v.length > 100_000) throw new Error('bloco > 100KB'); cacheMem.set(k, v); } },
      removeAll: (ks: string[]) => ks.forEach((k) => cacheMem.delete(k)),
    }),
  },
  LockService: { getScriptLock: () => ({ waitLock: () => { locks += 1; }, releaseLock: () => { locks -= 1; } }) },
  planilhaId: () => 'planilha-simulada',
  console,
};
const ctx = vm.createContext(contexto);
// Remove do sandbox o que o Apps Script não oferece
vm.runInContext('delete globalThis.structuredClone; delete globalThis.URL; delete globalThis.URLSearchParams; delete globalThis.Request; delete globalThis.Response; delete globalThis.TextEncoder; delete globalThis.TextDecoder; delete globalThis.Intl; delete globalThis.fetch; delete globalThis.process;', ctx);
// Carrega os arquivos de backend na MESMA ordem do projeto (.clasp.json), como o Apps Script faz
const ordem = (JSON.parse(readFileSync(new URL('../apps-script/.clasp.json', import.meta.url), 'utf8')) as { filePushOrder: string[] }).filePushOrder;
const arquivosBackend = ordem.filter((n) => n.endsWith('.js') && !['schema.js', 'rules.js', 'Codigo.js'].includes(n));
for (const n of arquivosBackend) vm.runInContext(readFileSync(new URL(`../apps-script/${n}`, import.meta.url), 'utf8'), ctx, { filename: n });
console.log(`Backend carregado em ${arquivosBackend.length} arquivos: ${arquivosBackend.join(', ')}`);
const apiChamar = vm.runInContext('CARTEIRA.apiChamar', ctx) as (r: unknown) => { status: number; corpo: any; headers: Record<string, string> };

const chamar = (metodo: string, caminho: string, extra: { papel?: string; data?: string; corpo?: unknown; consulta?: Record<string, string> } = {}) =>
  apiChamar({ metodo, caminho, consulta: extra.consulta ?? {}, headers: { ...(extra.papel ? { 'x-papel-simulado': extra.papel } : {}), ...(extra.data ? { 'x-data-simulada': extra.data } : {}) }, corpo: extra.corpo });

let falhas = 0;
const ok = (nome: string, cond: boolean, detalhe = ''): void => { console.log(`${cond ? 'OK  ' : 'FALHA'} ${nome} ${detalhe}`); if (!cond) falhas += 1; };

const atores = chamar('GET', '/api/v1/simulacao/atores');
ok('atores (rota pública)', atores.status === 200 && atores.corpo.atores.length === 6);
const leituras1 = leiturasPlanilha;
ok('1ª chamada leu as 14 abas', leituras1 === 14, String(leituras1));
const torre = chamar('GET', '/api/v1/insights/agencia', { papel: 'GG' });
ok('Torre de Controle: 348 clientes ativos, 2 posições em alerta', torre.corpo.total_clientes === 348 && torre.corpo.posicoes_em_alerta === 2, JSON.stringify([torre.corpo.total_clientes, torre.corpo.posicoes_em_alerta]));
chamar('GET', '/api/v1/posicoes', { papel: 'GG' });
ok('chamadas seguintes NÃO releem a planilha (cache)', leiturasPlanilha === leituras1, String(leiturasPlanilha - leituras1));
const coberta = chamar('GET', '/api/v1/carteira/minha', { papel: 'POS-AG01-002', data: '2026-11-05' });
ok('J2: delegado vê Minha Carteira + Delegada em 05/11', coberta.corpo.secoes.map((s: any) => s.tipo).join() === 'Propria,Delegada');
const fim = chamar('GET', '/api/v1/carteira/minha', { papel: 'POS-AG01-002', data: '2026-11-16' });
ok('J2: só a própria em 16/11', fim.corpo.secoes.length === 1);
const lista = chamar('GET', '/api/v1/carteira/clientes', { papel: 'POS-AG01-003', consulta: { limit: '5' } });
ok('isolamento + documento mascarado', lista.corpo.itens.every((c: any) => c.id_posicao === 'POS-AG01-003' && /\*/.test(c.cpf_cnpj_mascarado) && !('cpf_cnpj' in c)));
const antes = escritas;
const leiturasAntesEscrita = leiturasPlanilha;
const troca = chamar('POST', '/api/v1/posicoes/POS-AG01-003/titular', { papel: 'GG', corpo: { id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' } });
ok('J1: troca de titular grava na planilha', troca.status === 201 && escritas > antes, `status ${troca.status}; escritas ${escritas - antes}`);
const hist = chamar('GET', '/api/v1/posicoes/POS-AG01-003/historico', { papel: 'GG' });
ok('histórico persistiu entre execuções (via cache atualizado, sem reler a planilha)', hist.corpo.itens.length === 2 && leiturasPlanilha === leiturasAntesEscrita);
const rec = chamar('POST', '/api/v1/simulacao/recarregar');
ok('recarregar da planilha relê as abas', rec.status === 200 && leiturasPlanilha > leiturasAntesEscrita);
ok('lock liberado após cada escrita', locks === 0);
const negado = chamar('GET', '/api/v1/clientes/CLI-0300/visao-360', { papel: 'POS-AG01-001' });
ok('acesso negado → 403 problem+json', negado.status === 403 && negado.corpo.codigo_dominio === 'ACESSO_NEGADO');
const reset = chamar('POST', '/api/v1/simulacao/reset');
ok('reiniciar cenário', reset.status === 200 && chamar('GET', '/api/v1/posicoes/POS-AG01-003/historico', { papel: 'GG' }).corpo.itens.length === 1);
// O retorno de google.script.run só aceita JSON puro: sem undefined, Date, NaN/Infinity ou funções (senão o front nunca recebe a resposta)
const invalido = (v: unknown, caminho = '$'): string | null => {
  if (v === undefined) return `${caminho} é undefined`;
  if (typeof v === 'function' || v instanceof Date) return `${caminho} não serializável`;
  if (typeof v === 'number' && !Number.isFinite(v)) return `${caminho} é ${v}`;
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { const r = invalido(x, `${caminho}.${k}`); if (r) return r; }
  return null;
};
for (const [caminho, papel] of [['/api/v1/simulacao/atores', 'GG'], ['/api/v1/insights/agencia', 'GG'], ['/api/v1/insights/analise', 'GG'], ['/api/v1/insights/analise', 'POS-AG01-002'], ['/api/v1/insights/desbalanceamento', 'GG'], ['/api/v1/posicoes', 'GG'], ['/api/v1/delegacoes', 'GG'], ['/api/v1/carteira/minha', 'POS-AG01-001'], ['/api/v1/carteira/clientes', 'GG']] as const) {
  const r = chamar('GET', caminho, { papel, consulta: caminho.endsWith('clientes') ? { limit: '50' } : {} });
  const problema = invalido(r);
  ok(`retorno serializável ${caminho}`, r.status === 200 && problema === null, `${r.status} ${problema ?? ''} ${(JSON.stringify(r).length / 1024).toFixed(0)} KB`);
}
console.log(falhas === 0 ? '\nBackend do Apps Script OK no sandbox restrito.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
