import * as React from 'react';
import { Gauge, Landmark, LayoutDashboard, Presentation, RotateCcw, Users, CalendarClock } from 'lucide-react';
import { Aviso, Botao, Campo, CampoSelecao, Esqueleto, ProvedorDica, Rotulo, cn, dataBR } from '@carteira/ui';
import { EVENTO_MFE, ambienteGas, criarApi, criarFetchGas, useConsulta, type EventoMfe, type PropsMfe, type Sessao, type ComandoMfe } from '@carteira/sdk';
import { Capa } from './paginas/Capa';

/** Micro-frontends injetados pelo ponto de entrada: build-time (Vite) ou runtime (Apps Script, via `window.CARTEIRA_MFES`). */
export type Mfe = React.ComponentType<PropsMfe>;
export interface Mfes { cockpit: Mfe; posicoes: Mfe; carteira: Mfe; delegacao: Mfe }

/**
 * Shell (domínio 08): navegação, seletor de papel simulado, data de demonstração e banner de modo simulação.
 * Compõe os micro-frontends por domínio, recebidos por injeção (`mfes`). A comunicação com os MFEs é só por props
 * (contrato PropsMfe) e eventos tipados — nunca por estado global ad hoc (FR-UX-004).
 * Vite: composição em build-time (main.tsx). Apps Script: cada MFE é um arquivo próprio que se registra em
 * `window.CARTEIRA_MFES` e o shell os compõe em runtime (main.gas.tsx).
 */

type Rota = 'capa' | 'cockpit' | 'posicoes' | 'carteira' | 'delegacoes';
const ROTAS: { id: Rota; rotulo: string; icone: React.ReactNode }[] = [
  { id: 'capa', rotulo: 'Apresentação', icone: <Presentation aria-hidden className="size-4" /> },
  { id: 'cockpit', rotulo: 'Torre de Controle', icone: <Gauge aria-hidden className="size-4" /> },
  { id: 'posicoes', rotulo: 'Posições', icone: <Landmark aria-hidden className="size-4" /> },
  { id: 'carteira', rotulo: 'Carteira', icone: <Users aria-hidden className="size-4" /> },
  { id: 'delegacoes', rotulo: 'Delegações', icone: <CalendarClock aria-hidden className="size-4" /> },
];

const rotaDoHash = (): Rota => {
  const h = window.location.hash.replace(/^#\/?/, '') as Rota;
  return ROTAS.some((r) => r.id === h) ? h : 'capa';
};

function lerSessao(): Sessao {
  try {
    const bruto = window.localStorage.getItem('carteira.sessao');
    if (bruto) return JSON.parse(bruto) as Sessao;
  } catch { /* armazenamento indisponível: usa o padrão */ }
  return { papel: 'GG', dataSimulada: null };
}

export function App({ mfes }: { mfes: Mfes }) {
  const { cockpit: Cockpit, posicoes: Posicoes, carteira: Carteira, delegacao: Delegacao } = mfes;
  const [rota, setRota] = React.useState<Rota>(rotaDoHash);
  const [sessao, setSessao] = React.useState<Sessao>(lerSessao);
  const [versao, setVersao] = React.useState(0);
  const [comando, setComando] = React.useState<ComandoMfe | undefined>();
  const sessaoRef = React.useRef(sessao);
  sessaoRef.current = sessao;

  const api = React.useMemo(() => criarApi({ baseUrl: '/api/v1', obterSessao: () => sessaoRef.current, fetchImpl: ambienteGas() ? criarFetchGas() : undefined }), []);
  const atores = useConsulta(() => api.atores(), [sessao.dataSimulada, versao]);

  React.useEffect(() => {
    const aoMudarHash = () => setRota(rotaDoHash());
    window.addEventListener('hashchange', aoMudarHash);
    return () => window.removeEventListener('hashchange', aoMudarHash);
  }, []);

  React.useEffect(() => {
    try { window.localStorage.setItem('carteira.sessao', JSON.stringify(sessao)); } catch { /* sem persistência */ }
  }, [sessao]);

  // Papel salvo que não existe mais (posição vaga/extinta) volta para o Gerente Geral.
  React.useEffect(() => {
    const lista = atores.dados?.atores;
    if (lista && !lista.some((a) => a.papel === sessao.papel && (a.papel === 'GG' || a.id_gerente))) setSessao((s) => ({ ...s, papel: 'GG' }));
  }, [atores.dados, sessao.papel]);

  const navegar = React.useCallback((destino: Rota) => { window.location.hash = `/${destino}`; setRota(destino); }, []);

  const emitir = React.useCallback((e: EventoMfe) => {
    window.dispatchEvent(new CustomEvent(EVENTO_MFE, { detail: e }));
    if (e.tipo === 'navegar') navegar(e.destino === 'cockpit' ? 'cockpit' : e.destino);
    else if (e.tipo === 'abrir-redistribuicao') { setComando({ tipo: 'abrir-redistribuicao', idPosicaoOrigem: e.idPosicaoOrigem, nonce: Date.now() }); navegar('carteira'); }
    else if (e.tipo === 'cliente-selecionado') { setComando({ tipo: 'abrir-cliente', idCliente: e.idCliente, nonce: Date.now() }); navegar('carteira'); }
    else if (e.tipo === 'dados-alterados') setVersao((v) => v + 1);
  }, [navegar]);

  const ehGerenteGeral = sessao.papel === 'GG';
  const props: PropsMfe = { api, sessao, ehGerenteGeral, versao, emitir, comando };

  async function reiniciar() {
    await api.reiniciarCenario();
    setVersao((v) => v + 1);
  }

  async function recarregar() {
    await api.recarregarDados();
    setVersao((v) => v + 1);
  }

  return (
    <ProvedorDica>
      <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto bg-sidebar p-3 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:flex-col md:gap-2 md:p-4">
          <div className="hidden items-center gap-2 px-2 pb-4 pt-2 md:flex">
            <LayoutDashboard aria-hidden className="size-5" />
            <span className="text-heading-sm">Carteira Bancária</span>
          </div>
          {ROTAS.map((r) => (
            <a
              key={r.id}
              href={`#/${r.id}`}
              // No Apps Script (iframe + <base target="_top">) o link nu navegaria a janela externa: navega só pelo hash, sem recarregar
              onClick={(e) => { e.preventDefault(); navegar(r.id); }}
              aria-current={rota === r.id ? 'page' : undefined}
              className={cn('flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 text-button-sm hover:bg-sidebar-active', rota === r.id ? 'bg-sidebar-active text-sidebar-foreground' : 'text-sidebar-muted')}
            >
              {r.icone}
              {r.rotulo}
            </a>
          ))}
          <p className="mt-auto hidden px-3 pb-2 text-micro text-sidebar-muted md:block">POC · dados sintéticos</p>
        </nav>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-end gap-4 border-b border-border bg-card px-6 py-3">
            <CampoSelecao
              id="visualizar-como"
              rotulo="Visualizar como"
              className="w-full max-w-sm sm:w-80"
              valor={sessao.papel}
              aoMudar={(papel) => setSessao((s) => ({ ...s, papel }))}
              opcoes={(atores.dados?.atores ?? [{ papel: 'GG', rotulo: 'Gerente Geral', id_gerente: null }]).filter((a) => a.papel === 'GG' || a.id_gerente).map((a) => ({ valor: a.papel, rotulo: a.rotulo }))}
            />
            <div>
              <Rotulo htmlFor="data-simulada">Data da demonstração</Rotulo>
              <Campo id="data-simulada" type="date" className="tnum w-44" value={sessao.dataSimulada ?? ''} onChange={(e) => setSessao((s) => ({ ...s, dataSimulada: e.target.value || null }))} />
            </div>
            {sessao.dataSimulada ? <Botao variante="fantasma" onClick={() => setSessao((s) => ({ ...s, dataSimulada: null }))}>Voltar para hoje</Botao> : null}
            <div className="ml-auto flex flex-wrap gap-2">
              {ambienteGas() ? <Botao variante="fantasma" onClick={() => void recarregar()}>Recarregar da planilha</Botao> : null}
              <Botao variante="secundario" onClick={() => void reiniciar()}><RotateCcw aria-hidden className="size-4" /> Reiniciar cenário</Botao>
            </div>
          </header>

          <div className="px-6 pt-4">
            <Aviso variante="atencao" titulo="Modo simulação">
              O papel e a data são simulados para a demonstração; não há autenticação real nesta POC.
              {sessao.dataSimulada ? <> Data simulada: <strong className="tnum font-normal text-foreground">{dataBR(sessao.dataSimulada)}</strong>.</> : null} Todos os dados são sintéticos.
            </Aviso>
          </div>

          <main className="mx-auto w-full max-w-[1440px] flex-1 p-6" id="conteudo">
            <React.Suspense fallback={<div aria-busy="true" className="flex flex-col gap-4"><Esqueleto className="h-10 w-72" /><Esqueleto className="h-96" /></div>}>
              {rota === 'capa' ? <Capa definirSessao={setSessao} navegar={navegar} /> : null}
              {rota === 'cockpit' ? <Cockpit {...props} /> : null}
              {rota === 'posicoes' ? <Posicoes {...props} /> : null}
              {rota === 'carteira' ? <Carteira {...props} /> : null}
              {rota === 'delegacoes' ? <Delegacao {...props} /> : null}
            </React.Suspense>
          </main>
        </div>
      </div>
    </ProvedorDica>
  );
}
