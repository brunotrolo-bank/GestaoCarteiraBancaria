import type { Db } from './types.ts';
import { proximoId } from './db.ts';
import type { Clock } from '../shared/clock.ts';

/** Auditoria append-only (FR-DAD-007). Nunca recebe PII em claro (CPF/CNPJ): só ids e dados de negócio. */
export function auditar(
  db: Db,
  clock: Clock,
  ator: string,
  acao: string,
  entidade: string,
  idEntidade: string,
  detalhe: Record<string, unknown> = {},
): void {
  db.log_auditoria.push({
    id_log: proximoId('LOG', db.log_auditoria.map((l) => l.id_log), 6),
    instante: clock.agora().toISOString(),
    ator,
    acao,
    entidade,
    id_entidade: idEntidade,
    detalhe: JSON.stringify(detalhe),
  });
}

/** Evento de domínio publicado em outbox (D-09). */
export function publicar(db: Db, clock: Clock, tipo: string, payload: Record<string, unknown>): void {
  db.log_eventos.push({
    id_evento: proximoId('EVT', db.log_eventos.map((e) => e.id_evento), 6),
    instante: clock.agora().toISOString(),
    tipo,
    payload: JSON.stringify(payload),
  });
}
