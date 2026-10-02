/**
 * Homologa a planilha executando o CÓDIGO REAL do Apps Script (schema.js + rules.js + Codigo.js) sobre os dados vivos.
 *
 * Por quê em Node: a execução remota (`clasp run`) não está disponível neste projeto (ver 02-ambiente). Este executor
 * roda o mesmo código em sandbox, lê a planilha pela Sheets API e grava `homologacao_resultado` no mesmo formato de
 * `homologar()`. No editor do Apps Script, `homologar()` produz o mesmo resultado (aba sobrescrita).
 *
 * Uso: npm run sheets:homologar
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { NOMES_TABELAS, TABELAS } from '@carteira/core';
import { gravarMatriz, lerDb, lerMatrizes, SPREADSHEET_ID_PADRAO } from '@carteira/data';

const spreadsheetId = process.env.SPREADSHEET_ID ?? SPREADSHEET_ID_PADRAO;

const ctx = vm.createContext({ Logger: { log: () => undefined } }) as Record<string, any>;
for (const arq of ['schema.js', 'rules.js', 'Codigo.js']) {
  vm.runInContext(readFileSync(new URL(`../apps-script/${arq}`, import.meta.url), 'utf8'), ctx, { filename: arq });
}

const db = await lerDb(spreadsheetId);
// O Apps Script lê células vazias como '' (nunca null)
const tabelas = Object.fromEntries(
  NOMES_TABELAS.map((t) => [t, (db[t] as unknown as Record<string, unknown>[]).map((l) => Object.fromEntries(TABELAS[t].colunas.map(([c]) => [c, l[c] ?? ''])))]),
);

const cabecalhos = await lerMatrizes(spreadsheetId, NOMES_TABELAS.map((t) => `${t}!1:1`));
const esquema = NOMES_TABELAS.map((t, i) => {
  const cab = (cabecalhos[i]?.[0] ?? []).map(String);
  const esperado = TABELAS[t].colunas.map(([n]) => n);
  const ok = cab.length === esperado.length && esperado.every((n, k) => cab[k] === n);
  return { check: `Esquema ${t}`, status: ok ? 'OK' : 'FALHA', detalhe: ok ? `${esperado.length} colunas` : 'Cabeçalho difere do dicionário' };
});

const resultados = ctx.avaliarHomologacao(tabelas, esquema) as { check: string; status: string; detalhe: string }[];
const carimbo = new Date().toISOString();
await gravarMatriz(spreadsheetId, 'homologacao_resultado', [
  ['instante', 'check', 'status', 'detalhe', 'executor'],
  ...resultados.map((r) => [carimbo, r.check, r.status, r.detalhe, 'node (código do Apps Script em sandbox)']),
]);

const por = (s: string): number => resultados.filter((r) => r.status === s).length;
for (const r of resultados) console.log(`${r.status.padEnd(5)} ${r.check} — ${r.detalhe}`);
console.log(`\nTotal ${resultados.length} · OK ${por('OK')} · FALHA ${por('FALHA')} · N/A ${por('N/A')}`);
if (por('FALHA') > 0) process.exit(1);
