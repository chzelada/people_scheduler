import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { FairnessScore } from '../../types';
import { PersonHistoryModal } from './PersonHistoryModal';

interface FairnessReportProps {
  scores: FairnessScore[];
  year: number;
}

export function FairnessReport({ scores, year }: FairnessReportProps) {
  const maxAssignments = Math.max(...scores.map((s) => s.assignments_this_year), 1);
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string } | null>(null);

  const getJobCount = (score: FairnessScore, jobName: string): number => {
    const job = score.assignments_by_job?.find(
      (j) => j.job_name.toLowerCase() === jobName.toLowerCase()
    );
    return job?.count || 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Distribución de Asignaciones - {year}
        </h3>
        <div className="text-sm text-gray-500">
          {scores.length} voluntarios
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center space-x-4 text-xs font-medium text-gray-500 uppercase border-b pb-2">
        <div className="w-40">Nombre</div>
        <div className="flex-1">Distribución</div>
        <div className="w-16 text-center">Total</div>
        <div className="w-20 text-center">Monaguillo</div>
        <div className="w-16 text-center">Lector</div>
        <div className="w-24 text-right">Última Fecha</div>
      </div>

      <div className="space-y-2">
        {scores.map((score) => {
          const percentage = (score.assignments_this_year / maxAssignments) * 100;
          const monaguilloCount = getJobCount(score, 'Monaguillos');
          const lectorCount = getJobCount(score, 'Lectores');

          return (
            <div key={score.person_id} className="flex items-center space-x-4">
              <div className="w-40 text-sm truncate">
                <button
                  onClick={() => setSelectedPerson({ id: score.person_id, name: score.person_name })}
                  className="text-primary-600 hover:text-primary-800 hover:underline font-medium text-left"
                >
                  {score.person_name}
                </button>
              </div>
              <div className="flex-1">
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-center">
                <span className="text-sm font-medium text-gray-900">
                  {score.assignments_this_year}
                </span>
              </div>
              <div className="w-20 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {monaguilloCount}
                </span>
              </div>
              <div className="w-16 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  {lectorCount}
                </span>
              </div>
              <div className="w-24 text-xs text-gray-500 text-right">
                {score.last_assignment_date
                  ? format(parseISO(score.last_assignment_date), "d 'de' MMM", { locale: es })
                  : 'Nunca'}
              </div>
            </div>
          );
        })}
      </div>

      {scores.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay datos de asignaciones para {year}
        </div>
      )}

      {/* Person History Modal */}
      {selectedPerson && (
        <PersonHistoryModal
          isOpen={!!selectedPerson}
          onClose={() => setSelectedPerson(null)}
          personId={selectedPerson.id}
          personName={selectedPerson.name}
        />
      )}
    </div>
  );
}
