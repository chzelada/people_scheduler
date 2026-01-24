import React from 'react';
import { Edit, Trash2, Check, X } from 'lucide-react';
import { Table, Button } from '../common';
import type { Person, Job } from '../../types';

interface PersonListProps {
  people: Person[];
  jobs: Job[];
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
}

const frequencyLabels: Record<string, string> = {
  weekly: 'Semanal',
  bimonthly: 'Quincenal',
  monthly: 'Mensual',
};

export function PersonList({ people, jobs, onEdit, onDelete }: PersonListProps) {
  const getJobNames = (jobIds: string[]) => {
    return jobIds
      .map((id) => jobs.find((j) => j.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (person: Person) => (
        <div>
          <div className="font-medium">{person.first_name} {person.last_name}</div>
          <div className="text-gray-500 text-xs">{person.email}</div>
        </div>
      ),
    },
    {
      key: 'jobs',
      header: 'Servicios',
      render: (person: Person) => (
        <div className="flex flex-wrap gap-1">
          {person.job_ids.map((jobId) => {
            const job = jobs.find((j) => j.id === jobId);
            if (!job) return null;
            return (
              <span
                key={jobId}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: job.color }}
              >
                {job.name}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: 'frequency',
      header: 'Frecuencia',
      render: (person: Person) => (
        <span>{frequencyLabels[person.preferred_frequency] || person.preferred_frequency}</span>
      ),
    },
    {
      key: 'active',
      header: 'Activo',
      render: (person: Person) => (
        person.active ? (
          <Check className="w-5 h-5 text-green-500" />
        ) : (
          <X className="w-5 h-5 text-red-500" />
        )
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (person: Person) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(person); }}
            className="text-gray-400 hover:text-primary-600"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(person); }}
            className="text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={people}
      keyExtractor={(person) => person.id}
      emptyMessage="No hay personas registradas. Haga clic en 'Agregar Persona' para comenzar."
    />
  );
}
