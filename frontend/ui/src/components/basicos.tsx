import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Info, TriangleAlert } from 'lucide-react';
import { cn } from '../cn';

/* ------------------------------------------------------------------ Button (DESIGN: pill, padding 8px 16px, 16px/400) */
const botao = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-4 py-2 text-button-md transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variante: {
        /** Único botão preenchido por região (DESIGN: "one filled pill per band"). */
        primario: 'bg-primary text-on-primary hover:bg-primary-deep active:bg-primary-press',
        secundario: 'border border-primary bg-card text-primary hover:bg-secondary',
        escuro: 'bg-brand-dark-900 text-on-primary hover:bg-primary-press',
        fantasma: 'text-primary hover:bg-secondary',
      },
      tamanho: { md: '', sm: 'text-button-sm' },
    },
    defaultVariants: { variante: 'primario', tamanho: 'md' },
  },
);

export interface BotaoProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof botao> {
  asChild?: boolean;
}

export const Botao = React.forwardRef<HTMLButtonElement, BotaoProps>(({ className, variante, tamanho, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(botao({ variante, tamanho }), className)} {...props} />;
});
Botao.displayName = 'Botao';

/* ------------------------------------------------------------------ Input (DESIGN: raio 6px, borda hairline-input, foco = primary, altura ≥ 40px) */
export const Campo = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-10 w-full rounded-sm border border-input bg-card px-3 py-2 text-body-md text-foreground placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-50', className)}
    {...props}
  />
));
Campo.displayName = 'Campo';

export const Rotulo = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label className={cn('mb-1 block text-caption text-secondary-foreground', className)} {...props} />
);

export const AreaTexto = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('min-h-20 w-full rounded-sm border border-input bg-card px-3 py-2 text-body-md focus-visible:border-primary', className)} {...props} />
));
AreaTexto.displayName = 'AreaTexto';

/* ------------------------------------------------------------------ Card (DESIGN: raio 12px, hairline, padding 24px no dashboard, nível 1) */
export const Cartao = ({ className, destaque, ...props }: React.HTMLAttributes<HTMLDivElement> & { destaque?: boolean }) => (
  <div
    className={cn('rounded-lg border border-border p-6 shadow-nivel-1', destaque ? 'bg-brand-dark-900 text-on-primary' : 'bg-card text-card-foreground', className)}
    {...props}
  />
);
export const CartaoTitulo = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-heading-md text-inherit', className)} {...props} />
);
export const CartaoDescricao = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-caption text-muted-foreground', className)} {...props} />
);

/* ------------------------------------------------------------------ Badge / Tag (DESIGN: pill-tag-soft, micro-cap 10px) */
const selo = cva('inline-flex items-center gap-1 rounded-pill px-2 py-1 text-micro-cap', {
  variants: {
    variante: {
      /** `pill-tag-soft`: fundo primary-bg-subdued-hover; texto primary-press (correção de contraste — NC-DS-6). */
      tag: 'bg-primary-bg-subdued-hover text-primary-press',
      neutro: 'border border-border bg-secondary text-secondary-foreground',
      critico: 'border border-border bg-card text-foreground',
      atencao: 'border border-border bg-card text-foreground',
      informativo: 'border border-border bg-card text-foreground',
    },
  },
  defaultVariants: { variante: 'neutro' },
});

export function Selo({ className, variante, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof selo>) {
  // Estados semânticos nunca dependem só da cor: ícone + texto (NC-DS-4).
  const icone = variante === 'critico'
    ? <TriangleAlert aria-hidden className="size-3 text-critico" />
    : variante === 'atencao'
      ? <TriangleAlert aria-hidden className="size-3 text-atencao" />
      : variante === 'informativo'
        ? <Info aria-hidden className="size-3 text-informativo" />
        : null;
  return (
    <span className={cn(selo({ variante }), className)} {...props}>
      {icone}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Alert (DESIGN: raio 8px) */
export function Aviso({ className, variante = 'informativo', titulo, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { variante?: 'informativo' | 'atencao' | 'critico'; titulo?: string }) {
  const Icone = variante === 'informativo' ? Info : TriangleAlert;
  const cor = variante === 'critico' ? 'text-critico' : variante === 'atencao' ? 'text-atencao' : 'text-informativo';
  return (
    <div role={variante === 'critico' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-md border border-border bg-secondary p-3 text-body-md', className)} {...props}>
      <Icone aria-hidden className={cn('mt-0.5 size-4 shrink-0', cor)} />
      <div>
        {titulo ? <p className="text-button-sm text-foreground">{titulo}</p> : null}
        <div className="text-secondary-foreground">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Skeleton / estados */
export const Esqueleto = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div aria-hidden className={cn('animate-pulse rounded-md bg-secondary', className)} {...props} />
);

export function EstadoVazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-heading-sm text-foreground">{titulo}</p>
      {children ? <p className="max-w-md text-body-md text-muted-foreground">{children}</p> : null}
    </div>
  );
}

export function EstadoErro({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <TriangleAlert aria-hidden className="size-4 text-critico" />
        <p className="text-heading-sm text-foreground">Não foi possível carregar</p>
      </div>
      <p className="text-body-md text-muted-foreground">{mensagem}</p>
      {aoTentar ? <Botao variante="secundario" onClick={aoTentar}>Tentar novamente</Botao> : null}
    </div>
  );
}

export function SemPermissao({ children }: { children?: React.ReactNode }) {
  return (
    <EstadoVazio titulo="Sem permissão para esta visão">
      {children ?? 'O papel selecionado não tem acesso a estes dados. Troque o papel no topo da página.'}
    </EstadoVazio>
  );
}

/* ------------------------------------------------------------------ Kpi */
export function Kpi({ rotulo, valor, dica, destaque }: { rotulo: string; valor: React.ReactNode; dica?: React.ReactNode; destaque?: boolean }) {
  return (
    <Cartao destaque={destaque} aria-label={rotulo}>
      <p className={cn('text-caption', destaque ? 'text-sidebar-muted' : 'text-muted-foreground')}>{rotulo}</p>
      <p className="tnum mt-2 text-display-md">{valor}</p>
      {dica ? <p className={cn('mt-1 text-caption', destaque ? 'text-sidebar-muted' : 'text-muted-foreground')}>{dica}</p> : null}
    </Cartao>
  );
}
