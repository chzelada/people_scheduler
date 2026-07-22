import React from 'react';
import { Info } from 'lucide-react';
import { POSITION_DESCRIPTIONS } from './position-descriptions';

interface PositionInfoIconProps {
  positionName?: string | null;
  /** Variante para fondos de color (ícono blanco) */
  light?: boolean;
  /** Alineación del tooltip respecto al ícono */
  align?: 'left' | 'right';
}

export function PositionInfoIcon({ positionName, light = false, align = 'left' }: PositionInfoIconProps) {
  const [show, setShow] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!show) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    // Fase de captura: cierra aunque otro elemento haga stopPropagation en burbuja
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [show]);

  const description = positionName ? POSITION_DESCRIPTIONS[positionName] : undefined;
  if (!description) return null;

  const iconColor = light
    ? show
      ? 'text-white'
      : 'text-white/70 hover:text-white'
    : show
      ? 'text-blue-500'
      : 'text-gray-400 hover:text-blue-500';

  return (
    <span
      ref={ref}
      className="relative group/info inline-flex flex-shrink-0"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShow((v) => !v);
        }}
        className="flex items-center p-0.5 -m-0.5"
        aria-label={`Información de ${positionName}`}
      >
        <Info className={`w-3.5 h-3.5 cursor-help ${iconColor}`} />
      </button>
      <span
        className={`${show ? 'block' : 'hidden group-hover/info:block'} absolute ${
          align === 'right' ? 'right-0' : 'left-0'
        } bottom-full mb-1 z-50 w-max max-w-[220px] rounded bg-gray-900 px-2 py-1 text-xs font-normal text-white shadow-lg whitespace-normal text-left`}
      >
        {description}
      </span>
    </span>
  );
}
