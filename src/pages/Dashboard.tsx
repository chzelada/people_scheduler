import React, { useEffect, useState } from 'react';
import { Users, Calendar, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { usePeopleStore } from '../stores/peopleStore';
import { useJobsStore } from '../stores/jobsStore';
import { useScheduleStore } from '../stores/scheduleStore';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

const statusLabels: Record<string, string> = {
  PUBLISHED: 'PUBLICADO',
  DRAFT: 'BORRADOR',
  ARCHIVED: 'ARCHIVADO',
};

export function Dashboard() {
  const { people, fetchPeople } = usePeopleStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { schedules, fetchSchedules } = useScheduleStore();
  const [loading, setLoading] = useState(false);
  const [testDataMessage, setTestDataMessage] = useState('');

  useEffect(() => {
    fetchPeople();
    fetchJobs();
    fetchSchedules();
  }, []);

  const loadTestData = async () => {
    setLoading(true);
    setTestDataMessage('Cargando datos...');
    try {
      // Import people from CSV
      const csvPath = '/Users/chzelada/Documents/GitHub/people_scheduler/test_data/voluntarios.csv';
      const importResult = await invoke<string>('import_test_data', { csvPath });
      setTestDataMessage(importResult);

      // Generate schedules for 2026
      const scheduleResult = await invoke<string>('generate_year_schedules', { year: 2026 });
      setTestDataMessage(prev => `${prev}\n${scheduleResult}`);

      // Refresh data
      await fetchPeople();
      await fetchJobs();
      await fetchSchedules();
    } catch (error) {
      setTestDataMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const activePeople = people.filter((p) => p.active).length;
  const publishedSchedules = schedules.filter((s) => s.status === 'PUBLISHED').length;
  const draftSchedules = schedules.filter((s) => s.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>
        <p className="text-gray-500 mt-1">Resumen de la programación de voluntarios</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Voluntarios Activos"
          value={activePeople}
          icon={<Users className="w-6 h-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <StatCard
          title="Servicios"
          value={jobs.filter((j) => j.active).length}
          icon={<Calendar className="w-6 h-6 text-green-600" />}
          color="bg-green-100"
        />
        <StatCard
          title="Horarios Publicados"
          value={publishedSchedules}
          icon={<CheckCircle className="w-6 h-6 text-purple-600" />}
          color="bg-purple-100"
        />
        <StatCard
          title="Borradores"
          value={draftSchedules}
          icon={<AlertTriangle className="w-6 h-6 text-yellow-600" />}
          color="bg-yellow-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Resumen de Servicios</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {jobs.map((job) => {
                const assignedPeople = people.filter((p) =>
                  p.active && p.job_ids.includes(job.id)
                ).length;

                return (
                  <div key={job.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: job.color }}
                      />
                      <span className="text-sm font-medium text-gray-900">{job.name}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {assignedPeople} voluntarios / {job.people_required} requeridos
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Horarios Recientes</h2>
          </div>
          <div className="p-6">
            {schedules.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay horarios creados aún
              </p>
            ) : (
              <div className="space-y-3">
                {schedules.slice(0, 5).map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {schedule.name}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        schedule.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : schedule.status === 'DRAFT'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {statusLabels[schedule.status] || schedule.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <Calendar className="w-8 h-8 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Generar Horario</h3>
            <p className="text-sm text-gray-500 mt-1">
              Crear un nuevo horario mensual
            </p>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <Users className="w-8 h-8 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Agregar Voluntario</h3>
            <p className="text-sm text-gray-500 mt-1">
              Registrar un nuevo voluntario
            </p>
          </button>
          <button className="p-4 text-left border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <AlertTriangle className="w-8 h-8 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Marcar Ausencia</h3>
            <p className="text-sm text-gray-500 mt-1">
              Registrar tiempo libre para voluntarios
            </p>
          </button>
        </div>
      </div>

      {/* Test Data Section - Temporary for development */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-yellow-800 mb-4">Datos de Prueba (Desarrollo)</h2>
        <div className="flex items-start gap-4">
          <button
            onClick={loadTestData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="w-5 h-5" />
            {loading ? 'Cargando...' : 'Cargar CSV + Generar 2026'}
          </button>
          {testDataMessage && (
            <pre className="text-sm text-yellow-800 bg-yellow-100 p-3 rounded flex-1 whitespace-pre-wrap">
              {testDataMessage}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
