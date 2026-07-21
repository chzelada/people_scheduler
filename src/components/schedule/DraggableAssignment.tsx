import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Info, X } from 'lucide-react';
import type { Assignment } from '../../types';
import { POSITION_DESCRIPTIONS } from './position-descriptions';

interface DraggableAssignmentProps {
  assignment: Assignment;
  disabled?: boolean;
  onClear?: () => void;
}

export function DraggableAssignment({ assignment, disabled = false, onClear }: DraggableAssignmentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: assignment.id,
    data: { assignment },
    disabled,
  });

  const [showInfo, setShowInfo] = React.useState(false);
  const infoRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!showInfo) return;
    const close = (e: PointerEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showInfo]);

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  if (!assignment.person_id) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : { ...listeners, ...attributes })}
      className={`flex items-center justify-between group ${
        isDragging ? 'opacity-50 bg-primary-100 rounded shadow-lg' : ''
      } ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {!disabled && (
          <div className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="flex flex-col min-w-0">
          {assignment.position_name && (
            <span className="flex items-center gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-500 truncate">
                {assignment.position_name}
              </span>
              {POSITION_DESCRIPTIONS[assignment.position_name] && (
                <span
                  ref={infoRef}
                  className="relative group/info flex-shrink-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowInfo((v) => !v);
                    }}
                    className="flex items-center p-0.5 -m-0.5"
                    aria-label={`Información de ${assignment.position_name}`}
                  >
                    <Info
                      className={`w-3.5 h-3.5 cursor-help ${
                        showInfo ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'
                      }`}
                    />
                  </button>
                  <span
                    className={`${
                      showInfo ? 'block' : 'hidden group-hover/info:block'
                    } absolute left-0 bottom-full mb-1 z-50 w-max max-w-[220px] rounded bg-gray-900 px-2 py-1 text-xs font-normal text-white shadow-lg whitespace-normal`}
                  >
                    {POSITION_DESCRIPTIONS[assignment.position_name]}
                  </span>
                </span>
              )}
            </span>
          )}
          <span className="text-sm text-gray-900 truncate">
            {assignment.person_name || assignment.person_id}
          </span>
        </div>
        {assignment.manual_override && (
          <span className="text-xs text-orange-500 flex-shrink-0">(manual)</span>
        )}
      </div>
      {!disabled && onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClear();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0"
          title="Vaciar asignacion"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
