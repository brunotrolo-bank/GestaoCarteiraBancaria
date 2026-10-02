import { TABELAS, type Db, type NomeTabela } from '@carteira/core';

/** Conversão tabela ⇄ matriz (células), pura e sem I/O — usada pelo adaptador Sheets (Node) e pelo Apps Script. */

/** Colunas que representam "ausência de valor" (célula vazia ⇔ null). */
const NULAVEIS = new Set(['data_fim', 'fim_em', 'decidida_por', 'decidida_em', 'revogada_em']);

function celula(valor: unknown): string | number {
  if (valor === null || valor === undefined) return '';
  return typeof valor === 'number' ? valor : String(valor);
}

export function tabelaParaMatriz(db: Db, tabela: NomeTabela): (string | number)[][] {
  const colunas = TABELAS[tabela].colunas;
  const cabecalho = colunas.map(([nome]) => nome);
  const linhas = (db[tabela] as unknown as Record<string, unknown>[]).map((linha) => colunas.map(([nome]) => celula(linha[nome])));
  return [cabecalho, ...linhas];
}

export function matrizParaTabela(tabela: NomeTabela, matriz: unknown[][]): Record<string, unknown>[] {
  const colunas = TABELAS[tabela].colunas;
  const [cabecalho = [], ...linhas] = matriz;
  const indice = new Map(cabecalho.map((nome, i) => [String(nome), i]));
  for (const [nome] of colunas) {
    if (!indice.has(nome)) throw new Error(`Aba ${tabela}: coluna ausente "${nome}"`);
  }
  return linhas
    .filter((l) => l.some((c) => c !== '' && c !== undefined))
    .map((l) => {
      const obj: Record<string, unknown> = {};
      for (const [nome, tipo] of colunas) {
        const bruto = l[indice.get(nome)!];
        const vazio = bruto === undefined || bruto === '';
        if (tipo === 'number') obj[nome] = vazio ? 0 : Number(bruto);
        else obj[nome] = vazio ? (NULAVEIS.has(nome) ? null : '') : String(bruto);
      }
      return obj;
    });
}
