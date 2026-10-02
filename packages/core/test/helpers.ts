import { criarSeed, hashDb, type NomeCenario } from '@carteira/data';
import { FixedClock, meioDia, type Db, DomainError } from '@carteira/core';
import { expect } from 'vitest';

export const GG = { idGerente: 'GER-100' };
export const ger = (n: number): { idGerente: string } => ({ idGerente: `GER-${n}` });

export function cenario(nome: NomeCenario = 'minimo', dia = '2026-10-01'): { db: Db; clock: FixedClock } {
  return { db: criarSeed({ cenario: nome }), clock: new FixedClock(meioDia(dia)) };
}

/** Assinatura do estado de clientes e vínculos — prova que uma operação NÃO tocou a carteira (AC-POS-01 / AC-CLI-09). */
export function assinaturaCarteira(db: Db): string {
  return hashDb({ ...db, dim_posicoes: [], dim_gerentes: [], bridge_ocupacao_posicao: [], fct_delegacoes: [], log_auditoria: [], log_eventos: [] } as Db);
}

export function esperaErro(fn: () => unknown, codigo: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).codigo).toBe(codigo);
    expect((e as DomainError).message.length, 'a mensagem de erro deve explicar o problema').toBeGreaterThan(8);
    return;
  }
  throw new Error(`Esperava DomainError ${codigo}, mas não houve erro`);
}

export const em = (dia: string, hora = '12:00:00'): Date => new Date(`${dia}T${hora}-03:00`);

/** Em teste de mutação (Stryker) as propriedades rodam com menos amostras: cada mutante reexecuta a suíte. */
export const execucoes = (n: number): number => (process.env.__STRYKER_ACTIVE_MUTANT__ ? Math.min(n, 25) : n);

/** Captura o DomainError lançado (para inspecionar `detalhe`). */
export function capturaErro(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error('Esperava DomainError, mas não houve erro');
}

/** Última auditoria / evento da ação/tipo informado (prova o conteúdo registrado). */
export const ultimaAuditoria = (db: Db, acao: string) => db.log_auditoria.filter((l) => l.acao === acao).at(-1);
export const ultimoEvento = (db: Db, tipo: string) => db.log_eventos.filter((e) => e.tipo === tipo).at(-1);
