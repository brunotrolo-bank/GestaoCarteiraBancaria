/**
 * Carga idempotente do dataset sintético na planilha da POC (domínio 06, T-DAD-06/09).
 * Uso: npm run sheets:carga [-- --cenario=demo|base|minimo] [-- --semente=N]
 * Reexecutar reescreve as abas (clear + update) e valida por releitura: contagens, hash e integridade.
 */
import { NOMES_TABELAS } from '@carteira/core';
import { criarSeed, gravarDb, hashDb, lerDb, SPREADSHEET_ID_PADRAO, verificarIntegridade, type NomeCenario } from '@carteira/data';

const arg = (nome: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1];
const cenario = (arg('cenario') ?? 'demo') as NomeCenario;
const semente = arg('semente') ? Number(arg('semente')) : undefined;
const spreadsheetId = process.env.SPREADSHEET_ID ?? SPREADSHEET_ID_PADRAO;

const db = criarSeed({ cenario, semente });
const violacoes = verificarIntegridade(db);
if (violacoes.length > 0) {
  console.error('Dataset local inválido, carga abortada:', violacoes.slice(0, 5));
  process.exit(1);
}
console.log(`Carregando cenário "${cenario}" (hash ${hashDb(db)}) na planilha ${spreadsheetId}…`);
await gravarDb(spreadsheetId, db);
const lido = await lerDb(spreadsheetId);

let divergente = false;
for (const t of NOMES_TABELAS) {
  const ok = hashDb({ ...db, [t]: lido[t] }) === hashDb(db);
  if (!ok) divergente = true;
  console.log(`${ok ? 'OK ' : 'ERRO'} ${t.padEnd(28)} ${String(lido[t].length).padStart(5)} linhas`);
}
console.log(`Hash local ${hashDb(db)} · hash relido ${hashDb(lido)}`);
console.log(`Violações de integridade na planilha: ${verificarIntegridade(lido).length}`);
if (divergente || hashDb(lido) !== hashDb(db)) {
  console.error('A planilha relida difere do dataset gerado.');
  process.exit(1);
}
console.log('Carga concluída e validada por releitura.');
