import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { criarDbVazio, NOMES_TABELAS, type Db, type NomeTabela } from '@carteira/core';
import { matrizParaTabela, tabelaParaMatriz } from './matriz.ts';

export { matrizParaTabela, tabelaParaMatriz } from './matriz.ts';

/** Adaptador Google Sheets (D-02): lê/escreve as tabelas do modelo em abas de mesmo nome, via Sheets API. */

/**
 * Ambiente Google em uso (planilha, script, projeto GCP, service account). Vem de `config/ambiente.json` — gerado por
 * `npm run setup:conta` ao instalar em OUTRA conta Google — e pode ser sobrescrito por SPREADSHEET_ID / SERVICE_ACCOUNT.
 */
export interface Ambiente { planilhaId: string; scriptId: string; projetoGcp: string; contaServico: string }

export function lerAmbiente(): Ambiente {
  const caminho = new URL('../../../config/ambiente.json', import.meta.url);
  const base: Ambiente = existsSync(caminho)
    ? (JSON.parse(readFileSync(caminho, 'utf8')) as Ambiente)
    : { planilhaId: '', scriptId: '', projetoGcp: '', contaServico: '' };
  return {
    ...base,
    planilhaId: process.env.SPREADSHEET_ID ?? base.planilhaId,
    contaServico: process.env.SERVICE_ACCOUNT ?? base.contaServico,
  };
}

export const SERVICE_ACCOUNT = lerAmbiente().contaServico;
const ESCOPOS = 'https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive';

let cacheToken: { valor: string; expira: number } | null = null;

/** Token por impersonation da service account (sem chave em disco — D-14) ou `GOOGLE_ACCESS_TOKEN` (CI/teste). */
export function obterToken(): string {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN;
  if (cacheToken && cacheToken.expira > Date.now()) return cacheToken.valor;
  const saida = execFileSync(
    process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
    ['auth', 'print-access-token', `--impersonate-service-account=${SERVICE_ACCOUNT}`, `--scopes=${ESCOPOS}`],
    { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();
  cacheToken = { valor: saida, expira: Date.now() + 45 * 60_000 };
  return saida;
}

async function chamar<T>(spreadsheetId: string, caminho: string, init: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${obterToken()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!resposta.ok) throw new Error(`Sheets API ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  return (await resposta.json()) as T;
}


export async function lerDb(spreadsheetId: string): Promise<Db> {
  const faixas = NOMES_TABELAS.map((t) => `ranges=${encodeURIComponent(`${t}!A:Z`)}`).join('&');
  const r = await chamar<{ valueRanges: { values?: unknown[][] }[] }>(spreadsheetId, `/values:batchGet?${faixas}&valueRenderOption=UNFORMATTED_VALUE`);
  const db = criarDbVazio();
  NOMES_TABELAS.forEach((t, i) => {
    (db[t] as unknown[]) = matrizParaTabela(t, r.valueRanges[i]?.values ?? []);
  });
  return db;
}

async function garantirAbas(spreadsheetId: string, nomes: string[]): Promise<Map<string, number>> {
  const meta = await chamar<{ sheets: { properties: { sheetId: number; title: string } }[] }>(spreadsheetId, '?fields=sheets.properties(sheetId,title)');
  const existentes = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const faltantes = nomes.filter((n) => !existentes.has(n));
  if (faltantes.length > 0) {
    const r = await chamar<{ replies: { addSheet: { properties: { sheetId: number; title: string } } }[] }>(spreadsheetId, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: faltantes.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }),
    });
    for (const rep of r.replies) existentes.set(rep.addSheet.properties.title, rep.addSheet.properties.sheetId);
  }
  return existentes;
}

/** Grava as tabelas (clear + update, idempotente). Células em RAW: CPF/CNPJ e datas permanecem texto. */
export async function gravarDb(spreadsheetId: string, db: Db, tabelas: NomeTabela[] = NOMES_TABELAS): Promise<void> {
  const ids = await garantirAbas(spreadsheetId, tabelas);
  await chamar(spreadsheetId, '/values:batchClear', { method: 'POST', body: JSON.stringify({ ranges: tabelas.map((t) => `${t}!A:Z`) }) });
  await chamar(spreadsheetId, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: tabelas.map((t) => ({ range: `${t}!A1`, values: tabelaParaMatriz(db, t) })),
    }),
  });
  await chamar(spreadsheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: tabelas.flatMap((t) => [
        { repeatCell: { range: { sheetId: ids.get(t), startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
        { updateSheetProperties: { properties: { sheetId: ids.get(t), gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
      ]),
    }),
  });
}

/** Lê matrizes brutas (valores não formatados) de faixas A1. */
export async function lerMatrizes(spreadsheetId: string, faixas: string[]): Promise<unknown[][][]> {
  const q = faixas.map((f) => `ranges=${encodeURIComponent(f)}`).join('&');
  const r = await chamar<{ valueRanges: { values?: unknown[][] }[] }>(spreadsheetId, `/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE`);
  return r.valueRanges.map((v) => v.values ?? []);
}

/** Substitui o conteúdo de uma aba (cria se não existir) com a matriz informada, cabeçalho em negrito. */
export async function gravarMatriz(spreadsheetId: string, aba: string, matriz: (string | number)[][]): Promise<void> {
  const ids = await garantirAbas(spreadsheetId, [aba]);
  await chamar(spreadsheetId, '/values:batchClear', { method: 'POST', body: JSON.stringify({ ranges: [`${aba}!A:Z`] }) });
  await chamar(spreadsheetId, '/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: `${aba}!A1`, values: matriz }] }) });
  await chamar(spreadsheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ repeatCell: { range: { sheetId: ids.get(aba), startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }] }),
  });
}

export const SPREADSHEET_ID_PADRAO = lerAmbiente().planilhaId;
