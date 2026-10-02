import { NOMES_TABELAS, SystemClock, TABELAS, type Clock, type Db, type NomeTabela } from '@carteira/core';
import { criarSeed, gravarDb, lerDb, SPREADSHEET_ID_PADRAO, type NomeCenario } from '@carteira/data';

/**
 * Porta de persistência (D-02): o domínio opera sobre `db` em memória; o adaptador decide como durar.
 * - `MemoriaStore`: POC/testes. - `SheetsStore`: grava no Google Sheets as tabelas que mudaram após cada operação.
 */
export interface Store {
  readonly nome: string;
  db: Db;
  clock: Clock;
  persistir(): Promise<void>;
  reiniciar(): Promise<void>;
}

export class MemoriaStore implements Store {
  readonly nome = 'memoria';
  db: Db;
  clock: Clock;
  constructor(private readonly cenario: NomeCenario = 'demo', clock: Clock = new SystemClock()) {
    this.db = criarSeed({ cenario });
    this.clock = clock;
  }
  async persistir(): Promise<void> {}
  async reiniciar(): Promise<void> {
    this.db = criarSeed({ cenario: this.cenario });
  }
}

function assinatura(db: Db, t: NomeTabela): string {
  return JSON.stringify((db[t] as unknown as Record<string, unknown>[]).map((l) => TABELAS[t].colunas.map(([c]) => l[c] ?? null)));
}

export class SheetsStore implements Store {
  readonly nome = 'sheets';
  private assinaturas = new Map<NomeTabela, string>();
  private fila: Promise<void> = Promise.resolve();
  constructor(public db: Db, public clock: Clock, private readonly spreadsheetId: string, private readonly cenarioReset: NomeCenario = 'demo') {
    this.marcar();
  }

  static async conectar(spreadsheetId = SPREADSHEET_ID_PADRAO, clock: Clock = new SystemClock()): Promise<SheetsStore> {
    return new SheetsStore(await lerDb(spreadsheetId), clock, spreadsheetId);
  }

  private marcar(): void {
    for (const t of NOMES_TABELAS) this.assinaturas.set(t, assinatura(this.db, t));
  }

  /** Grava só as tabelas alteradas, em série (evita escritas concorrentes sobre a mesma planilha). */
  persistir(): Promise<void> {
    this.fila = this.fila.then(async () => {
      const alteradas = NOMES_TABELAS.filter((t) => assinatura(this.db, t) !== this.assinaturas.get(t));
      if (alteradas.length === 0) return;
      await gravarDb(this.spreadsheetId, this.db, alteradas);
      for (const t of alteradas) this.assinaturas.set(t, assinatura(this.db, t));
    });
    return this.fila;
  }

  /** Reset da demonstração: regrava o cenário demo na planilha. */
  async reiniciar(): Promise<void> {
    this.db = criarSeed({ cenario: this.cenarioReset });
    await gravarDb(this.spreadsheetId, this.db);
    this.marcar();
  }
}
