import { createRoot } from 'react-dom/client';
import { App, type Mfes } from './App';

/** Ponto de entrada no Apps Script: os micro-frontends já se registraram em `window.CARTEIRA_MFES` (um arquivo cada). */
const mfes = (window as unknown as { CARTEIRA_MFES?: Partial<Mfes> }).CARTEIRA_MFES ?? {};
const faltando = (['cockpit', 'posicoes', 'carteira', 'delegacao'] as const).filter((k) => !mfes[k]);
const raiz = document.getElementById('raiz')!;
if (faltando.length > 0) {
  const erros = (window as unknown as { CARTEIRA_ERROS?: string[] }).CARTEIRA_ERROS ?? [];
  raiz.textContent = `Micro-frontends ausentes: ${faltando.join(', ')}${erros.length ? ` | erros de carga: ${erros.join(' ; ')}` : ''}`;
} else {
  createRoot(raiz).render(<App mfes={mfes as Mfes} />);
}
