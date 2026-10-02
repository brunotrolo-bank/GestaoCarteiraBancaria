import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { SystemClock } from '@carteira/core';
import { SPREADSHEET_ID_PADRAO } from '@carteira/data';
import { criarApp } from './app.ts';
import { MemoriaStore, SheetsStore, type Store } from './store.ts';

/**
 * Servidor local da POC. Variáveis de ambiente:
 *   PORT (3001) · STORE=memoria|sheets (memoria) · SPREADSHEET_ID · SIMULACAO_PAPEL=true|false (true; NUNCA em produção)
 */
const porta = Number(process.env.PORT ?? 3001);
const simulacaoPapel = (process.env.SIMULACAO_PAPEL ?? 'true') === 'true';

const store: Store = process.env.STORE === 'sheets'
  ? await SheetsStore.conectar(process.env.SPREADSHEET_ID ?? SPREADSHEET_ID_PADRAO, new SystemClock())
  : new MemoriaStore('demo');

const app = criarApp({ store, simulacaoPapel, log: (l) => console.log(JSON.stringify(l)) });

createServer(async (req, res) => {
  const corpo = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? undefined : (Readable.toWeb(req) as ReadableStream);
  const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers: req.headers as Record<string, string>, body: corpo, duplex: 'half' };
  const resposta = await app.fetch(new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, init));
  res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
  res.end(Buffer.from(await resposta.arrayBuffer()));
}).listen(porta, () => {
  console.log(JSON.stringify({ nivel: 'info', mensagem: `API em http://localhost:${porta}/api/v1`, store: store.nome, simulacaoPapel }));
});
