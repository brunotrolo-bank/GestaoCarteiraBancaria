/**
 * Transporte do Apps Script: dentro do HtmlService, o front não tem rede para o backend — chama a função de servidor
 * `apiChamar` por `google.script.run`. Este adaptador expõe a mesma interface de `fetch`, então o SDK não muda.
 */
interface GoogleRun {
  withSuccessHandler(fn: (r: { status: number; headers: Record<string, string>; corpo?: unknown; corpoJson?: string | null }) => void): GoogleRun;
  withFailureHandler(fn: (e: { message?: string }) => void): GoogleRun;
  apiChamar(req: unknown): void;
}

const run = (): GoogleRun | undefined => (globalThis as { google?: { script?: { run?: GoogleRun } } }).google?.script?.run;

export function ambienteGas(): boolean {
  return run() !== undefined;
}

export function criarFetchGas(): typeof fetch {
  return ((entrada: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const url = new URL(String(entrada), 'http://gas.local');
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const consulta: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { if (!(k in consulta)) consulta[k] = v; });
      let corpo: unknown;
      let corpoInvalido = false;
      if (typeof init?.body === 'string' && init.body) {
        try { corpo = JSON.parse(init.body); } catch { corpoInvalido = true; }
      }
      const servidor = run();
      if (!servidor) { reject(new Error('google.script.run indisponível')); return; }
      servidor
        .withSuccessHandler((r) => resolve(new Response(r.status === 204 ? null : r.corpoJson ?? JSON.stringify(r.corpo), { status: r.status, headers: r.headers })))
        .withFailureHandler((e) => reject(new Error(e?.message ?? 'Falha ao chamar o servidor do Apps Script')))
        .apiChamar({ metodo: init?.method ?? 'GET', caminho: url.pathname, consulta, headers, corpo, corpoInvalido });
    })) as typeof fetch;
}
