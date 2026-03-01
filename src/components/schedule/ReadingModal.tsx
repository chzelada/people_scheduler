import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpen } from 'lucide-react';
import { readingsApi } from '../../services/api';
import { Modal } from '../common';
import type { LiturgicalReading } from '../../types';

interface ReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceDateId: string | null;
  positionName: string | null;
  date: string | null; // yyyy-MM-dd
}

export function ReadingModal({ isOpen, onClose, serviceDateId, positionName, date }: ReadingModalProps) {
  const [reading, setReading] = useState<LiturgicalReading | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && serviceDateId && positionName) {
      setIsLoading(true);
      setError(null);
      setReading(null);

      readingsApi.getMyReading(serviceDateId, positionName)
        .then(data => {
          setReading(data);
          if (!data) {
            setError('Lectura no disponible para esta fecha.');
          }
        })
        .catch(err => {
          console.error('Error fetching reading:', err);
          setError('No se pudo cargar la lectura. Intenta de nuevo más tarde.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, serviceDateId, positionName]);

  const readingTypeLabel = (type: string) => {
    switch (type) {
      case 'primera_lectura': return 'Primera Lectura';
      case 'salmo_responsorial': return 'Salmo Responsorial';
      case 'segunda_lectura': return 'Segunda Lectura';
      default: return type;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mi Lectura">
      <div className="space-y-4">
        {date && (
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {format(parseISO(date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
            {positionName && (
              <p className="text-sm text-primary-600 font-medium mt-1">
                {positionName}
              </p>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="animate-pulse space-y-4 py-4">
            <div className="h-5 bg-gray-100 rounded w-1/3 mx-auto" />
            <div className="h-4 bg-gray-100 rounded w-2/3 mx-auto" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{error}</p>
          </div>
        ) : reading ? (
          <div className="space-y-3">
            <div className="bg-primary-50 rounded-lg px-4 py-3 text-center">
              <p className="text-sm font-medium text-primary-700">
                {readingTypeLabel(reading.reading_type)}
              </p>
              <p className="text-lg font-semibold text-primary-900 mt-1">
                {reading.reference}
              </p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-1">
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                {reading.body.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-3">
                    {paragraph.split('\n').map((line, lineIdx) => (
                      <span key={lineIdx}>
                        {lineIdx > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            </div>
            {reading.source_url && (
              <div className="text-center pt-2 border-t border-gray-100">
                <a
                  href={reading.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
                >
                  Fuente: USCCB
                </a>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
