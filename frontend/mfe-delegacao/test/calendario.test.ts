import { describe, expect, it } from 'vitest';
import { aVencer, delegacoesNoDia, gradeDoMes } from '../src/calendario';
import type { Delegacao } from '@carteira/sdk';

const base: Delegacao = {
  id_delegacao: 'D', id_posicao_origem: 'POS-AG01-001', id_gerente_delegado: 'G1',
  data_inicio: '2026-11-01', data_fim: '2026-11-15', motivo: 'Férias', escopo: 'Total',
  status_aprovacao: 'Aprovada', situacao: 'Em Vigor',
};
const com = (p: Partial<Delegacao>): Delegacao => ({ ...base, ...p });

describe('calendário de delegações', () => {
  it('grade cobre o mês em semanas de domingo a sábado', () => {
    const semanas = gradeDoMes(2026, 11); // 01/11/2026 é domingo
    expect(semanas[0]![0]).toEqual({ data: '2026-11-01', foraDoMes: false });
    expect(semanas.flat().filter((d) => !d.foraDoMes)).toHaveLength(30);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
  });

  it('dias fora do mês vêm marcados (navegação contínua)', () => {
    const dias = gradeDoMes(2026, 10).flat(); // 01/10/2026 é quinta
    expect(dias[0]).toEqual({ data: '2026-09-27', foraDoMes: true });
    expect(dias.find((d) => d.data === '2026-10-01')).toEqual({ data: '2026-10-01', foraDoMes: false });
  });

  it('vigência inclui início e fim (limites inclusivos)', () => {
    expect(delegacoesNoDia([base], '2026-11-01')).toHaveLength(1);
    expect(delegacoesNoDia([base], '2026-11-15')).toHaveLength(1);
    expect(delegacoesNoDia([base], '2026-10-31')).toHaveLength(0);
    expect(delegacoesNoDia([base], '2026-11-16')).toHaveLength(0);
  });

  it('alerta: ativas vencendo em até 7 dias após a referência', () => {
    const itens = [
      com({ id_delegacao: 'A', data_fim: '2026-11-06' }), // +1 dia
      com({ id_delegacao: 'B', data_fim: '2026-11-12' }), // +7 dias (limite incluído)
      com({ id_delegacao: 'C', data_fim: '2026-11-13' }), // +8 dias (fora)
      com({ id_delegacao: 'D', data_fim: '2026-11-05' }), // termina hoje (não alerta)
      com({ id_delegacao: 'E', data_fim: '2026-11-06', situacao: 'Concluída' }),
      com({ id_delegacao: 'F', data_fim: '2026-11-06', situacao: 'Agendada' }),
    ];
    expect(aVencer(itens, '2026-11-05').map((d) => d.id_delegacao)).toEqual(['A', 'F', 'B']);
  });

  it('alerta respeita a data simulada (J2: 05/11 vê a cobertura de 01–15/11 vencendo)', () => {
    expect(aVencer([com({ data_fim: '2026-11-15' })], '2026-11-05')).toHaveLength(0); // a 10 dias, sem alerta
    expect(aVencer([com({ data_fim: '2026-11-15' })], '2026-11-10').map((d) => d.id_delegacao)).toEqual(['D']);
  });
});
