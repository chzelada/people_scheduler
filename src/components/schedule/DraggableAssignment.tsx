import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { Assignment } from '../../types';

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
            <span className="text-xs font-medium text-gray-500 truncate">
              {assignment.position_name}
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
