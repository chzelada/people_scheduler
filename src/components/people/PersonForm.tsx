import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Textarea } from '../common';
import type { Person, CreatePersonRequest, UpdatePersonRequest, Job } from '../../types';

interface PersonFormProps {
  person?: Person | null;
  jobs: Job[];
  onSubmit: (data: CreatePersonRequest | UpdatePersonRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PersonForm({ person, jobs, onSubmit, onCancel, isLoading }: PersonFormProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    preferred_frequency: 'bimonthly' as const,
    max_consecutive_weeks: 2,
    preference_level: 5,
    notes: '',
    job_ids: [] as string[],
  });

  useEffect(() => {
    if (person) {
      setFormData({
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email || '',
        phone: person.phone || '',
        preferred_frequency: person.preferred_frequency,
        max_consecutive_weeks: person.max_consecutive_weeks,
        preference_level: person.preference_level,
        notes: person.notes || '',
        job_ids: person.job_ids,
      });
    }
  }, [person]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = person
      ? { id: person.id, ...formData }
      : formData;

    await onSubmit(data);
  };

  const handleJobToggle = (jobId: string) => {
    setFormData((prev) => ({
      ...prev,
      job_ids: prev.job_ids.includes(jobId)
        ? prev.job_ids.filter((id) => id !== jobId)
        : [...prev.job_ids, jobId],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nombre"
          value={formData.first_name}
          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
          required
        />
        <Input
          label="Apellido"
          value={formData.last_name}
          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Correo Electrónico"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <Input
          label="Teléfono"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <Select
        label="Frecuencia Preferida"
        value={formData.preferred_frequency}
        onChange={(e) => setFormData({ ...formData, preferred_frequency: e.target.value as 'weekly' | 'bimonthly' | 'monthly' })}
        options={[
          { value: 'weekly', label: 'Semanal' },
          { value: 'bimonthly', label: 'Quincenal (Cada 2 semanas)' },
          { value: 'monthly', label: 'Mensual' },
        ]}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Máximo Semanas Consecutivas"
          type="number"
          min={1}
          max={10}
          value={formData.max_consecutive_weeks}
          onChange={(e) => setFormData({ ...formData, max_consecutive_weeks: parseInt(e.target.value) })}
        />
        <Input
          label="Nivel de Preferencia (1-10)"
          type="number"
          min={1}
          max={10}
          value={formData.preference_level}
          onChange={(e) => setFormData({ ...formData, preference_level: parseInt(e.target.value) })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Servicios
        </label>
        <div className="space-y-2">
          {jobs.map((job) => (
            <label key={job.id} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.job_ids.includes(job.id)}
                onChange={() => handleJobToggle(job.id)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{job.name}</span>
              <span
                className="ml-2 w-3 h-3 rounded-full"
                style={{ backgroundColor: job.color }}
              />
            </label>
          ))}
        </div>
      </div>

      <Textarea
        label="Notas"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        rows={3}
      />

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {person ? 'Actualizar' : 'Crear'} Persona
        </Button>
      </div>
    </form>
  );
}
