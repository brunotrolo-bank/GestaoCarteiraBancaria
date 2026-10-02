import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Config enxuta para o Stryker: só os testes do núcleo (rápidos), sem cobertura.
// O alias força os testes a importar o CÓDIGO-FONTE da sandbox (onde o Stryker injeta os mutantes) e não o
// pacote do workspace em node_modules — sem isso, os mutantes nunca são carregados e o escore fica ~0%.
const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@carteira/core': src('./packages/core/src/index.ts'),
      '@carteira/data': src('./packages/data/src/index.ts'),
    },
  },
  test: { include: ['packages/core/test/**/*.test.ts'], environment: 'node', testTimeout: 60000 },
});
