import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let contador = 0;

/**
 * Logo de Gestión Trabajo: monograma "GT" en un cuadrado redondeado con tres
 * puntos (Mudanzas360, ObraLocal Madrid y ArmaMuebles).
 *
 * El mismo dibujo está en assets/logo.svg (de ahí salen iconos y splash).
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-block;line-height:0' },
  template: `
    <svg
      viewBox="0 0 1024 1024"
      [attr.width]="tamano()"
      [attr.height]="tamano()"
      role="img"
      aria-label="Gestión Trabajo"
    >
      <defs>
        <linearGradient [attr.id]="'lg-' + id" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6366f1" />
          <stop offset="1" stop-color="#4338ca" />
        </linearGradient>
        <radialGradient [attr.id]="'lb-' + id" cx="0.25" cy="0.1" r="0.9">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.28" />
          <stop offset="0.6" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" rx="232" [attr.fill]="'url(#lg-' + id + ')'" />
      <rect width="1024" height="1024" rx="232" [attr.fill]="'url(#lb-' + id + ')'" />
      <g fill="none" stroke="#ffffff" stroke-width="104" stroke-linecap="round" stroke-linejoin="round">
        <path d="M455.8 329.4A172 172 0 1 0 496 440H356" />
        <path d="M620 268H860M740 268V612" />
      </g>
      <g stroke="#ffffff" stroke-width="14">
        <circle cx="388" cy="784" r="54" fill="#2563eb" />
        <circle cx="512" cy="784" r="54" fill="#e5484d" />
        <circle cx="636" cy="784" r="54" fill="#e08a12" />
      </g>
    </svg>
  `,
})
export class LogoComponent {
  readonly tamano = input(40);
  protected readonly id = ++contador;
}
