import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ScheduleConflict } from '../../types';

interface ConflictListProps {
  conflicts: ScheduleConflict[];
}

export function ConflictList({ conflicts }: ConflictListProps) {
  if (conflicts.length === 0) {
    return (
      <div className="text-center py-4 text-green-600">
        No conflicts detected
      </div>
    );
  }

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case 'insufficient_people':
        return 'Insufficient People';
      case 'sibling_violation':
        return 'Sibling Rule Violation';
      case 'consecutive_weeks_exceeded':
        return 'Consecutive Weeks Exceeded';
      case 'unavailable_person':
        return 'Person Unavailable';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-3">
      {conflicts.map((conflict, index) => (
        <div
          key={index}
          className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-yellow-800">
                {getConflictTypeLabel(conflict.conflict_type)}
              </span>
              <span className="text-xs text-yellow-600">
                {format(parseISO(conflict.service_date), 'MMM d, yyyy')}
              </span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">{conflict.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
