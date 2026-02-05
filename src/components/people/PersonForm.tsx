import React, { useState, useEffect } from 'react';
import { Key, UserPlus } from 'lucide-react';
import { Button, Input, Select, Textarea, PhotoUpload } from '../common';
import type { Person, CreatePersonRequest, UpdatePersonRequest, Job } from '../../types';

interface PersonFormProps {
  person?: Person | null;
  jobs: Job[];
  onSubmit: (data: CreatePersonRequest | UpdatePersonRequest) => Promise<void>;
  onCancel: () => void;
  onResetPassword?: (person: Person) => void;
  onCreateUser?: (person: Person) => void;
  onUploadPhoto?: (personId: string, photoData: string) => Promise<void>;
  onDeletePhoto?: (personId: string) => Promise<void>;
  isLoading?: boolean;
}

export function PersonForm({ person, jobs, onSubmit, onCancel, onResetPassword, onCreateUser, onUploadPhoto, onDeletePhoto, isLoading }: PersonFormProps) {
  const [formData, setFormData] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    preferred_frequency: 'weekly' | 'bimonthly' | 'monthly';
    max_consecutive_weeks: number;
    preference_level: number;
    notes: string;
    job_ids: string[];
    birth_date: string;
    first_communion: boolean;
    parent_name: string;
    address: string;
    photo_consent: boolean;
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    preferred_frequency: 'bimonthly',
    max_consecutive_weeks: 2,
    preference_level: 5,
    notes: '',
    job_ids: [],
    birth_date: '',
    first_communion: false,
    parent_name: '',
    address: '',
    photo_consent: false,
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
        birth_date: person.birth_date || '',
        first_communion: person.first_communion || false,
        parent_name: person.parent_name || '',
        address: person.address || '',
        photo_consent: person.photo_consent || false,
      });
    }
  }, [person]);

  // Calculate age from birth date
  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clean up form data - convert empty strings to undefined for optional fields
    const cleanedData = {
      ...formData,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      notes: formData.notes || undefined,
      birth_date: formData.birth_date || undefined,
      parent_name: formData.parent_name || undefined,
      address: formData.address || undefined,
    };

    const data = person
      ? { id: person.id, ...cleanedData }
      : cleanedData;

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

      {/* Additional servidor information */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Información Personal</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="Fecha de Nacimiento"
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            />
            {formData.birth_date && (
              <p className="mt-1 text-sm text-gray-500">
                Edad: {calculateAge(formData.birth_date)} años
              </p>
            )}
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.first_communion}
                onChange={(e) => setFormData({ ...formData, first_communion: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Primera Comunión Completada</span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <Input
            label="Nombre del Padre/Tutor"
            value={formData.parent_name}
            onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
            placeholder="Nombre completo del padre o tutor"
          />
        </div>

        <div className="mt-4">
          <Textarea
            label="Dirección"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={2}
            placeholder="Dirección completa"
          />
        </div>
      </div>

      {/* Photo consent section */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Consentimiento de Fotografía</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={formData.photo_consent}
              onChange={(e) => setFormData({ ...formData, photo_consent: e.target.checked })}
              className="h-4 w-4 mt-1 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-3 text-sm text-gray-700">
              Por este medio doy mi expresa autorización para que las fotografías de las Eucaristías
              en que participe el menor, puedan ser publicadas en las redes sociales o comunicaciones
              internas de la Parroquia con el único propósito de dar visibilidad a las actividades pastorales.
            </span>
          </label>
        </div>
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

      {/* Photo section - only for editing existing person */}
      {person && onUploadPhoto && onDeletePhoto && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Foto de Perfil
          </label>
          <PhotoUpload
            photoUrl={person.photo_url}
            firstName={person.first_name}
            lastName={person.last_name}
            onUpload={(photoData) => onUploadPhoto(person.id, photoData)}
            onDelete={() => onDeletePhoto(person.id)}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Account management section - only for editing existing person */}
      {person && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cuenta de Usuario
          </label>
          {person.username ? (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div>
                <span className="text-sm text-gray-500">Usuario: </span>
                <code className="font-mono font-medium text-gray-900">@{person.username}</code>
              </div>
              {onResetPassword && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onResetPassword(person)}
                >
                  <Key className="w-4 h-4 mr-1" />
                  Resetear Contraseña
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <span className="text-sm text-yellow-800">
                Este servidor no tiene cuenta de usuario
              </span>
              {onCreateUser && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onCreateUser(person)}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Crear Cuenta
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {person ? 'Actualizar' : 'Crear'} Servidor
        </Button>
      </div>
    </form>
  );
}
