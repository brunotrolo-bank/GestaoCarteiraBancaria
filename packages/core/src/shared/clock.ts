/** Tempo é dependência (constituição C4): nenhum código de domínio chama `new Date()` diretamente. */
export interface Clock {
  agora(): Date;
}

export class SystemClock implements Clock {
  agora(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private instante: Date) {}
  agora(): Date {
    return this.instante;
  }
  definir(instante: Date): void {
    this.instante = instante;
  }
}

/** Instante ao meio-dia de Brasília (UTC-3) em um dia ISO — evita ambiguidade de borda nos testes e na simulação. */
export function meioDia(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}
