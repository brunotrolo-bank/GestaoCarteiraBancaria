import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Cockpit from '@carteira/mfe-cockpit';
import Posicoes from '@carteira/mfe-posicoes';
import Carteira from '@carteira/mfe-carteira';
import Delegacao from '@carteira/mfe-delegacao';
import { App } from './App';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App mfes={{ cockpit: Cockpit, posicoes: Posicoes, carteira: Carteira, delegacao: Delegacao }} />
  </StrictMode>,
);
