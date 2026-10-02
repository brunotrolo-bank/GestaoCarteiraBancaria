import * as React from 'react';
import { Search } from 'lucide-react';
import { Botao, Campo, Dialogo, DialogoConteudo, Esqueleto, EstadoVazio, Rotulo, moeda } from '@carteira/ui';
import type { Api, EventoMfe } from '@carteira/sdk';

/**
 * Busca global de clientes (shell): paleta Ctrl+K sobre `GET /carteira/clientes?q=`.
 * O servidor devolve SÓ o que o papel pode ver (`clientesVisiveis`), então nenhum resultado vaza acesso.
 */
interface Achado { id_cliente: string; nome_razao_social: string; cpf_cnpj_mascarado?: string; segmento_cliente?: string; volume_aum?: number; id_posicao?: string }

export function BuscaGlobal({ api, versao, emitir }: { api: Api; versao: number; emitir: (e: EventoMfe) => void }) {
  const [aberta, setAberta] = React.useState(false);
  const [termo, setTermo] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [itens, setItens] = React.useState<Achado[]>([]);
  const [total, setTotal] = React.useState(0);
  const [buscando, setBuscando] = React.useState(false);
  const [ativo, setAtivo] = React.useState(0);
  const entradaRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAberta((a) => !a); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  React.useEffect(() => {
    if (aberta) {
      setTermo('');
      setItens([]);
      setTotal(0);
      setAtivo(0);
      window.setTimeout(() => entradaRef.current?.focus(), 50);
    }
  }, [aberta]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(termo.trim()), 250);
    return () => window.clearTimeout(t);
  }, [termo]);

  React.useEffect(() => {
    let viva = true;
    if (debounced.length < 2) { setItens([]); setTotal(0); setBuscando(false); return; }
    setBuscando(true);
    api.clientes({ q: debounced, limit: 8 }).then(
      (r) => { if (viva) { setItens(r.itens as Achado[]); setTotal(r.total); setAtivo(0); setBuscando(false); } },
      () => { if (viva) { setItens([]); setTotal(0); setBuscando(false); } },
    );
    return () => { viva = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, versao]);

  const escolher = (id: string) => {
    setAberta(false);
    emitir({ tipo: 'cliente-selecionado', idCliente: id });
  };

  const aoTeclarLista = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, itens.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && itens[ativo]) { e.preventDefault(); escolher(itens[ativo]!.id_cliente); }
  };

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberta(true)} aria-keyshortcuts="Control+k Meta+k">
        <Search aria-hidden className="size-4" /> Buscar cliente…
        <kbd className="tnum text-caption text-muted-foreground" aria-hidden>Ctrl+K</kbd>
      </Botao>
      <Dialogo open={aberta} onOpenChange={setAberta}>
        <DialogoConteudo titulo="Buscar cliente" descricao="Busca em todas as carteiras que o seu papel pode ver.">
          <div onKeyDown={aoTeclarLista}>
            <Rotulo htmlFor="busca-global">Nome ou código (mínimo 2 letras)</Rotulo>
            <Campo
              id="busca-global"
              ref={entradaRef}
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Ex.: Ana Souza ou CLI-9001"
              autoComplete="off"
              role="combobox"
              aria-expanded={itens.length > 0}
              aria-controls="busca-resultados"
              aria-activedescendant={itens[ativo] ? `achado-${itens[ativo]!.id_cliente}` : undefined}
            />
          </div>
          <div className="mt-3" aria-live="polite">
            {buscando ? (
              <div className="flex flex-col gap-2" aria-busy="true"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
            ) : debounced.length >= 2 && itens.length === 0 ? (
              <EstadoVazio titulo="Nenhum cliente encontrado">Tente outro nome ou código. A busca respeita o seu acesso.</EstadoVazio>
            ) : (
              <ul id="busca-resultados" role="listbox" aria-label="Clientes encontrados" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {itens.map((c, i) => (
                  <li key={c.id_cliente} id={`achado-${c.id_cliente}`} role="option" aria-selected={i === ativo}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseEnter={() => setAtivo(i)}
                      onClick={() => escolher(c.id_cliente)}
                      className={i === ativo ? 'flex w-full items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-left' : 'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-secondary'}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-body-md text-foreground">{c.nome_razao_social}</span>
                        <span className="tnum block truncate text-caption text-muted-foreground">{c.id_cliente}{c.id_posicao ? ` · ${c.id_posicao}` : ''}{c.cpf_cnpj_mascarado ? ` · ${c.cpf_cnpj_mascarado}` : ''}</span>
                      </span>
                      <span className="tnum shrink-0 text-body-md text-foreground">{c.volume_aum !== undefined ? moeda(c.volume_aum) : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {total > itens.length ? <p className="tnum mt-2 text-caption text-muted-foreground">Mostrando {itens.length} de {total} — refine a busca.</p> : null}
          </div>
        </DialogoConteudo>
      </Dialogo>
    </>
  );
}
