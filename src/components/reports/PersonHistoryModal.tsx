import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Modal } from '../common';
import { scheduleApi } from '../../services/api';
import type { PersonAssignmentDetail } from '../../types';

interface PersonHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
}

const months = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const monthAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function PersonHistoryModal({ isOpen, onClose, personId, personName }: PersonHistoryModalProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [startMonth, setStartMonth] = useState(1);
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState(currentYear);
  const [assignments, setAssignments] = useState<PersonAssignmentDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<{ date: Date; jobs: string[] } | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (isOpen && personId) {
      loadHistory();
    }
  }, [isOpen, personId, startMonth, startYear, endMonth, endYear]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(new Date(startYear, startMonth - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(endYear, endMonth - 1)), 'yyyy-MM-dd');
      const history = await scheduleApi.getPersonAssignmentHistory(personId, startDate, endDate);
      setAssignments(history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
    setLoading(false);
  };

  // Get all Sundays in the date range grouped by month
  const getSundaysByMonth = (): { month: string; year: number; monthNum: number; sundays: Date[] }[] => {
    const start = startOfMonth(new Date(startYear, startMonth - 1));
    const end = endOfMonth(new Date(endYear, endMonth - 1));
    const result: { month: string; year: number; monthNum: number; sundays: Date[] }[] = [];

    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });

    for (const weekStart of weeks) {
      if (weekStart >= start && weekStart <= end) {
        const monthNum = weekStart.getMonth();
        const year = weekStart.getFullYear();
        const monthKey = `${year}-${monthNum}`;

        let monthGroup = result.find(g => g.month === monthKey);
        if (!monthGroup) {
          monthGroup = {
            month: monthKey,
            year,
            monthNum,
            sundays: []
          };
          result.push(monthGroup);
        }
        monthGroup.sundays.push(weekStart);
      }
    }

    return result;
  };

  const sundaysByMonth = getSundaysByMonth();
  const totalSundays = sundaysByMonth.reduce((acc, m) => acc + m.sundays.length, 0);

  // Create a map of date -> jobs served
  const assignmentMap = new Map<string, string[]>();
  for (const assignment of assignments) {
    const dateKey = assignment.service_date;
    if (!assignmentMap.has(dateKey)) {
      assignmentMap.set(dateKey, []);
    }
    assignmentMap.get(dateKey)!.push(assignment.job_name);
  }

  const getSquareStyle = (sunday: Date) => {
    const dateKey = format(sunday, 'yyyy-MM-dd');
    const jobs = assignmentMap.get(dateKey) || [];

    const hasMonaguillo = jobs.some(j => j.toLowerCase() === 'monaguillos');
    const hasLector = jobs.some(j => j.toLowerCase() === 'lectores');

    if (hasMonaguillo && hasLector) {
      return {
        background: 'linear-gradient(135deg, #3B82F6 50%, #10B981 50%)',
      };
    } else if (hasMonaguillo) {
      return { backgroundColor: '#3B82F6' };
    } else if (hasLector) {
      return { backgroundColor: '#10B981' };
    } else {
      return { backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' };
    }
  };

  const getJobs = (sunday: Date): string[] => {
    const dateKey = format(sunday, 'yyyy-MM-dd');
    return assignmentMap.get(dateKey) || [];
  };

  // Count statistics
  const stats = {
    total: totalSundays,
    served: assignmentMap.size,
    monaguillo: assignments.filter(a => a.job_name.toLowerCase() === 'monaguillos').length,
    lector: assignments.filter(a => a.job_name.toLowerCase() === 'lectores').length,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Historial de ${personName}`}>
      <div className="space-y-4">
        {/* Date Range Selector - Month/Year */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <div className="flex gap-2">
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <div className="flex gap-2">
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3B82F6' }} />
            <span>Monaguillo</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }} />
            <span>Lector</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(135deg, #3B82F6 50%, #10B981 50%)' }} />
            <span>Ambos</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded border border-gray-300 bg-gray-100" />
            <span>No sirvió</span>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-2 text-center text-sm bg-gray-50 p-3 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">{stats.total}</div>
            <div className="text-gray-500">Domingos</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">{stats.served}</div>
            <div className="text-gray-500">Sirvió</div>
          </div>
          <div>
            <div className="font-medium text-blue-600">{stats.monaguillo}</div>
            <div className="text-gray-500">Monaguillo</div>
          </div>
          <div>
            <div className="font-medium text-green-600">{stats.lector}</div>
            <div className="text-gray-500">Lector</div>
          </div>
        </div>

        {/* Instant Tooltip */}
        <div className="h-6 text-sm text-center">
          {hoveredDate ? (
            <span>
              <span className="font-medium">{format(hoveredDate.date, "d 'de' MMMM yyyy", { locale: es })}</span>
              {' - '}
              <span className={hoveredDate.jobs.length > 0 ? 'text-primary-600' : 'text-gray-500'}>
                {hoveredDate.jobs.length > 0 ? hoveredDate.jobs.join(', ') : 'No sirvió'}
              </span>
            </span>
          ) : (
            <span className="text-gray-400">Pasa el mouse sobre un cuadro para ver detalles</span>
          )}
        </div>

        {/* Calendar Grid - Grouped by Month with Vertical Separators */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : (
          <div className="flex flex-wrap items-start gap-1">
            {sundaysByMonth.map((monthGroup, index) => (
              <React.Fragment key={monthGroup.month}>
                {/* Month group */}
                <div className="flex flex-col items-center">
                  <div className="text-xs text-gray-500 mb-1 font-medium">
                    {monthAbbr[monthGroup.monthNum]}
                  </div>
                  <div className="flex gap-0.5">
                    {monthGroup.sundays.map((sunday) => (
                      <div
                        key={sunday.toISOString()}
                        className="w-7 h-7 rounded cursor-pointer transition-transform hover:scale-110"
                        style={getSquareStyle(sunday)}
                        onMouseEnter={() => setHoveredDate({ date: sunday, jobs: getJobs(sunday) })}
                        onMouseLeave={() => setHoveredDate(null)}
                      />
                    ))}
                  </div>
                </div>
                {/* Vertical separator between months */}
                {index < sundaysByMonth.length - 1 && (
                  <div className="w-px h-12 bg-gray-300 mx-1 self-end mb-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {totalSundays === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No hay domingos en el rango seleccionado
          </div>
        )}
      </div>
    </Modal>
  );
}
