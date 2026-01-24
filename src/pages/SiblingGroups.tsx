import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Users, Search } from 'lucide-react';
import { Button, Modal, Input, Select, Table } from '../components/common';
import { siblingApi } from '../services/api';
import { usePeopleStore } from '../stores/peopleStore';
import type { SiblingGroup, CreateSiblingGroupRequest, PairingRule } from '../types';

const pairingRuleLabels: Record<string, string> = {
  TOGETHER: 'JUNTOS',
  SEPARATE: 'SEPARADOS',
};

export function SiblingGroups() {
  const { people, fetchPeople } = usePeopleStore();
  const [groups, setGroups] = useState<SiblingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SiblingGroup | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    pairing_rule: 'TOGETHER' as PairingRule,
    member_ids: [] as string[],
  });
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchPeople();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const data = await siblingApi.getAll();
      setGroups(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingGroup) {
        await siblingApi.update({
          id: editingGroup.id,
          ...formData,
        });
      } else {
        await siblingApi.create(formData);
      }
      await fetchGroups();
      closeModal();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (group: SiblingGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      pairing_rule: group.pairing_rule,
      member_ids: group.member_ids,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (group: SiblingGroup) => {
    if (window.confirm(`¿Eliminar el grupo familiar "${group.name}"?`)) {
      setIsLoading(true);
      try {
        await siblingApi.delete(group.id);
        await fetchGroups();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
    setFormData({
      name: '',
      pairing_rule: 'TOGETHER',
      member_ids: [],
    });
    setMemberSearchQuery('');
  };

  const toggleMember = (personId: string) => {
    setFormData((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(personId)
        ? prev.member_ids.filter((id) => id !== personId)
        : [...prev.member_ids, personId],
    }));
  };

  const getPersonName = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    return person ? `${person.first_name} ${person.last_name}` : personId;
  };

  const columns = [
    {
      key: 'name',
      header: 'Nombre del Grupo',
      render: (group: SiblingGroup) => (
        <div className="flex items-center">
          <Users className="w-4 h-4 text-gray-400 mr-2" />
          <span className="font-medium">{group.name}</span>
        </div>
      ),
    },
    {
      key: 'members',
      header: 'Miembros',
      render: (group: SiblingGroup) => (
        <div className="flex flex-wrap gap-1">
          {group.member_ids.map((id) => (
            <span
              key={id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
            >
              {getPersonName(id)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'rule',
      header: 'Regla de Emparejamiento',
      render: (group: SiblingGroup) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            group.pairing_rule === 'TOGETHER'
              ? 'bg-green-100 text-green-800'
              : 'bg-orange-100 text-orange-800'
          }`}
        >
          {pairingRuleLabels[group.pairing_rule] || group.pairing_rule}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (group: SiblingGroup) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleEdit(group)}
            className="text-gray-400 hover:text-primary-600"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(group)}
            className="text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const activePeople = people.filter((p) => p.active);

  const filteredPeople = activePeople.filter((person) =>
    `${person.first_name} ${person.last_name}`.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grupos Familiares</h1>
          <p className="text-gray-500 mt-1">Administrar agrupaciones familiares y reglas de emparejamiento</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Grupo
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table
          columns={columns}
          data={groups}
          keyExtractor={(group) => group.id}
          emptyMessage="No hay grupos familiares. Haga clic en 'Agregar Grupo' para crear uno."
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800">Acerca de las Reglas de Emparejamiento</h3>
        <ul className="mt-2 text-sm text-blue-700 space-y-1">
          <li><strong>JUNTOS:</strong> Los hermanos serán programados en las mismas fechas cuando sea posible</li>
          <li><strong>SEPARADOS:</strong> Los hermanos no serán programados en las mismas fechas</li>
        </ul>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingGroup ? 'Editar Grupo Familiar' : 'Agregar Grupo Familiar'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre del Grupo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="ej. Familia Pérez"
            required
          />

          <Select
            label="Regla de Emparejamiento"
            value={formData.pairing_rule}
            onChange={(e) => setFormData({ ...formData, pairing_rule: e.target.value as PairingRule })}
            options={[
              { value: 'TOGETHER', label: 'Juntos - Programar hermanos en las mismas fechas' },
              { value: 'SEPARATE', label: 'Separados - Nunca programar hermanos juntos' },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Miembros ({formData.member_ids.length} seleccionados)
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Buscar personas..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
              {filteredPeople.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">No se encontraron personas</p>
              ) : (
                filteredPeople.map((person) => (
                  <label key={person.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={formData.member_ids.includes(person.id)}
                      onChange={() => toggleMember(person.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {person.first_name} {person.last_name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {editingGroup ? 'Actualizar' : 'Crear'} Grupo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
