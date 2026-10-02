import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../cn';

/* ------------------------------------------------------------------ Dialog (superfície branca, raio xl 16px, nível 2) */
export const Dialogo = DialogPrimitive.Root;
export const DialogoGatilho = DialogPrimitive.Trigger;
export const DialogoFechar = DialogPrimitive.Close;

const Sobreposicao = () => <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand-dark-900/40" />;

export const DialogoConteudo = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { titulo: string; descricao?: string }>(
  ({ className, children, titulo, descricao, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <Sobreposicao />
      <DialogPrimitive.Content
        ref={ref}
        aria-describedby={descricao ? undefined : undefined}
        className={cn('fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-nivel-2', className)}
        {...props}
      >
        <DialogPrimitive.Title className="text-heading-lg text-foreground">{titulo}</DialogPrimitive.Title>
        {descricao ? <DialogPrimitive.Description className="mt-1 text-body-md text-muted-foreground">{descricao}</DialogPrimitive.Description> : null}
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close aria-label="Fechar" className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-pill text-muted-foreground hover:bg-secondary">
          <X aria-hidden className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DialogoConteudo.displayName = 'DialogoConteudo';

/** Gaveta lateral (visão 360°, assistente de redistribuição): raio xl no lado interno, nível 2. */
export const Gaveta = DialogPrimitive.Root;
export const GavetaConteudo = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { titulo: string; descricao?: string }>(
  ({ className, children, titulo, descricao, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <Sobreposicao />
      <DialogPrimitive.Content
        ref={ref}
        className={cn('fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-y-auto rounded-l-xl border-l border-border bg-card p-6 shadow-nivel-2', className)}
        {...props}
      >
        <DialogPrimitive.Title className="pr-12 text-heading-lg text-foreground">{titulo}</DialogPrimitive.Title>
        {descricao ? <DialogPrimitive.Description className="mt-1 text-body-md text-muted-foreground">{descricao}</DialogPrimitive.Description> : null}
        <div className="mt-4 flex-1">{children}</div>
        <DialogPrimitive.Close aria-label="Fechar" className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-pill text-muted-foreground hover:bg-secondary">
          <X aria-hidden className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
GavetaConteudo.displayName = 'GavetaConteudo';

/* ------------------------------------------------------------------ Select (campo: raio 6, borda hairline-input) */
export const Selecao = SelectPrimitive.Root;
export const SelecaoValor = SelectPrimitive.Value;

export const SelecaoGatilho = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn('flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-input bg-card px-3 py-2 text-left text-body-md text-foreground focus-visible:border-primary data-[placeholder]:text-muted-foreground', className)}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelecaoGatilho.displayName = 'SelecaoGatilho';

export const SelecaoConteudo = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      className={cn('z-[60] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-nivel-2', className)}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelecaoConteudo.displayName = 'SelecaoConteudo';

export const SelecaoItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn('relative flex min-h-10 cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-3 text-body-md outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50', className)}
    {...props}
  >
    <span className="absolute left-2 inline-flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden className="size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelecaoItem.displayName = 'SelecaoItem';

/* ------------------------------------------------------------------ Tabs (texto ink-mute; ativo ink com sublinhado primary — derivado, o DESIGN não define) */
export const Abas = TabsPrimitive.Root;
export const AbasLista = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('flex gap-6 border-b border-border', className)} {...props} />
));
AbasLista.displayName = 'AbasLista';
export const AbasGatilho = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn('-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 border-transparent px-1 text-button-md text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground', className)}
    {...props}
  />
));
AbasGatilho.displayName = 'AbasGatilho';
export const AbasConteudo = TabsPrimitive.Content;

/* ------------------------------------------------------------------ Tooltip (branco, raio md, nível 2) */
export const ProvedorDica = TooltipPrimitive.Provider;
export function Dica({ conteudo, children }: { conteudo: React.ReactNode; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={6} className="z-[70] max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-nivel-2">
          {conteudo}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ Campo de seleção pronto (rótulo + Select) */
export interface OpcaoSelecao { valor: string; rotulo: string }

export function CampoSelecao({ id, rotulo, valor, aoMudar, opcoes, placeholder = 'Selecione…', className }: {
  id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: OpcaoSelecao[]; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-caption text-muted-foreground">{rotulo}</label>
      <Selecao value={valor} onValueChange={aoMudar}>
        <SelecaoGatilho id={id} aria-label={rotulo}><SelecaoValor placeholder={placeholder} /></SelecaoGatilho>
        <SelecaoConteudo>
          {opcoes.map((o) => <SelecaoItem key={o.valor} value={o.valor}>{o.rotulo}</SelecaoItem>)}
        </SelecaoConteudo>
      </Selecao>
    </div>
  );
}
