import { NOMES_TABELAS, SystemClock, TABELAS, criarDbVazio, type Clock, type Db, type NomeTabela } from '@carteira/core';
import { matrizParaTabela, tabelaParaMatriz } from '@carteira/data/matriz';
import { criarSeed } from '@carteira/data/seed';

/** Serviços do Apps Script (globais em runtime; não existem em Node). */
declare const SpreadsheetApp: any;
declare const Utilities: any;

/**
 * Adaptador de persistência do Apps Script (D-02): lê as 14 abas da planilha para o `Db` e grava de volta só as tabelas
 * que mudaram. Síncrono, como exige `google.script.run`. Colunas de texto recebem formato "@" para que datas, instantes
 * e CPF/CNPJ não sejam convertidos pelo Sheets.
 */
export class GasStore {
  readonly nome = 'gas-sheets';
  db: Db;
  clock: Clock = new SystemClock();
  private assinaturas = new Map<NomeTabela, string>();

  constructor(private readonly planilhaId: string) {
    this.db = this.ler();
    this.marcar();
  }

  private assinatura(t: NomeTabela): string {
    return JSON.stringify((this.db[t] as unknown as Record<string, unknown>[]).map((l) => TABELAS[t].colunas.map(([c]) => l[c] ?? null)));
  }

  private marcar(): void {
    for (const t of NOMES_TABELAS) this.assinaturas.set(t, this.assinatura(t));
  }

  private ler(): Db {
    const ss = SpreadsheetApp.openById(this.planilhaId);
    const db = criarDbVazio();
    for (const t of NOMES_TABELAS) {
      const aba = ss.getSheetByName(t);
      if (!aba) throw new Error(`Aba ausente na planilha: ${t}. Rode a carga do cenário demo.`);
      const valores = (aba.getDataRange().getValues() as unknown[][]).map((linha) =>
        linha.map((v) => (v instanceof Date ? Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd') : v)),
      );
      (db[t] as unknown[]) = matrizParaTabela(t, valores);
    }
    return db;
  }

  private gravar(tabelas: NomeTabela[]): void {
    const ss = SpreadsheetApp.openById(this.planilhaId);
    for (const t of tabelas) {
      const aba = ss.getSheetByName(t) ?? ss.insertSheet(t);
      const matriz = tabelaParaMatriz(this.db, t);
      const linhas = matriz.length;
      const colunas = matriz[0]!.length;
      if (aba.getMaxRows() < linhas) aba.insertRowsAfter(aba.getMaxRows(), linhas - aba.getMaxRows());
      if (aba.getMaxColumns() < colunas) aba.insertColumnsAfter(aba.getMaxColumns(), colunas - aba.getMaxColumns());
      aba.clearContents();
      if (linhas > 1) {
        TABELAS[t].colunas.forEach(([, tipo], j) => {
          if (tipo === 'string') aba.getRange(2, j + 1, linhas - 1, 1).setNumberFormat('@');
        });
      }
      aba.getRange(1, 1, linhas, colunas).setValues(matriz);
      aba.getRange(1, 1, 1, colunas).setFontWeight('bold');
      aba.setFrozenRows(1);
    }
  }

  persistir(): void {
    const alteradas = NOMES_TABELAS.filter((t) => this.assinatura(t) !== this.assinaturas.get(t));
    if (alteradas.length === 0) return;
    this.gravar(alteradas);
    for (const t of alteradas) this.assinaturas.set(t, this.assinatura(t));
  }

  /** Reset da demonstração: regrava o cenário demo na planilha. */
  reiniciar(): void {
    this.db = criarSeed({ cenario: 'demo' });
    this.gravar(NOMES_TABELAS);
    this.marcar();
  }
}
