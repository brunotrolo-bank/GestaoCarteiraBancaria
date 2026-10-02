import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxRuntime from 'react/jsx-runtime';
import * as UI from '@carteira/ui';
import * as SDK from '@carteira/sdk';

/**
 * Runtime compartilhado do front no Apps Script: React, design system e SDK carregados UMA vez e expostos em
 * `window.CARTEIRA_RUNTIME`; cada micro-frontend (arquivo próprio) os consome como dependências externas.
 */
(window as unknown as Record<string, unknown>).CARTEIRA_RUNTIME = { React, ReactDOM: { ...ReactDOM, ...ReactDOMClient }, JsxRuntime, UI, SDK };
