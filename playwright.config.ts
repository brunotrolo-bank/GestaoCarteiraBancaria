import { defineConfig } from '@playwright/test';

/**
 * E2E das jornadas J1/J2/J3 (domínio 08). Sobe a API (cenário demo em memória, porta 3101) e o front compilado
 * (preview na 4173, proxy /api → 3101). Capturas de tela ficam em docs/telas/.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npx tsx apps/api/src/server.ts',
      env: { PORT: '3101', STORE: 'memoria', SIMULACAO_PAPEL: 'true' },
      url: 'http://localhost:3101/api/v1/saude',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run build -w @carteira/shell && npm run preview -w @carteira/shell -- --port 4173 --strictPort',
      env: { API_URL: 'http://localhost:3101' },
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
