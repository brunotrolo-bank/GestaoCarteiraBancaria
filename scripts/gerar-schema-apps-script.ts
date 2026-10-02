/** Gera apps-script/schema.js a partir de TABELAS (fonte única do esquema). Teste garante que o arquivo está em dia. */
import { writeFileSync } from 'node:fs';
import { TABELAS } from '@carteira/core';

export function conteudoSchema(): string {
  const esquema = Object.fromEntries(Object.entries(TABELAS).map(([t, d]) => [t, { pk: d.pk, colunas: d.colunas.map(([n, tipo]) => ({ nome: n, tipo })) }]));
  return `/* GERADO por scripts/gerar-schema-apps-script.ts — não editar à mão (npm run schema:apps-script). */\nvar ESQUEMA = ${JSON.stringify(esquema, null, 2)};\n`;
}

if (process.argv[1]?.endsWith('gerar-schema-apps-script.ts')) {
  writeFileSync(new URL('../apps-script/schema.js', import.meta.url), conteudoSchema(), 'utf8');
  console.log('apps-script/schema.js atualizado');
}
