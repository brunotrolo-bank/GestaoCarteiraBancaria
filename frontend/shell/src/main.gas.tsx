import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App, type Mfes } from './App';

/** Ponto de entrada no Apps Script: os micro-frontends já se registraram em `window.CARTEIRA_MFES` (um arquivo cada). */
const w = window as unknown as { CARTEIRA_MFES?: Partial<Mfes>; CARTEIRA_ERROS?: string[]; CARTEIRA_MOSTRAR?: (msg: string) => void };
const mfes = w.CARTEIRA_MFES ?? {};
const faltando = (['cockpit', 'posicoes', 'carteira', 'delegacao'] as const).filter((k) => !mfes[k]);
const raiz = document.getElementById('raiz')!;

/** Erro de renderização não deve deixar tela branca: mostra a causa. */
class Contencao extends React.Component<{ children: React.ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    w.CARTEIRA_MOSTRAR?.(`render: ${erro.message}\n${erro.stack ?? ''}\n${info.componentStack ?? ''}`);
  }
  render() {
    return this.state.erro ? <p style={{ fontFamily: 'sans-serif', padding: 24, color: '#7a0000' }}>Erro ao exibir a tela: {this.state.erro.message}</p> : this.props.children;
  }
}

if (faltando.length > 0) {
  const erros = w.CARTEIRA_ERROS ?? [];
  raiz.textContent = `Micro-frontends ausentes: ${faltando.join(', ')}${erros.length ? ` | erros de carga: ${erros.join(' ; ')}` : ''}`;
} else {
  createRoot(raiz).render(<Contencao><App mfes={mfes as Mfes} /></Contencao>);
}
