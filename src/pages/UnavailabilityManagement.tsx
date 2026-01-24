import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button, Modal, Input, Textarea, Table } from '../components/common';
import { useUnavailabilityStore } from '../stores/unavailabilityStore';
import { usePeopleStore } from '../stores/peopleStore';
import type { Unavailability } from '../types';

export function UnavailabilityManagement() {
  const { unavailability, fetchAll, create, delete: deleteUnavailability, isLoading } = useUnavailabilityStore();
  const { people, fetchPeople } = usePeopleStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    person_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    recurring: false,
  });

  useEffect(() => {
    fetchAll();
    fetchPeople();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create({
      person_id: formData.person_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason || undefined,
      recurring: formData.recurring,
    });
    setIsModalOpen(false);
    setPersonSearchQuery('');
    setFormData({
      person_id: '',
      start_date: '',
      end_date: '',
      reason: '',
      recurring: false,
    });
  };

  const handleDelete = async (record: Unavailability) => {
    if (window.confirm('¿Eliminar este registro de ausencia?')) {
      await deleteUnavailability(record.id);
    }
  };

  const columns = [
    {
      key: 'person',
      header: 'Persona',
      render: (record: Unavailability) => (
        <span className="font-medium">{record.person_name || record.person_id}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Fechas',
      render: (record: Unavailability) => (
        <span>
          {format(parseISO(record.start_date), "d 'de' MMM, yyyy", { locale: es })} - {format(parseISO(record.end_date), "d 'de' MMM, yyyy", { locale: es })}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (record: Unavailability) => (
        <span className="text-gray-500">{record.reason || '-'}</span>
      ),
    },
    {
      key: 'recurring',
      header: 'Recurrente',
      render: (record: Unavailability) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          record.recurring ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {record.recurring ? 'Sí' : 'No'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (record: Unavailability) => (
        <button
          onClick={() => handleDelete(record)}
          className="text-gray-400 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const activePeople = people.filter((p) => p.active);

  const filteredPeople = activePeople.filter((person) =>
    `${person.first_name} ${person.last_name}`.toLowerCase().includes(personSearchQuery.toLowerCase())
  );

  const selectedPerson = activePeople.find((p) => p.id === formData.person_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ausencias</h1>
          <p className="text-gray-500 mt-1">Registrar cuando los voluntarios no están disponibles</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Ausencia
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table
          columns={columns}
          data={unavailability}
          keyExtractor={(record) => record.id}
          emptyMessage="No hay registros de ausencia. Haga clic en 'Agregar Ausencia' para crear uno."
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPersonSearchQuery('');
        }}
        title="Agregar Ausencia"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Persona</label>
            {selectedPerson ? (
              <div className="flex items-center justify-between p-2 bg-primary-50 border border-primary-200 rounded-lg">
                <span className="font-medium text-primary-800">
                  {selectedPerson.first_name} {selectedPerson.last_name}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, person_id: '' })}
                  className="text-primary-600 hover:text-primary-800 text-sm"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar persona..."
                    value={personSearchQuery}
                    onChange={(e) => setPersonSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredPeople.length > 0 ? (
                    filteredPeople.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, person_id: person.id });
                          setPersonSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                      >
                        {person.first_name} {person.last_name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No se encontraron personas
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha de Inicio"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="Fecha de Fin"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Motivo (opcional)"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            rows={2}
          />

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.recurring}
              onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Recurrente anualmente (ej. vacaciones en las mismas fechas cada año)
            </span>
          </label>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => {
              setIsModalOpen(false);
              setPersonSearchQuery('');
            }}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Agregar Ausencia
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
