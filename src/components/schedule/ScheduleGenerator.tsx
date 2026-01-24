import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Select, Input } from '../common';
import { scheduleApi } from '../../services/api';
import type { GenerateScheduleRequest } from '../../types';

interface ScheduleGeneratorProps {
  onGenerate: (request: GenerateScheduleRequest) => Promise<void>;
  isLoading?: boolean;
}

const months = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export function ScheduleGenerator({ onGenerate, isLoading }: ScheduleGeneratorProps) {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [name, setName] = useState('');
  const [existingSchedule, setExistingSchedule] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const checkExisting = async () => {
      setChecking(true);
      try {
        const schedule = await scheduleApi.getByMonth(year, month);
        setExistingSchedule(schedule ? schedule.name : null);
      } catch {
        setExistingSchedule(null);
      }
      setChecking(false);
    };
    checkExisting();
  }, [year, month]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (existingSchedule) return;
    await onGenerate({
      year,
      month,
      name: name || undefined,
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() + i - 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Mes"
          value={month.toString()}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          options={months}
        />
        <Select
          label="Año"
          value={year.toString()}
          onChange={(e) => setYear(parseInt(e.target.value))}
          options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
        />
      </div>

      {existingSchedule && (
        <div className="flex items-start space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Ya existe un horario para este período</p>
            <p className="text-amber-700 mt-1">
              El horario "<span className="font-medium">{existingSchedule}</span>" ya fue creado para {months[month - 1].label} {year}.
            </p>
            <p className="text-amber-700 mt-1">
              Si desea crear uno nuevo, primero debe eliminar el existente.
            </p>
          </div>
        </div>
      )}

      <Input
        label="Nombre del Horario (opcional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`${months[month - 1].label} ${year}`}
      />

      <Button
        type="submit"
        isLoading={isLoading || checking}
        className="w-full"
        disabled={!!existingSchedule}
      >
        {existingSchedule ? 'Horario Ya Existe' : 'Generar Horario'}
      </Button>
    </form>
  );
}
