import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button, Modal, Textarea, Table } from '../components/common';
import { useUnavailabilityStore } from '../stores/unavailabilityStore';
import { usePeopleStore } from '../stores/peopleStore';
import type { Unavailability } from '../types';

const months = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export function UnavailabilityManagement() {
  const { unavailability, fetchAll, create, delete: deleteUnavailability, isLoading } = useUnavailabilityStore();
  const { people, fetchPeople } = usePeopleStore();

  const today = new Date();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedSundays, setSelectedSundays] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    person_id: '',
    reason: '',
    recurring: false,
  });

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 1 + i);

  useEffect(() => {
    fetchAll();
    fetchPeople();
  }, []);

  // Get all Sundays for the selected month
  const getSundaysInMonth = (): Date[] => {
    const start = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const end = endOfMonth(new Date(selectedYear, selectedMonth - 1));
    const sundays: Date[] = [];

    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });
    for (const weekStart of weeks) {
      if (weekStart >= start && weekStart <= end) {
        sundays.push(weekStart);
      }
    }

    return sundays;
  };

  const sundaysInMonth = getSundaysInMonth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create one unavailability record per selected Sunday
    for (const sundayDate of selectedSundays) {
      await create({
        person_id: formData.person_id,
        start_date: sundayDate,
        end_date: sundayDate,
        reason: formData.reason || undefined,
        recurring: formData.recurring,
      });
    }

    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPersonSearchQuery('');
    setSelectedSundays([]);
    setFormData({
      person_id: '',
      reason: '',
      recurring: false,
    });
  };

  const handleDelete = async (record: Unavailability) => {
    await deleteUnavailability(record.id);
  };

  const toggleSunday = (dateStr: string) => {
    setSelectedSundays(prev =>
      prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    );
  };

  const columns = [
    {
      key: 'person',
      header: 'Servidor',
      render: (record: Unavailability) => (
        <span className="font-medium">{record.person_name || record.person_id}</span>
      ),
      getValue: (record: Unavailability) => record.person_name || record.person_id,
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (record: Unavailability) => (
        <span>
          {format(parseISO(record.start_date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </span>
      ),
      getValue: (record: Unavailability) => record.start_date,
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (record: Unavailability) => (
        <span className="text-gray-500">{record.reason || '-'}</span>
      ),
      getValue: (record: Unavailability) => record.reason || '',
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
      getValue: (record: Unavailability) => record.recurring ? 'Sí' : 'No',
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      filterable: false,
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
          enableSorting
          enableFiltering
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Agregar Ausencia"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Person Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servidor</label>
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
                    placeholder="Buscar servidor..."
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
                      No se encontraron servidores
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Month/Year Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setSelectedSundays([]);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setSelectedSundays([]);
                }}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sunday Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Domingos ({selectedSundays.length} seleccionados)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {sundaysInMonth.map((sunday) => {
                const dateStr = format(sunday, 'yyyy-MM-dd');
                const isSelected = selectedSundays.includes(dateStr);
                return (
                  <label
                    key={dateStr}
                    className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-50 border-primary-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSunday(dateStr)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm">
                      {format(sunday, "d 'de' MMMM", { locale: es })}
                    </span>
                  </label>
                );
              })}
            </div>
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
              Recurrente anualmente
            </span>
          </label>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!formData.person_id || selectedSundays.length === 0}
            >
              Agregar {selectedSundays.length > 0 ? `(${selectedSundays.length})` : ''}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
