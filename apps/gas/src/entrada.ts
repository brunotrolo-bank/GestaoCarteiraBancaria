import { criarManipulador, type RequisicaoApi, type RespostaApi } from '@carteira/api';
import { GasStore } from './gas-store.ts';

/** Definido em Codigo.js (global do Apps Script). */
declare const SPREADSHEET_ID: string;

/**
 * Ponto de entrada do backend no Apps Script: o MESMO manipulador da API REST (núcleo de domínio, regras de acesso,
 * delegação, redistribuição, insights) sobre a planilha. Chamado pelo front via `google.script.run.apiChamar`.
 * Cada chamada é uma execução independente: carrega as abas, executa a rota e grava as tabelas alteradas.
 */
export function apiChamar(req: RequisicaoApi): RespostaApi {
  const store = new GasStore(SPREADSHEET_ID);
  return criarManipulador({ store, simulacaoPapel: true })(req);
}
