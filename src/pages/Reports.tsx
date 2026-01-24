import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button, Select } from '../components/common';
import { FairnessReport } from '../components/reports';
import { useScheduleStore } from '../stores/scheduleStore';

export function Reports() {
  const { fairnessScores, fetchFairnessScores, isLoading } = useScheduleStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    fetchFairnessScores(selectedYear);
  }, [selectedYear]);

  const handleRefresh = () => {
    fetchFairnessScores(selectedYear);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 mt-1">Ver estadísticas de asignaciones y métricas de equidad</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
          />
          <Button variant="secondary" onClick={handleRefresh} isLoading={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <FairnessReport scores={fairnessScores} year={selectedYear} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de Estadísticas</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Total de Voluntarios Registrados</span>
              <span className="font-medium">{fairnessScores.length}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Total de Asignaciones ({selectedYear})</span>
              <span className="font-medium">
                {fairnessScores.reduce((sum, s) => sum + s.assignments_this_year, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Total Monaguillos ({selectedYear})</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-blue-100 text-blue-800">
                {fairnessScores.reduce((sum, s) => {
                  const job = s.assignments_by_job?.find(j => j.job_name.toLowerCase() === 'monaguillos');
                  return sum + (job?.count || 0);
                }, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Total Lectores ({selectedYear})</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-green-100 text-green-800">
                {fairnessScores.reduce((sum, s) => {
                  const job = s.assignments_by_job?.find(j => j.job_name.toLowerCase() === 'lectores');
                  return sum + (job?.count || 0);
                }, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Promedio por Persona</span>
              <span className="font-medium">
                {fairnessScores.length > 0
                  ? (fairnessScores.reduce((sum, s) => sum + s.assignments_this_year, 0) / fairnessScores.length).toFixed(1)
                  : 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Mayor Cantidad de Asignaciones</span>
              <span className="font-medium">
                {Math.max(...fairnessScores.map((s) => s.assignments_this_year), 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Menor Cantidad de Asignaciones</span>
              <span className="font-medium">
                {fairnessScores.length > 0
                  ? Math.min(...fairnessScores.map((s) => s.assignments_this_year))
                  : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Entendiendo la Equidad</h3>
          <div className="prose prose-sm text-gray-600">
            <p>
              La puntuación de equidad ayuda a asegurar una distribución equitativa de las asignaciones
              entre los voluntarios. El algoritmo considera:
            </p>
            <ul className="mt-2 space-y-1">
              <li><strong>Cantidad de Asignaciones (70%):</strong> Menos asignaciones = mayor prioridad</li>
              <li><strong>Recencia (20%):</strong> Más tiempo desde la última asignación = mayor prioridad</li>
              <li><strong>Preferencia (10%):</strong> Nivel de preferencia configurado de la persona</li>
            </ul>
            <p className="mt-4">
              Los voluntarios con menos asignaciones tienen prioridad al generar nuevos
              horarios para mantener una distribución equitativa a lo largo del tiempo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
