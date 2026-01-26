import React, { useEffect, useState } from 'react';
import { Key, Save } from 'lucide-react';
import { Button, Input, Table, Modal } from '../components/common';
import { useJobsStore } from '../stores/jobsStore';
import { useAuthStore } from '../stores/authStore';
import type { Job } from '../types';

export function Settings() {
  const { jobs, fetchJobs } = useJobsStore();
  const { changePassword, isLoading, error, clearError } = useAuthStore();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(String(err));
    }
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess(false);
    clearError();
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
      header: 'Servidores Requeridos',
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Configurar servicios y ajustes de la aplicación</p>
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Cuenta</h2>
        <Button onClick={() => setIsPasswordModalOpen(true)}>
          <Key className="w-4 h-4 mr-2" />
          Cambiar Contraseña
        </Button>
      </div>

      {/* Jobs Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Servicios</h2>
            <p className="text-sm text-gray-500 mt-1">
              Servicios predefinidos de voluntarios
            </p>
          </div>
        </div>
        <Table
          columns={jobColumns}
          data={jobs}
          keyExtractor={(job) => job.id}
          emptyMessage="No hay servicios configurados."
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
            Los datos se almacenan en la nube usando PostgreSQL.
          </p>
        </div>
      </div>

      {/* Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        title="Cambiar Contraseña"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              Contraseña cambiada exitosamente
            </div>
          )}

          {(passwordError || error) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {passwordError || error}
            </div>
          )}

          <Input
            label="Contraseña Actual"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            required
          />

          <Input
            label="Nueva Contraseña"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            required
          />

          <Input
            label="Confirmar Nueva Contraseña"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            required
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closePasswordModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
