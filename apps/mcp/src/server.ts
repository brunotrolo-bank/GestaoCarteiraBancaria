import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SystemClock } from '@carteira/core';
import { SPREADSHEET_ID_PADRAO } from '@carteira/data';
import { MemoriaStore, SheetsStore, type Store } from '@carteira/api/store';
import { criarFerramentas, type FerramentaMcp, type OpcoesMcp } from './tools.ts';

/** Registra as ferramentas em um servidor MCP (usado pelo stdio e pelos testes com transporte em memória). */
export function criarServidorMcp(opcoes: OpcoesMcp): McpServer {
  const servidor = new McpServer({ name: 'carteira-bancaria-poc', version: '0.1.0' });
  for (const f of criarFerramentas(opcoes) as FerramentaMcp[]) {
    servidor.registerTool(
      f.nome,
      {
        title: f.titulo,
        description: f.descricao,
        inputSchema: f.entrada,
        annotations: { readOnlyHint: f.somenteLeitura, destructiveHint: false, idempotentHint: f.somenteLeitura, openWorldHint: false },
      },
      async (args: Record<string, unknown>) => {
        const r = await f.executar(args);
        const corpo = r.erro ? { erro: r.erro } : { aviso: r.aviso, dados: r.dados };
        return { isError: Boolean(r.erro), content: [{ type: 'text' as const, text: JSON.stringify(corpo) }] };
      },
    );
  }
  return servidor;
}

/**
 * Transporte stdio local (D-11): sem superfície de rede. Ambiente: STORE=memoria|sheets, MCP_PAPEL_PADRAO, SIMULACAO_PAPEL.
 * Logs só em stderr (stdout é o protocolo).
 */
if (process.argv[1]?.endsWith('server.ts')) {
  const store: Store = process.env.STORE === 'sheets'
    ? await SheetsStore.conectar(process.env.SPREADSHEET_ID ?? SPREADSHEET_ID_PADRAO, new SystemClock())
    : new MemoriaStore('demo');
  const servidor = criarServidorMcp({ store, simulacaoPapel: (process.env.SIMULACAO_PAPEL ?? 'true') === 'true', papelPadrao: process.env.MCP_PAPEL_PADRAO });
  await servidor.connect(new StdioServerTransport());
  console.error(JSON.stringify({ nivel: 'info', mensagem: 'Servidor MCP em stdio', store: store.nome }));
}
