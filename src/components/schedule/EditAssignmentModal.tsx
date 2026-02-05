import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { Modal, Button } from '../common';
import { scheduleApi } from '../../services/api';
import type { Assignment, EligiblePerson } from '../../types';

interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  serviceDate: string | null;
  jobName: string;
  currentScheduleAssignments: Assignment[]; // All assignments in the current schedule/preview
  onSave: (assignmentId: string, newPersonId: string, newPersonName: string) => Promise<void>;
}

export function EditAssignmentModal({
  isOpen,
  onClose,
  assignment,
  serviceDate,
  jobName,
  currentScheduleAssignments,
  onSave,
}: EditAssignmentModalProps) {
  const [eligiblePeople, setEligiblePeople] = useState<EligiblePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showIneligible, setShowIneligible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assignment) {
      loadEligiblePeople();
      setSelectedPersonId(null);
      setSearchQuery('');
      setShowIneligible(false);
    }
  }, [isOpen, assignment]);

  // Check if two jobs are mutually exclusive (can't serve both on same day)
  const areJobsExclusive = (job1: string, job2: string): boolean => {
    const j1 = job1.toLowerCase();
    const j2 = job2.toLowerCase();
    const exclusivePairs = [
      ['monaguillos', 'monaguillos jr'],
      ['monaguillos', 'lectores'],
    ];
    return exclusivePairs.some(
      ([a, b]) => (j1 === a && j2 === b) || (j1 === b && j2 === a)
    );
  };

  const loadEligiblePeople = async () => {
    if (!assignment || !serviceDate) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const people = await scheduleApi.getEligiblePeopleForAssignment({
        job_id: assignment.job_id,
        service_date: serviceDate,
        current_person_id: assignment.person_id || undefined,
      });

      // Build lookup for eligibility rules:
      // 1. Can't serve in the SAME job twice per month
      // 2. Can't serve in EXCLUSIVE jobs on the SAME day (e.g., Monaguillo and Lector same day)

      // Map person_id -> job_name for same job check
      const assignedToSameJob = new Map<string, string>();
      // Map person_id -> job_name for same day exclusive job check
      const assignedOnSameDayExclusive = new Map<string, string>();

      currentScheduleAssignments
        .filter((a) => a.id !== assignment.id && a.person_id)
        .forEach((a) => {
          const personId = a.person_id!;
          const otherJobName = a.job_name || '';

          // Check 1: Same job anywhere in the schedule
          if (a.job_id === assignment.job_id) {
            assignedToSameJob.set(personId, otherJobName);
          }

          // Check 2: Exclusive job on the same day
          if (a.service_date_id === assignment.service_date_id && areJobsExclusive(jobName, otherJobName)) {
            assignedOnSameDayExclusive.set(personId, otherJobName);
          }
        });

      // Mark people based on specific rules
      const peopleWithScheduleCheck = people.map((person) => {
        if (person.reason_if_ineligible) {
          return person; // Already has a reason
        }

        // Rule 1: Already assigned to same job this month
        if (assignedToSameJob.has(person.id)) {
          return {
            ...person,
            reason_if_ineligible: `Ya asignado como ${jobName} este mes`,
          };
        }

        // Rule 2: Already assigned to exclusive job on same day
        if (assignedOnSameDayExclusive.has(person.id)) {
          const otherJob = assignedOnSameDayExclusive.get(person.id);
          return {
            ...person,
            reason_if_ineligible: `Ya asignado como ${otherJob} el mismo día`,
          };
        }

        return person;
      });

      setEligiblePeople(peopleWithScheduleCheck);
    } catch (error) {
      console.error('Error loading eligible people:', error);
      setErrorMsg(String(error));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!assignment || !selectedPersonId) return;
    const selectedPerson = eligiblePeople.find(p => p.id === selectedPersonId);
    if (!selectedPerson) return;

    const personName = `${selectedPerson.first_name} ${selectedPerson.last_name}`;
    setSaving(true);
    try {
      await onSave(assignment.id, selectedPersonId, personName);
      onClose();
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
    setSaving(false);
  };

  const filteredPeople = eligiblePeople.filter((person) => {
    const matchesSearch = `${person.first_name} ${person.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const isEligible = !person.reason_if_ineligible;
    return matchesSearch && (showIneligible || isEligible);
  });

  const eligibleCount = eligiblePeople.filter((p) => !p.reason_if_ineligible).length;
  const ineligibleCount = eligiblePeople.filter((p) => p.reason_if_ineligible).length;

  const formattedDate = serviceDate
    ? format(parseISO(serviceDate), "EEEE d 'de' MMMM", { locale: es })
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Asignación"
    >
      <div className="space-y-4">
        {/* Current Assignment Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Fecha:</span> {formattedDate}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-medium">Trabajo:</span> {jobName}
            {assignment?.position_name && (
              <span className="ml-2 text-gray-500">({assignment.position_name})</span>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-medium">Servidor actual:</span>{' '}
            <span className="text-primary-600">{assignment?.person_name}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar servidor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              {eligibleCount} elegibles
            </span>
            <span className="flex items-center text-gray-500">
              <AlertCircle className="w-4 h-4 mr-1" />
              {ineligibleCount} no elegibles
            </span>
          </div>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showIneligible}
              onChange={(e) => setShowIneligible(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mr-2"
            />
            Mostrar no elegibles
          </label>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Error: {errorMsg}
          </div>
        )}

        {/* People List */}
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Cargando...</div>
          ) : filteredPeople.length > 0 ? (
            filteredPeople.map((person) => {
              const isEligible = !person.reason_if_ineligible;
              const isSelected = selectedPersonId === person.id;
              const isCurrent = person.id === assignment?.person_id;

              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => isEligible && setSelectedPersonId(person.id)}
                  disabled={!isEligible}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 transition-colors ${
                    isSelected
                      ? 'bg-primary-50 border-l-4 border-l-primary-500'
                      : isEligible
                      ? 'hover:bg-gray-50'
                      : 'bg-gray-50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-sm ${isEligible ? 'text-gray-900' : 'text-gray-500'}`}>
                        {person.first_name} {person.last_name}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-primary-600">(actual)</span>
                        )}
                      </span>
                      {person.reason_if_ineligible && (
                        <p className="text-xs text-red-500 mt-0.5">
                          {person.reason_if_ineligible}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {person.sibling_status === 'preferred' && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                          <Users className="w-3 h-3 inline mr-0.5" />
                          Hermano
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {person.assignments_this_year} asign.
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No se encontraron servidores
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedPersonId}
            isLoading={saving}
          >
            Guardar Cambio
          </Button>
        </div>
      </div>
    </Modal>
  );
}
