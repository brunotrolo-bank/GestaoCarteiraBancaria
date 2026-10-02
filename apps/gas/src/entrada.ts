import { criarManipulador, type RequisicaoApi, type RespostaApi } from '@carteira/api';
import { GasStore } from './gas-store.ts';

/** Definidas em Codigo.js (globais do Apps Script). */
declare function planilhaId(): string;
declare const LockService: any;

/**
 * Ponto de entrada do backend no Apps Script: o MESMO manipulador da API REST (núcleo de domínio, regras de acesso,
 * delegação, redistribuição, insights) sobre a planilha. Chamado pelo front via `google.script.run.apiChamar`.
 * Leituras vêm do cache; escritas (POST) são serializadas por um lock para não perder atualizações concorrentes.
 */
export function apiChamar(req: RequisicaoApi): RespostaApi {
  const escrita = req.metodo === 'POST';
  const lock = escrita ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(25_000);
  try {
    const store = new GasStore(planilhaId());
    return criarManipulador({ store, simulacaoPapel: true })(req);
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** Instala o cenário demo em uma planilha (cria as abas e popula). Usada por `instalar()` em contas novas. */
export function instalarEm(id: string): void {
  new GasStore(id, { semear: true });
}
