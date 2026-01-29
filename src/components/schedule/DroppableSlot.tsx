import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { DraggableAssignment } from './DraggableAssignment';
import type { Assignment } from '../../types';

interface DroppableSlotProps {
  slotId: string;
  assignment: Assignment;
  editable: boolean;
  onEdit: (assignment: Assignment) => void;
  onClear: (assignment: Assignment) => void;
}

export function DroppableSlot({ slotId, assignment, editable, onEdit, onClear }: DroppableSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: { assignment },
  });

  const isEmpty = !assignment.person_id;

  return (
    <div
      ref={setNodeRef}
      className={`px-3 py-2 transition-colors ${
        isOver ? 'bg-primary-100 ring-2 ring-primary-400 ring-inset' : ''
      } ${isEmpty ? 'bg-gray-50' : ''}`}
    >
      {isEmpty ? (
        editable ? (
          <button
            onClick={() => onEdit(assignment)}
            className="w-full border-2 border-dashed border-gray-300 rounded p-2 text-center text-gray-400 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <div className="flex items-center justify-center space-x-1">
              <Plus className="w-4 h-4" />
              <span className="text-sm">
                {assignment.position_name || `Posicion ${assignment.position}`}
              </span>
            </div>
          </button>
        ) : (
          <div className="text-sm text-gray-400 italic">
            {assignment.position_name || `Posicion ${assignment.position}`}: Vacio
          </div>
        )
      ) : (
        <DraggableAssignment
          assignment={assignment}
          disabled={!editable}
          onClear={editable ? () => onClear(assignment) : undefined}
        />
      )}
    </div>
  );
}
