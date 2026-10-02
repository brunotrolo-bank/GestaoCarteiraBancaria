import { Botao, Cartao } from '@carteira/ui';
import type { Sessao } from '@carteira/sdk';
import bannerPortoBank from '../ativos/PortoBank_Banner.jpg';

/**
 * Capa de apresentação para o gestor de negócio. O herói usa o banner oficial do Porto Seguro Bank
 * (imagem centralizada; o Vite a embute como data URI no build do Apps Script, sem URL externa).
 */
const JORNADAS = [
  {
    id: 'j-cotidiano',
    titulo: '1. Operação cotidiana',
    cena: 'Cada gerente abre a sua tela e enxerga estritamente os clientes da sua Posição. O Gerente Geral vê a agência inteira.',
    mensagem: 'Quem atende quem é uma regra da mesa, não da pessoa.',
    prova: 'Alternar "Visualizar como" entre as posições e o Gerente Geral.',
    acao: 'Abrir Torre de Controle',
    sessao: { papel: 'GG', dataSimulada: null } as Sessao,
    destino: 'cockpit' as const,
  },
  {
    id: 'j-ferias',
    titulo: '2. Férias ou afastamento',
    cena: 'A Posição 01 sai de férias de 01/11 a 15/11 e a Posição 02 assume a cobertura.',
    mensagem: 'No 16º dia o acesso termina sozinho, sem chamado para a TI.',
    prova: 'Em 05/11 a Posição 02 vê "Minha Carteira" e "Carteira Delegada"; em 16/11 só a própria.',
    acao: 'Ver cobertura em 05/11',
    sessao: { papel: 'POS-AG01-002', dataSimulada: '2026-11-05' } as Sessao,
    destino: 'carteira' as const,
  },
  {
    id: 'j-turnover',
    titulo: '3. Saída ou troca de gerente',
    cena: 'Um colaborador é desligado ou promovido; troca-se apenas o nome ligado à Posição.',
    mensagem: 'A carteira, o histórico e as métricas continuam 100% preservados.',
    prova: 'Trocar o titular da Posição 03 e conferir que os clientes seguem os mesmos.',
    acao: 'Trocar titular da Posição 03',
    sessao: { papel: 'GG', dataSimulada: null } as Sessao,
    destino: 'posicoes' as const,
  },
];

export function Capa({ definirSessao, navegar }: { definirSessao: (s: Sessao) => void; navegar: (d: 'cockpit' | 'carteira' | 'posicoes') => void }) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="titulo-capa" className="relative overflow-hidden rounded-xl border border-border">
        <img
          src={bannerPortoBank}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div aria-hidden className="absolute inset-0 bg-brand-dark-900/60" />
        <div className="relative px-6 py-12 md:px-12 md:py-16">
          <p className="text-micro-cap uppercase text-sidebar-muted">Porto Bank · Prova de conceito</p>
          <h1 id="titulo-capa" className="sr-only">Gestão de carteira por Posição, não por pessoa</h1>
          <p className="mt-4 max-w-2xl text-body-lg text-sidebar-muted">
            Uma carteira por mesa: turnover, férias e rebalanceamento sem migrar um único cliente.
          </p>
        </div>
      </section>

      <section aria-label="Fluxo funcional" className="flex flex-col gap-4">
        <h2 className="text-display-md text-foreground">O que o gestor precisa ver — em 10 minutos</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {JORNADAS.map((j) => (
            <Cartao key={j.id} className="flex flex-col gap-3" aria-labelledby={j.id}>
              <h3 id={j.id} className="text-heading-lg text-foreground">{j.titulo}</h3>
              <dl className="flex flex-1 flex-col gap-3 text-body-md">
                <div><dt className="text-caption text-muted-foreground">Cena</dt><dd className="text-foreground">{j.cena}</dd></div>
                <div><dt className="text-caption text-muted-foreground">Mensagem de negócio</dt><dd className="text-foreground">{j.mensagem}</dd></div>
                <div><dt className="text-caption text-muted-foreground">Prova na tela</dt><dd className="text-secondary-foreground">{j.prova}</dd></div>
              </dl>
              <Botao variante="secundario" onClick={() => { definirSessao(j.sessao); navegar(j.destino); }}>{j.acao}</Botao>
            </Cartao>
          ))}
        </div>
      </section>

      <section aria-label="Roteiro de demonstração" className="flex flex-col gap-3">
        <h2 className="text-heading-lg text-foreground">Roteiro sugerido</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-6 text-body-md text-secondary-foreground">
          <li>Torre de Controle como Gerente Geral: totais da agência e as posições fora do limite de capacidade (2 min).</li>
          <li>Redistribuir 20 clientes da Posição 01 para a Posição 04: simular, confirmar, ver o alerta sumir e desfazer (3 min).</li>
          <li>Trocar o titular da Posição 03 e provar que a carteira não mudou (2 min).</li>
          <li>Visualizar como Posição 02 em 05/11 e em 16/11: a cobertura entra e sai sozinha (2 min).</li>
          <li>Abrir a visão 360° de um cliente: documento mascarado, produtos, histórico e CRM (1 min).</li>
        </ol>
        <p className="text-caption text-secondary-foreground">Use "Reiniciar cenário" no topo para voltar ao estado inicial entre apresentações.</p>
      </section>
    </div>
  );
}
