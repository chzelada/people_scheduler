import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { Button, Input, Modal, Table } from '../components/common';
import { useJobsStore } from '../stores/jobsStore';
import type { Job, CreateJobRequest, UpdateJobRequest } from '../types';

export function Settings() {
  const { jobs, fetchJobs, createJob, updateJob, deleteJob, isLoading } = useJobsStore();
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobForm, setJobForm] = useState({
    name: '',
    description: '',
    people_required: 4,
    color: '#3B82F6',
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingJob) {
      await updateJob({
        id: editingJob.id,
        ...jobForm,
      });
    } else {
      await createJob(jobForm);
    }
    closeJobModal();
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
    setJobForm({
      name: job.name,
      description: job.description || '',
      people_required: job.people_required,
      color: job.color,
    });
    setIsJobModalOpen(true);
  };

  const handleDeleteJob = async (job: Job) => {
    if (window.confirm(`¿Eliminar el servicio "${job.name}"? Esto puede afectar horarios existentes.`)) {
      await deleteJob(job.id);
    }
  };

  const closeJobModal = () => {
    setIsJobModalOpen(false);
    setEditingJob(null);
    setJobForm({
      name: '',
      description: '',
      people_required: 4,
      color: '#3B82F6',
    });
  };

  const jobColumns = [
    {
      key: 'color',
      header: '',
      render: (job: Job) => (
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: job.color }}
        />
      ),
      className: 'w-12',
    },
    {
      key: 'name',
      header: 'Nombre',
      render: (job: Job) => <span className="font-medium">{job.name}</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (job: Job) => (
        <span className="text-gray-500">{job.description || '-'}</span>
      ),
    },
    {
      key: 'required',
      header: 'Personas Requeridas',
      render: (job: Job) => job.people_required,
    },
    {
      key: 'active',
      header: 'Estado',
      render: (job: Job) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            job.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {job.active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (job: Job) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleEditJob(job)}
            className="text-gray-400 hover:text-primary-600"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteJob(job)}
            className="text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Configurar servicios y ajustes de la aplicación</p>
      </div>

      {/* Jobs Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Servicios</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configurar los tipos de posiciones de voluntarios
            </p>
          </div>
          <Button onClick={() => setIsJobModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Servicio
          </Button>
        </div>
        <Table
          columns={jobColumns}
          data={jobs}
          keyExtractor={(job) => job.id}
          emptyMessage="No hay servicios configurados. Agregue el primero para comenzar."
        />
      </div>

      {/* App Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Acerca de</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Programador de Voluntarios</strong></p>
          <p>Versión 0.1.0</p>
          <p>Una aplicación de programación de voluntarios para iglesias con algoritmos de distribución equitativa.</p>
          <p className="mt-4">
            Los datos se almacenan localmente en una base de datos DuckDB en el directorio de datos de la aplicación.
          </p>
        </div>
      </div>

      {/* Job Modal */}
      <Modal
        isOpen={isJobModalOpen}
        onClose={closeJobModal}
        title={editingJob ? 'Editar Servicio' : 'Agregar Servicio'}
      >
        <form onSubmit={handleJobSubmit} className="space-y-4">
          <Input
            label="Nombre del Servicio"
            value={jobForm.name}
            onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
            placeholder="ej. Lectores"
            required
          />

          <Input
            label="Descripción"
            value={jobForm.description}
            onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
            placeholder="ej. Lectores de las escrituras"
          />

          <Input
            label="Personas Requeridas"
            type="number"
            min={1}
            max={20}
            value={jobForm.people_required}
            onChange={(e) => setJobForm({ ...jobForm, people_required: parseInt(e.target.value) })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={jobForm.color}
                onChange={(e) => setJobForm({ ...jobForm, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <Input
                value={jobForm.color}
                onChange={(e) => setJobForm({ ...jobForm, color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeJobModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              {editingJob ? 'Actualizar' : 'Crear'} Servicio
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
