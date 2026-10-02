/**
 * Teste de fumaça do adaptador Sheets (D-02): escreve pelo SheetsStore, relê da planilha e restaura o cenário demo.
 * Prova que as operações do domínio persistem na planilha e que o reset devolve o estado original.
 * Uso: npm run sheets:smoke
 */
import { FixedClock, meioDia, posicoes } from '@carteira/core';
import { hashDb, lerDb, SPREADSHEET_ID_PADRAO } from '@carteira/data';
import { SheetsStore } from '../apps/api/src/store.ts';

const id = process.env.SPREADSHEET_ID ?? SPREADSHEET_ID_PADRAO;
const store = await SheetsStore.conectar(id, new FixedClock(meioDia('2026-10-01')));
const hashInicial = hashDb(store.db);

posicoes.trocarTitular(store.db, store.clock, { id_posicao: 'POS-AG01-003', id_gerente: 'GER-106', data_inicio: '2026-10-05', tipo_vinculo: 'Titular Efetivo' }, { idGerente: 'GER-100' });
await store.persistir();

const relido = await lerDb(id);
const ocupacoes = relido.bridge_ocupacao_posicao.filter((o) => o.id_posicao === 'POS-AG01-003');
const persistiu = ocupacoes.length === 2 && ocupacoes.some((o) => o.id_gerente === 'GER-106' && o.data_fim === null) && relido.log_auditoria.some((l) => l.acao === 'TITULAR_ALTERADO');
console.log(`Persistência após trocarTitular: ${persistiu ? 'OK' : 'FALHOU'} (${ocupacoes.length} ocupações da POS-003; auditoria ${relido.log_auditoria.length}; eventos ${relido.log_eventos.length})`);

await store.reiniciar();
const restaurado = await lerDb(id);
const igual = hashDb(restaurado) === hashInicial;
console.log(`Reset do cenário demo: ${igual ? 'OK (hash idêntico ao inicial)' : 'FALHOU'}`);
if (!persistiu || !igual) process.exit(1);
