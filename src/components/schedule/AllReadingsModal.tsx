import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { readingsApi } from '../../services/api';
import { Modal } from '../common';
import type { LiturgicalReading } from '../../types';

interface AllReadingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null; // yyyy-MM-dd
}

const READING_ORDER = ['primera_lectura', 'salmo_responsorial', 'segunda_lectura'];

const READING_LABELS: Record<string, string> = {
  primera_lectura: 'Primera Lectura',
  salmo_responsorial: 'Salmo Responsorial',
  segunda_lectura: 'Segunda Lectura',
};

const READING_COLORS: Record<string, { bg: string; text: string; tab: string; activeTab: string }> = {
  primera_lectura: { bg: 'bg-blue-50', text: 'text-blue-900', tab: 'text-blue-600 hover:bg-blue-50', activeTab: 'bg-blue-100 text-blue-800' },
  salmo_responsorial: { bg: 'bg-emerald-50', text: 'text-emerald-900', tab: 'text-emerald-600 hover:bg-emerald-50', activeTab: 'bg-emerald-100 text-emerald-800' },
  segunda_lectura: { bg: 'bg-purple-50', text: 'text-purple-900', tab: 'text-purple-600 hover:bg-purple-50', activeTab: 'bg-purple-100 text-purple-800' },
};

export function AllReadingsModal({ isOpen, onClose, date }: AllReadingsModalProps) {
  const [readings, setReadings] = useState<LiturgicalReading[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen && date) {
      setIsLoading(true);
      setError(null);
      setReadings([]);
      setActiveIndex(0);

      readingsApi.getByCalendarDate(date)
        .then(data => {
          // Sort by our defined order
          const sorted = [...data].sort((a, b) => {
            return READING_ORDER.indexOf(a.reading_type) - READING_ORDER.indexOf(b.reading_type);
          });
          setReadings(sorted);
          if (sorted.length === 0) {
            setError('No hay lecturas disponibles para esta fecha.');
          }
        })
        .catch(err => {
          console.error('Error fetching readings:', err);
          setError('No se pudieron cargar las lecturas. Intenta de nuevo más tarde.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, date]);

  const currentReading = readings[activeIndex];
  const colors = currentReading ? READING_COLORS[currentReading.reading_type] : null;

  const goNext = () => setActiveIndex(i => Math.min(i + 1, readings.length - 1));
  const goPrev = () => setActiveIndex(i => Math.max(i - 1, 0));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lecturas del Día">
      <div className="space-y-4">
        {date && (
          <div className="text-center pb-2 border-b border-gray-100">
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {format(parseISO(date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="animate-pulse space-y-4 py-4">
            <div className="flex justify-center gap-2">
              <div className="h-8 bg-gray-100 rounded-full w-28" />
              <div className="h-8 bg-gray-100 rounded-full w-28" />
              <div className="h-8 bg-gray-100 rounded-full w-28" />
            </div>
            <div className="h-5 bg-gray-100 rounded w-1/3 mx-auto" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="h-4 bg-gray-100 rounded w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{error}</p>
          </div>
        ) : readings.length > 0 && currentReading && colors ? (
          <>
            {/* Tabs */}
            <div className="flex gap-1 justify-center flex-wrap">
              {readings.map((r, idx) => {
                const rc = READING_COLORS[r.reading_type];
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={r.reading_type}
                    onClick={() => setActiveIndex(idx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive ? rc?.activeTab : rc?.tab
                    }`}
                  >
                    {READING_LABELS[r.reading_type] || r.reading_type}
                  </button>
                );
              })}
            </div>

            {/* Reading content */}
            <div className="space-y-3">
              <div className={`${colors.bg} rounded-lg px-4 py-3 text-center`}>
                <p className={`text-sm font-medium ${colors.text} opacity-80`}>
                  {READING_LABELS[currentReading.reading_type]}
                </p>
                <p className={`text-lg font-semibold ${colors.text} mt-1`}>
                  {currentReading.reference}
                </p>
              </div>
              <div className="max-h-[50vh] overflow-y-auto px-1">
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                  {currentReading.body.split('\n\n').map((paragraph, idx) => (
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
            </div>

            {/* Prev/Next navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                onClick={goPrev}
                disabled={activeIndex === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-xs text-gray-400">
                {activeIndex + 1} / {readings.length}
              </span>
              <button
                onClick={goNext}
                disabled={activeIndex === readings.length - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {currentReading.source_url && (
              <div className="text-center">
                <a
                  href={currentReading.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
                >
                  Fuente: USCCB
                </a>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
