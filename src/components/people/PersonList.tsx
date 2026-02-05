import React from 'react';
import { Edit, Trash2, Check, X, Key, UserPlus } from 'lucide-react';
import { Table, Button, Avatar } from '../common';
import type { Person, Job } from '../../types';

interface PersonListProps {
  people: Person[];
  jobs: Job[];
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  onResetPassword?: (person: Person) => void;
  onCreateUser?: (person: Person) => void;
  onToggleExclusion?: (personId: string, field: 'exclude_monaguillos' | 'exclude_lectores', value: boolean) => void;
  onViewDetail?: (person: Person) => void;
}

const frequencyLabels: Record<string, string> = {
  weekly: 'Semanal',
  bimonthly: 'Quincenal',
  monthly: 'Mensual',
};

export function PersonList({ people, jobs, onEdit, onDelete, onResetPassword, onCreateUser, onToggleExclusion, onViewDetail }: PersonListProps) {
  const getJobNames = (jobIds: string[]) => {
    return jobIds
      .map((id) => jobs.find((j) => j.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Check if the person is qualified for a job type
  const hasJob = (person: Person, jobName: string) => {
    return person.job_ids.some(id => {
      const job = jobs.find(j => j.id === id);
      return job?.name.toLowerCase().includes(jobName.toLowerCase());
    });
  };

  const columns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (person: Person) => (
        <div className="flex items-center space-x-3">
          <Avatar
            photoUrl={person.photo_url}
            firstName={person.first_name}
            lastName={person.last_name}
            size="sm"
          />
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetail?.(person);
              }}
              className="font-medium text-left hover:text-primary-600 hover:underline focus:outline-none focus:text-primary-600"
            >
              {person.first_name} {person.last_name}
            </button>
            {person.username && (
              <div className="text-gray-500 text-xs font-mono">@{person.username}</div>
            )}
          </div>
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
      key: 'exclude_monaguillos',
      header: 'Asignar M',
      headerTitle: 'Asignar como Monaguillo',
      render: (person: Person) => {
        const isQualified = hasJob(person, 'monaguillo');
        if (!isQualified) return <span className="text-gray-300">-</span>;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExclusion?.(person.id, 'exclude_monaguillos', !person.exclude_monaguillos);
            }}
            className={`w-8 h-5 rounded-full transition-colors relative ${
              !person.exclude_monaguillos ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={person.exclude_monaguillos ? 'Excluido de Monaguillos' : 'Activo para Monaguillos'}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                !person.exclude_monaguillos ? 'left-3.5' : 'left-0.5'
              }`}
            />
          </button>
        );
      },
    },
    {
      key: 'exclude_lectores',
      header: 'Asignar L',
      headerTitle: 'Asignar como Lector',
      render: (person: Person) => {
        const isQualified = hasJob(person, 'lector');
        if (!isQualified) return <span className="text-gray-300">-</span>;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExclusion?.(person.id, 'exclude_lectores', !person.exclude_lectores);
            }}
            className={`w-8 h-5 rounded-full transition-colors relative ${
              !person.exclude_lectores ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={person.exclude_lectores ? 'Excluido de Lectores' : 'Activo para Lectores'}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                !person.exclude_lectores ? 'left-3.5' : 'left-0.5'
              }`}
            />
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (person: Person) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(person); }}
            className="text-gray-400 hover:text-primary-600"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          {onCreateUser && !person.username && (
            <button
              onClick={(e) => { e.stopPropagation(); onCreateUser(person); }}
              className="text-gray-400 hover:text-green-600"
              title="Crear cuenta de usuario"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          {onResetPassword && person.username && (
            <button
              onClick={(e) => { e.stopPropagation(); onResetPassword(person); }}
              className="text-gray-400 hover:text-orange-600"
              title="Resetear contraseña"
            >
              <Key className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(person); }}
            className="text-gray-400 hover:text-red-600"
            title="Eliminar"
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
      emptyMessage="No hay servidores registrados. Haga clic en 'Agregar Servidor' para comenzar."
    />
  );
}
