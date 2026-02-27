import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users } from 'lucide-react';
import { scheduleApi } from '../../services/api';
import { Modal } from '../common';
import type { ServiceDateJobGroup } from '../../types';

interface ServiceDateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null; // yyyy-MM-dd
}

export function ServiceDateTeamModal({ isOpen, onClose, date }: ServiceDateTeamModalProps) {
  const [groups, setGroups] = useState<ServiceDateJobGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && date) {
      setIsLoading(true);
      scheduleApi.getServiceDateTeam(date)
        .then(setGroups)
        .catch((err) => {
          console.error('Error fetching team:', err);
          setGroups([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, date]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Servidores del Domingo">
      <div className="space-y-4">
        {date && (
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {format(parseISO(date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="space-y-2 ml-4">
                  <div className="h-5 bg-gray-100 rounded w-2/3" />
                  <div className="h-5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay asignaciones publicadas para este domingo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.job_id} className="rounded-lg overflow-hidden border border-gray-100">
                <div
                  className="px-4 py-2 text-white font-semibold text-sm"
                  style={{ backgroundColor: group.job_color }}
                >
                  {group.job_name}
                </div>
                <ul className="divide-y divide-gray-50">
                  {group.members.map((member, idx) => (
                    <li key={idx} className="px-4 py-2 flex items-center justify-between">
                      <span className="text-gray-900 text-sm">{member.person_name}</span>
                      {member.position_name && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {member.position_name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
