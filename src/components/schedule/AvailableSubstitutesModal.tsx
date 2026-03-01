import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserCheck } from 'lucide-react';
import { scheduleApi } from '../../services/api';
import { Modal } from '../common';
import type { AvailableSubstitute } from '../../types';

interface JobInfo {
  job_id: string;
  job_name: string;
  job_color: string;
}

interface AvailableSubstitutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null; // yyyy-MM-dd
  jobs: JobInfo[];
}

interface JobSubstitutes {
  job: JobInfo;
  substitutes: AvailableSubstitute[];
  isLoading: boolean;
}

export function AvailableSubstitutesModal({ isOpen, onClose, date, jobs }: AvailableSubstitutesModalProps) {
  const [jobSubstitutes, setJobSubstitutes] = useState<JobSubstitutes[]>([]);

  useEffect(() => {
    if (isOpen && date && jobs.length > 0) {
      // Initialize with loading state
      setJobSubstitutes(jobs.map(job => ({ job, substitutes: [], isLoading: true })));

      // Fetch substitutes for each job in parallel
      jobs.forEach((job, index) => {
        scheduleApi.getAvailableSubstitutes(date, job.job_id)
          .then(substitutes => {
            setJobSubstitutes(prev => {
              const updated = [...prev];
              updated[index] = { job, substitutes, isLoading: false };
              return updated;
            });
          })
          .catch(err => {
            console.error(`Error fetching substitutes for ${job.job_name}:`, err);
            setJobSubstitutes(prev => {
              const updated = [...prev];
              updated[index] = { job, substitutes: [], isLoading: false };
              return updated;
            });
          });
      });
    }
  }, [isOpen, date, jobs]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Buscar Reemplazo">
      <div className="space-y-4">
        {date && (
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {format(parseISO(date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Personas disponibles para cubrir tu puesto
            </p>
          </div>
        )}

        {jobSubstitutes.length === 0 ? (
          <div className="text-center py-8">
            <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay información disponible</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobSubstitutes.map(({ job, substitutes, isLoading }) => (
              <div key={job.job_id} className="rounded-lg overflow-hidden border border-gray-100">
                <div
                  className="px-4 py-2 text-white font-semibold text-sm"
                  style={{ backgroundColor: job.job_color }}
                >
                  {job.job_name}
                </div>
                {isLoading ? (
                  <div className="animate-pulse p-4 space-y-2">
                    <div className="h-5 bg-gray-100 rounded w-2/3" />
                    <div className="h-5 bg-gray-100 rounded w-1/2" />
                    <div className="h-5 bg-gray-100 rounded w-3/5" />
                  </div>
                ) : substitutes.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-gray-400">
                    No hay personas disponibles para este puesto
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {substitutes.map((person, idx) => (
                      <li key={idx} className="px-4 py-2 text-sm text-gray-900">
                        {person.first_name} {person.last_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
