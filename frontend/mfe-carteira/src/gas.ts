import Mfe from './index';

/** Registro do micro-frontend no Apps Script: o shell o compõe em runtime a partir de `window.CARTEIRA_MFES`. */
const w = window as unknown as { CARTEIRA_MFES?: Record<string, unknown> };
w.CARTEIRA_MFES = { ...w.CARTEIRA_MFES, carteira: Mfe };
