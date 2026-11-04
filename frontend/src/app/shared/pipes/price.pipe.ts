import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'price', standalone: true })
export class PricePipe implements PipeTransform {
  transform(amountInCents: number | null | undefined, currency = 'ARS'): string {
    if (amountInCents == null) return '';
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  }
}
