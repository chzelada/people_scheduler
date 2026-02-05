import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, X } from 'lucide-react';
import type { FairnessScore } from '../../types';
import { PersonHistoryModal } from './PersonHistoryModal';

interface FairnessReportProps {
  scores: FairnessScore[];
  year: number;
}

export function FairnessReport({ scores, year }: FairnessReportProps) {
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredScores = useMemo(() => {
    if (!searchTerm.trim()) return scores;
    const term = searchTerm.toLowerCase().trim();
    return scores.filter((s) => s.person_name.toLowerCase().includes(term));
  }, [scores, searchTerm]);

  const maxAssignments = Math.max(...scores.map((s) => s.assignments_this_year), 1);

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
          {filteredScores.length} de {scores.length} voluntarios
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar voluntario por nombre..."
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center space-x-4 text-xs font-medium text-gray-500 uppercase border-b pb-2">
        <div className="w-40">Nombre</div>
        <div className="flex-1">Distribución</div>
        <div className="w-16 text-center">Total</div>
        <div className="w-20 text-center">Monaguillo</div>
        <div className="w-16 text-center">Mon. Jr.</div>
        <div className="w-16 text-center">Lector</div>
        <div className="w-24 text-right">Última Fecha</div>
      </div>

      <div className="space-y-2">
        {filteredScores.map((score) => {
          const percentage = (score.assignments_this_year / maxAssignments) * 100;
          const monaguilloCount = getJobCount(score, 'Monaguillos');
          const monaguilloJrCount = getJobCount(score, 'Monaguillos Jr.');
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
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {monaguilloJrCount}
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

      {filteredScores.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? `No se encontraron resultados para "${searchTerm}"` : `No hay datos de asignaciones para ${year}`}
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
