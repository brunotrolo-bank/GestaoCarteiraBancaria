import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { analisar, verificarArquitetura } from '../lint-arquitetura.ts';

describe('lint de arquitetura (D-01: monolito modular com fronteiras reais)', () => {
  it('o repositório respeita todas as fronteiras', () => {
    expect(verificarArquitetura(fileURLToPath(new URL('../..', import.meta.url)))).toEqual([]);
  });

  const f = (arquivo: string, texto: string) => ({ arquivo, texto });

  it('detecta dependência proibida entre módulos do núcleo (ex.: posições → delegação)', () => {
    const v = analisar([f('packages/core/src/posicoes/index.ts', "import { x } from '../delegacao/index.ts';")]);
    expect(v.map((x) => x.regra)).toContain('FRONTEIRA_MODULO');
  });

  it('detecta acesso a internals de outro módulo (só pela API pública)', () => {
    const v = analisar([f('packages/core/src/acesso/index.ts', "import { x } from '../delegacao/privado.ts';")]);
    expect(v.map((x) => x.regra)).toContain('API_PUBLICA');
  });

  it('detecta relógio global, aleatoriedade e dependências de infraestrutura no núcleo', () => {
    const v = analisar([
      f('packages/core/src/clientes/index.ts', 'const a = new Date(); const b = Date.now(); const c = Math.random();'),
      f('packages/core/src/insights/index.ts', "import fs from 'node:fs'; import z from '@carteira/data';"),
    ]);
    const regras = v.map((x) => x.regra);
    expect(regras).toContain('RELOGIO_INJETAVEL');
    expect(regras).toContain('DETERMINISMO');
    expect(regras.filter((r) => r === 'NUCLEO_PURO')).toHaveLength(2);
  });

  it('permite new Date(arg) (conversão pura) e o relógio dentro de shared/clock.ts', () => {
    expect(analisar([f('packages/core/src/shared/clock.ts', 'return new Date();'), f('packages/core/src/delegacao/index.ts', 'new Date(d.revogada_em)')])).toEqual([]);
  });

  it('front só fala com a API pelo SDK; MFEs não se importam; backend não importa o front', () => {
    const v = analisar([
      f('frontend/mfe-carteira/src/index.tsx', "import { x } from '@carteira/core'; import y from '@carteira/mfe-cockpit';"),
      f('apps/api/src/app.ts', "import { Botao } from '@carteira/ui';"),
    ]);
    const regras = v.map((x) => x.regra);
    expect(regras).toContain('FRONT_SO_VIA_SDK');
    expect(regras).toContain('MFE_ISOLADO');
    expect(regras).toContain('BACKEND_SEM_FRONT');
  });
});
