import React, { useEffect, useState } from 'react';
import { X, Mail, Phone, MapPin, Calendar, User, Users, FileCheck, Clock, CalendarCheck, Cake } from 'lucide-react';
import { Avatar } from '../common';
import { scheduleApi } from '../../services/api';
import type { Person, Job, PersonAssignmentDetail } from '../../types';

interface PersonDetailModalProps {
  person: Person | null;
  jobs: Job[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (person: Person) => void;
}

const frequencyLabels: Record<string, string> = {
  weekly: 'Semanal',
  bimonthly: 'Quincenal',
  monthly: 'Mensual',
};

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate + 'T00:00:00');
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatBirthday(birthDate: string): string {
  const date = new Date(birthDate + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
}

export function PersonDetailModal({ person, jobs, isOpen, onClose, onEdit }: PersonDetailModalProps) {
  const [assignmentHistory, setAssignmentHistory] = useState<PersonAssignmentDetail[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && person) {
      setIsLoadingHistory(true);
      scheduleApi.getPersonAssignmentHistory(person.id, '', '')
        .then(history => {
          setAssignmentHistory(history);
        })
        .catch(err => {
          console.error('Error loading assignment history:', err);
          setAssignmentHistory([]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      setAssignmentHistory([]);
    }
  }, [isOpen, person?.id]);

  if (!isOpen || !person) return null;

  const getJobNames = (jobIds: string[]) => {
    return jobIds
      .map((id) => jobs.find((j) => j.id === id))
      .filter(Boolean) as Job[];
  };

  const personJobs = getJobNames(person.job_ids);

  // Calculate last and next service dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedHistory = [...assignmentHistory].sort((a, b) =>
    new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );

  const pastAssignments = sortedHistory.filter(a => new Date(a.service_date + 'T00:00:00') < today);
  const futureAssignments = sortedHistory.filter(a => new Date(a.service_date + 'T00:00:00') >= today);

  const lastAssignment = pastAssignments.length > 0 ? pastAssignments[pastAssignments.length - 1] : null;
  const nextAssignment = futureAssignments.length > 0 ? futureAssignments[0] : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full max-w-md">
          {/* Header with photo */}
          <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-6 pt-8 pb-20">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">Ficha del Servidor</h3>
            </div>
          </div>

          {/* Avatar overlay */}
          <div className="relative -mt-14 flex justify-center">
            <div className="rounded-full border-4 border-white shadow-lg">
              <Avatar
                photoUrl={person.photo_url}
                firstName={person.first_name}
                lastName={person.last_name}
                size="xl"
                className="w-28 h-28"
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pt-4 pb-6">
            {/* Name and username */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {person.first_name} {person.last_name}
              </h2>
              {person.username && (
                <p className="text-sm text-gray-500 font-mono">@{person.username}</p>
              )}
              <div className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                person.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {person.active ? 'Activo' : 'Inactivo'}
              </div>
            </div>

            {/* Services badges */}
            {personJobs.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {personJobs.map((job) => (
                  <span
                    key={job.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: job.color }}
                  >
                    {job.name}
                  </span>
                ))}
              </div>
            )}

            {/* Info cards */}
            <div className="space-y-3">
              {/* Age and Birthday */}
              {person.birth_date && (
                <div className="bg-purple-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center text-sm">
                    <Cake className="w-4 h-4 text-purple-500 mr-3" />
                    <span className="text-gray-700">
                      <span className="font-semibold">{calculateAge(person.birth_date)} años</span>
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 text-purple-500 mr-3" />
                    <span className="text-gray-700">
                      Cumpleaños: <span className="font-medium">{formatBirthday(person.birth_date)}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Service dates */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center text-sm">
                  <Clock className="w-4 h-4 text-blue-500 mr-3" />
                  <span className="text-gray-700">
                    Último servicio:{' '}
                    {isLoadingHistory ? (
                      <span className="text-gray-400 italic">Cargando...</span>
                    ) : lastAssignment ? (
                      <span className="font-medium">{formatShortDate(lastAssignment.service_date)}</span>
                    ) : (
                      <span className="text-gray-400 italic">Sin registro</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <CalendarCheck className="w-4 h-4 text-blue-500 mr-3" />
                  <span className="text-gray-700">
                    Próximo servicio:{' '}
                    {isLoadingHistory ? (
                      <span className="text-gray-400 italic">Cargando...</span>
                    ) : nextAssignment ? (
                      <span className="font-medium">{formatShortDate(nextAssignment.service_date)}</span>
                    ) : (
                      <span className="text-gray-400 italic">No programado</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Contact info */}
              {(person.email || person.phone) && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {person.email && (
                    <div className="flex items-center text-sm">
                      <Mail className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-700">{person.email}</span>
                    </div>
                  )}
                  {person.phone && (
                    <div className="flex items-center text-sm">
                      <Phone className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-700">{person.phone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Personal info */}
              {(person.address || person.parent_name) && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {person.parent_name && (
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-700">
                        Padre/Madre: {person.parent_name}
                      </span>
                    </div>
                  )}
                  {person.address && (
                    <div className="flex items-center text-sm">
                      <MapPin className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-700">{person.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="text-gray-700">
                    Frecuencia preferida: {frequencyLabels[person.preferred_frequency] || person.preferred_frequency}
                  </span>
                </div>
                {person.first_communion && (
                  <div className="flex items-center text-sm">
                    <FileCheck className="w-4 h-4 text-green-500 mr-3" />
                    <span className="text-gray-700">Primera Comunión realizada</span>
                  </div>
                )}
                {person.photo_consent && (
                  <div className="flex items-center text-sm">
                    <FileCheck className="w-4 h-4 text-green-500 mr-3" />
                    <span className="text-gray-700">Consentimiento de fotos</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {person.notes && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 italic">{person.notes}</p>
                </div>
              )}
            </div>

            {/* Edit button */}
            {onEdit && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => {
                    onClose();
                    onEdit(person);
                  }}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
                >
                  Editar servidor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
