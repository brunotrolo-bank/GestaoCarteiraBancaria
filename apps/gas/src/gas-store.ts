import { NOMES_TABELAS, SystemClock, TABELAS, criarDbVazio, type Clock, type Db, type NomeTabela } from '@carteira/core';
import { matrizParaTabela, tabelaParaMatriz } from '@carteira/data/matriz';
import { criarSeed } from '@carteira/data/seed';

/** Serviços do Apps Script (globais em runtime; não existem em Node). */
declare const SpreadsheetApp: any;
declare const Utilities: any;
declare const CacheService: any;

const CHAVE_CACHE = 'carteira:db:v4';
const TAMANHO_BLOCO = 90_000; // limite do CacheService: 100 KB por chave
const TTL_SEGUNDOS = 900; // 15 min: edição manual da planilha aparece em até 15 min (ou use "Recarregar da planilha")
const SO_ANEXA: NomeTabela[] = ['log_auditoria', 'log_eventos', 'fct_movimentacao_carteira'];
/** Abas criadas depois da 1ª versão: planilhas antigas não as têm; ausentes = tabela vazia e a aba nasce na primeira gravação. */
const OPCIONAIS: NomeTabela[] = ['cfg_metas_posicao'];

/**
 * Adaptador de persistência do Apps Script (D-02), otimizado para latência:
 *  - LEITURA: o banco inteiro vive no CacheService (JSON comprimido em blocos); só vai à planilha no 1º acesso/expiração.
 *  - ESCRITA: só as tabelas alteradas; tabelas de log (append-only) recebem apenas as linhas novas.
 * Síncrono, como exige `google.script.run`. Colunas de texto recebem formato "@" (datas, instantes e CPF/CNPJ não
 * são convertidos pelo Sheets).
 */
export class GasStore {
  readonly nome = 'gas-sheets';
  db: Db;
  clock: Clock = new SystemClock();
  private assinaturas = new Map<NomeTabela, string>();
  private linhasAnexaveis = new Map<NomeTabela, string[]>();

  /** `semear`: cria/popula todas as abas com o cenário demo (instalação em uma conta nova). */
  constructor(private readonly planilhaId: string, opcoes: { semear?: boolean; ignorarCache?: boolean } = {}) {
    if (opcoes.semear) {
      this.db = criarSeed({ cenario: 'demo' });
      this.gravar(NOMES_TABELAS, true);
      this.salvarCache();
    } else {
      const doCache = opcoes.ignorarCache ? null : this.lerCache();
      if (doCache) {
        this.db = doCache;
      } else {
        try {
          this.db = this.lerPlanilha();
        } catch (e) {
          // Planilha vazia (criada à mão numa conta nova): popula com o cenário demo na primeira chamada.
          if (!String((e as Error).message).startsWith('ABAS_AUSENTES')) throw e;
          this.db = criarSeed({ cenario: 'demo' });
          this.gravar(NOMES_TABELAS, true);
        }
        this.salvarCache();
      }
    }
    this.marcar();
  }

  private assinatura(t: NomeTabela): string {
    return JSON.stringify((this.db[t] as unknown as Record<string, unknown>[]).map((l) => TABELAS[t].colunas.map(([c]) => l[c] ?? null)));
  }

  private assinaturasDeLinhas(t: NomeTabela): string[] {
    return (this.db[t] as unknown as Record<string, unknown>[]).map((l) => JSON.stringify(TABELAS[t].colunas.map(([c]) => l[c] ?? null)));
  }

  private marcar(): void {
    for (const t of NOMES_TABELAS) this.assinaturas.set(t, this.assinatura(t));
    for (const t of SO_ANEXA) this.linhasAnexaveis.set(t, this.assinaturasDeLinhas(t));
  }

  // ---------- cache ----------
  private lerCache(): Db | null {
    try {
      const cache = CacheService.getScriptCache();
      const n = Number(cache.get(`${CHAVE_CACHE}:n`));
      if (!n) return null;
      const chaves = Array.from({ length: n }, (_, i) => `${CHAVE_CACHE}:${i}`);
      const blocos = cache.getAll(chaves) as Record<string, string>;
      let b64 = '';
      for (const k of chaves) {
        if (blocos[k] === undefined) return null;
        b64 += blocos[k];
      }
      const bytes = Utilities.base64Decode(b64);
      const json = Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip')).getDataAsString();
      const db = JSON.parse(json) as Db;
      for (const t of NOMES_TABELAS) if (!Array.isArray(db[t])) (db[t] as unknown[]) = []; // cache de versão anterior sem tabelas novas
      return db;
    } catch {
      return null;
    }
  }

  private salvarCache(): void {
    try {
      const cache = CacheService.getScriptCache();
      const gz = Utilities.gzip(Utilities.newBlob(JSON.stringify(this.db), 'application/octet-stream', 'db.json'));
      const b64: string = Utilities.base64Encode(gz.getBytes());
      const itens: Record<string, string> = {};
      const n = Math.ceil(b64.length / TAMANHO_BLOCO);
      for (let i = 0; i < n; i += 1) itens[`${CHAVE_CACHE}:${i}`] = b64.slice(i * TAMANHO_BLOCO, (i + 1) * TAMANHO_BLOCO);
      itens[`${CHAVE_CACHE}:n`] = String(n);
      cache.putAll(itens, TTL_SEGUNDOS);
    } catch {
      /* sem cache o app continua correto, só mais lento */
    }
  }

  /** Descarta o cache e relê a planilha (após edição manual das abas). */
  recarregar(): void {
    try {
      const cache = CacheService.getScriptCache();
      const n = Number(cache.get(`${CHAVE_CACHE}:n`)) || 0;
      cache.removeAll([`${CHAVE_CACHE}:n`, ...Array.from({ length: n }, (_, i) => `${CHAVE_CACHE}:${i}`)]);
    } catch {
      /* ignora */
    }
    this.db = this.lerPlanilha();
    this.salvarCache();
    this.marcar();
  }

  // ---------- planilha ----------
  private lerPlanilha(): Db {
    const ss = SpreadsheetApp.openById(this.planilhaId);
    const db = criarDbVazio();
    for (const t of NOMES_TABELAS) {
      const aba = ss.getSheetByName(t);
      if (!aba) {
        if (OPCIONAIS.includes(t)) continue;
        throw new Error(`ABAS_AUSENTES: ${t}`);
      }
      const valores = (aba.getDataRange().getValues() as unknown[][]).map((linha) =>
        linha.map((v) => (v instanceof Date ? Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd') : v)),
      );
      (db[t] as unknown[]) = matrizParaTabela(t, valores);
    }
    return db;
  }

  private formatarTexto(aba: any, t: NomeTabela, primeiraLinha: number, linhas: number): void {
    if (linhas <= 0) return;
    TABELAS[t].colunas.forEach(([, tipo], j) => {
      if (tipo === 'string') aba.getRange(primeiraLinha, j + 1, linhas, 1).setNumberFormat('@');
    });
  }

  private gravar(tabelas: NomeTabela[], criarAbas = false): void {
    const ss = SpreadsheetApp.openById(this.planilhaId);
    for (const t of tabelas) {
      let aba = ss.getSheetByName(t);
      if (!aba) {
        if (!criarAbas && !SO_ANEXA.includes(t) && !OPCIONAIS.includes(t)) throw new Error(`Aba ausente: ${t}`);
        aba = ss.insertSheet(t);
      }
      const matriz = tabelaParaMatriz(this.db, t);
      const linhas = matriz.length;
      const colunas = matriz[0]!.length;

      // tabelas de log: se só cresceram, anexa apenas as linhas novas
      const antes = this.linhasAnexaveis.get(t);
      if (antes && !criarAbas) {
        const agora = this.assinaturasDeLinhas(t);
        const prefixoIgual = agora.length >= antes.length && antes.every((s, i) => s === agora[i]);
        if (prefixoIgual) {
          const novas = matriz.slice(antes.length + 1);
          if (novas.length === 0) continue;
          const inicio = antes.length + 2;
          if (aba.getMaxRows() < inicio + novas.length - 1) aba.insertRowsAfter(aba.getMaxRows(), inicio + novas.length - 1 - aba.getMaxRows());
          this.formatarTexto(aba, t, inicio, novas.length);
          aba.getRange(inicio, 1, novas.length, colunas).setValues(novas);
          continue;
        }
      }

      if (aba.getMaxRows() < linhas) aba.insertRowsAfter(aba.getMaxRows(), linhas - aba.getMaxRows());
      if (aba.getMaxColumns() < colunas) aba.insertColumnsAfter(aba.getMaxColumns(), colunas - aba.getMaxColumns());
      aba.clearContents();
      this.formatarTexto(aba, t, 2, linhas - 1);
      aba.getRange(1, 1, linhas, colunas).setValues(matriz);
      aba.getRange(1, 1, 1, colunas).setFontWeight('bold');
      aba.setFrozenRows(1);
    }
  }

  persistir(): void {
    const alteradas = NOMES_TABELAS.filter((t) => this.assinatura(t) !== this.assinaturas.get(t));
    if (alteradas.length === 0) return;
    this.gravar(alteradas);
    this.salvarCache();
    this.marcar();
  }

  /** Reset da demonstração: regrava o cenário demo na planilha. */
  reiniciar(): void {
    this.db = criarSeed({ cenario: 'demo' });
    this.gravar(NOMES_TABELAS, true);
    this.salvarCache();
    this.marcar();
  }
}
