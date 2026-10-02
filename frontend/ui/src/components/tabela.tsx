import * as React from 'react';
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Search } from 'lucide-react';
import { cn } from '../cn';
import { Botao, Campo, EstadoVazio } from './basicos';

/* ------------------------------------------------------------------ Primitivas (DESIGN: hairline 1px, cromo xs 4px, números com tnum) */
export const Tabela = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
    <table className={cn('w-full border-collapse text-body-md', className)} {...props} />
  </div>
);
export const TabelaCabeca = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-secondary" {...props} />;
export const TabelaCorpo = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;
export const TabelaLinha = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-t border-border hover:bg-accent', className)} {...props} />
);
export const TabelaTitulo = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-3 text-left align-middle text-caption font-normal text-secondary-foreground', className)} {...props} />
);
/** Célula numérica: sempre `tnum` (FR-UX-017). */
export const TabelaCelula = ({ className, numerica, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numerica?: boolean }) => (
  <td className={cn('h-10 px-3 align-middle', numerica && 'tnum text-body-tabular text-right', className)} {...props} />
);

/* ------------------------------------------------------------------ DataTable (TanStack Table v8): ordenação, filtro, paginação, visibilidade de colunas */
export interface MetaColuna {
  numerica?: boolean;
  rotulo?: string;
}

interface Props<T> {
  colunas: ColumnDef<T, any>[];
  dados: T[];
  rotulo: string;
  tamanhoPagina?: number;
  buscaPlaceholder?: string;
  aoClicarLinha?: (linha: T) => void;
  vazio?: React.ReactNode;
  filtros?: React.ReactNode;
}

export function TabelaDados<T>({ colunas, dados, rotulo, tamanhoPagina = 25, buscaPlaceholder = 'Buscar…', aoClicarLinha, vazio, filtros }: Props<T>) {
  const [ordenacao, setOrdenacao] = React.useState<SortingState>([]);
  const [filtroGlobal, setFiltroGlobal] = React.useState('');
  const [visibilidade, setVisibilidade] = React.useState<VisibilityState>({});
  const [painelColunas, setPainelColunas] = React.useState(false);

  const tabela = useReactTable({
    data: dados,
    columns: colunas,
    state: { sorting: ordenacao, globalFilter: filtroGlobal, columnVisibility: visibilidade },
    onSortingChange: setOrdenacao,
    onGlobalFilterChange: setFiltroGlobal,
    onColumnVisibilityChange: setVisibilidade,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: tamanhoPagina } },
  });

  const linhas = tabela.getRowModel().rows;
  const total = tabela.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = tabela.getState().pagination;

  return (
    <section aria-label={rotulo} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Campo aria-label={`Buscar em ${rotulo}`} value={filtroGlobal} onChange={(e) => setFiltroGlobal(e.target.value)} placeholder={buscaPlaceholder} className="pl-9" />
        </div>
        {filtros}
        <div className="relative ml-auto">
          <Botao variante="secundario" tamanho="sm" aria-expanded={painelColunas} onClick={() => setPainelColunas((v) => !v)}>
            <Columns3 aria-hidden className="size-4" /> Colunas
          </Botao>
          {painelColunas ? (
            <div role="group" aria-label="Colunas visíveis" className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-border bg-popover p-2 shadow-nivel-2">
              {tabela.getAllLeafColumns().map((c) => (
                <label key={c.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-body-md hover:bg-accent">
                  <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="size-4 accent-primary" />
                  {(c.columnDef.meta as MetaColuna | undefined)?.rotulo ?? String(c.columnDef.header ?? c.id)}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {total === 0 ? (
        vazio ?? <EstadoVazio titulo="Nenhum registro encontrado">Ajuste os filtros ou a busca.</EstadoVazio>
      ) : (
        <Tabela aria-label={rotulo}>
          <TabelaCabeca>
            {tabela.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => {
                  const meta = h.column.columnDef.meta as MetaColuna | undefined;
                  const estado = h.column.getIsSorted();
                  return (
                    <TabelaTitulo key={h.id} className={cn(meta?.numerica && 'text-right')} aria-sort={estado === 'asc' ? 'ascending' : estado === 'desc' ? 'descending' : 'none'}>
                      {h.column.getCanSort() ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className={cn('inline-flex min-h-10 items-center gap-1 text-caption hover:text-foreground', meta?.numerica && 'flex-row-reverse')}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {estado === 'asc' ? <ArrowUp aria-hidden className="size-3" /> : estado === 'desc' ? <ArrowDown aria-hidden className="size-3" /> : <ArrowUpDown aria-hidden className="size-3 opacity-50" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TabelaTitulo>
                  );
                })}
              </tr>
            ))}
          </TabelaCabeca>
          <TabelaCorpo>
            {linhas.map((l) => (
              <TabelaLinha
                key={l.id}
                className={cn(aoClicarLinha && 'cursor-pointer')}
                tabIndex={aoClicarLinha ? 0 : undefined}
                onClick={aoClicarLinha ? () => aoClicarLinha(l.original) : undefined}
                onKeyDown={aoClicarLinha ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoClicarLinha(l.original); } } : undefined}
              >
                {l.getVisibleCells().map((c) => (
                  <TabelaCelula key={c.id} numerica={(c.column.columnDef.meta as MetaColuna | undefined)?.numerica}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </TabelaCelula>
                ))}
              </TabelaLinha>
            ))}
          </TabelaCorpo>
        </Tabela>
      )}

      <div className="flex items-center justify-between gap-3 text-caption text-secondary-foreground">
        <span className="tnum" aria-live="polite">
          {total === 0 ? '0 registros' : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, total)} de ${total.toLocaleString('pt-BR')}`}
        </span>
        <div className="flex items-center gap-2">
          <Botao variante="secundario" tamanho="sm" aria-label="Página anterior" disabled={!tabela.getCanPreviousPage()} onClick={() => tabela.previousPage()}><ChevronLeft aria-hidden className="size-4" /></Botao>
          <Botao variante="secundario" tamanho="sm" aria-label="Próxima página" disabled={!tabela.getCanNextPage()} onClick={() => tabela.nextPage()}><ChevronRight aria-hidden className="size-4" /></Botao>
        </div>
      </div>
    </section>
  );
}
