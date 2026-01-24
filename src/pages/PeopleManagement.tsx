import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search, Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button, Modal, Input } from '../components/common';
import { PersonList, PersonForm } from '../components/people';
import { usePeopleStore } from '../stores/peopleStore';
import { useJobsStore } from '../stores/jobsStore';
import type { Person, CreatePersonRequest, UpdatePersonRequest } from '../types';

interface CsvPerson {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  job_ids?: string[];
}

interface ImportResult {
  success: CsvPerson[];
  duplicates: CsvPerson[];
  errors: { row: number; error: string }[];
}

export function PeopleManagement() {
  const { people, fetchPeople, createPerson, updatePerson, deletePerson, isLoading } = usePeopleStore();
  const { jobs, fetchJobs } = useJobsStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJob, setFilterJob] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  // CSV Import state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPeople();
    fetchJobs();
  }, []);

  const handleCreateOrUpdate = async (data: CreatePersonRequest | UpdatePersonRequest) => {
    if ('id' in data) {
      await updatePerson(data);
    } else {
      await createPerson(data);
    }
    setIsModalOpen(false);
    setEditingPerson(null);
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setIsModalOpen(true);
  };

  const handleDelete = async (person: Person) => {
    if (window.confirm(`¿Está seguro de eliminar a ${person.first_name} ${person.last_name}?`)) {
      await deletePerson(person.id);
    }
  };

  const parseCsv = (text: string): CsvPerson[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const firstNameIdx = headers.findIndex(h => h === 'nombre' || h === 'first_name' || h === 'primer_nombre');
    const lastNameIdx = headers.findIndex(h => h === 'apellido' || h === 'last_name' || h === 'apellidos');
    const emailIdx = headers.findIndex(h => h === 'email' || h === 'correo');
    const phoneIdx = headers.findIndex(h => h === 'telefono' || h === 'phone' || h === 'celular');
    const jobsIdx = headers.findIndex(h => h === 'servicios' || h === 'jobs' || h === 'roles');

    if (firstNameIdx === -1 || lastNameIdx === -1) {
      throw new Error('CSV debe tener columnas "nombre" y "apellido" (o "first_name" y "last_name")');
    }

    const result: CsvPerson[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      if (values.length < 2 || !values[firstNameIdx] || !values[lastNameIdx]) continue;

      const person: CsvPerson = {
        first_name: values[firstNameIdx],
        last_name: values[lastNameIdx],
      };

      if (emailIdx !== -1 && values[emailIdx]) {
        person.email = values[emailIdx];
      }
      if (phoneIdx !== -1 && values[phoneIdx]) {
        person.phone = values[phoneIdx];
      }
      if (jobsIdx !== -1 && values[jobsIdx]) {
        const jobNames = values[jobsIdx].split(';').map(j => j.trim().toLowerCase());
        person.job_ids = jobs
          .filter(j => jobNames.includes(j.name.toLowerCase()))
          .map(j => j.id);
      }

      result.push(person);
    }

    return result;
  };

  const checkDuplicates = (csvPeople: CsvPerson[]): ImportResult => {
    const success: CsvPerson[] = [];
    const duplicates: CsvPerson[] = [];
    const errors: { row: number; error: string }[] = [];

    csvPeople.forEach((csvPerson, index) => {
      const isDuplicate = people.some(
        p => p.first_name.toLowerCase() === csvPerson.first_name.toLowerCase() &&
             p.last_name.toLowerCase() === csvPerson.last_name.toLowerCase()
      );

      if (isDuplicate) {
        duplicates.push(csvPerson);
      } else {
        success.push(csvPerson);
      }
    });

    return { success, duplicates, errors };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const csvPeople = parseCsv(text);

      if (csvPeople.length === 0) {
        alert('No se encontraron datos válidos en el archivo CSV');
        return;
      }

      const result = checkDuplicates(csvPeople);
      setImportResult(result);
      setIsImportModalOpen(true);
    } catch (error) {
      alert(`Error al leer el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!importResult) return;

    setIsImporting(true);
    try {
      for (const person of importResult.success) {
        await createPerson({
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          phone: person.phone,
          job_ids: person.job_ids || [],
        });
      }

      await fetchPeople();
      setIsImportModalOpen(false);
      setImportResult(null);
      alert(`Se importaron ${importResult.success.length} personas exitosamente`);
    } catch (error) {
      alert(`Error durante la importación: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const filteredPeople = people.filter((person) => {
    const matchesSearch =
      person.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesJob = !filterJob || person.job_ids.includes(filterJob);
    const matchesActive = showInactive || person.active;

    return matchesSearch && matchesJob && matchesActive;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Personas</h1>
          <p className="text-gray-500 mt-1">Administrar voluntarios y sus asignaciones</p>
        </div>
        <div className="flex space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button onClick={() => { setEditingPerson(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Persona
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="pl-10"
              />
            </div>
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos los Servicios</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.name}</option>
              ))}
            </select>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Mostrar Inactivos</span>
            </label>
          </div>
        </div>

        <PersonList
          people={filteredPeople}
          jobs={jobs}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        <div className="px-6 py-4 border-t border-gray-200 text-sm text-gray-500">
          Mostrando {filteredPeople.length} de {people.length} personas
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPerson(null); }}
        title={editingPerson ? 'Editar Persona' : 'Agregar Persona'}
        size="lg"
      >
        <PersonForm
          person={editingPerson}
          jobs={jobs}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => { setIsModalOpen(false); setEditingPerson(null); }}
          isLoading={isLoading}
        />
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setImportResult(null); }}
        title="Importar Personas desde CSV"
        size="lg"
      >
        {importResult && (
          <div className="space-y-4">
            {/* Success section */}
            {importResult.success.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <h3 className="font-medium text-green-800">
                    {importResult.success.length} personas listas para importar
                  </h3>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="text-sm text-green-700 space-y-1">
                    {importResult.success.map((p, i) => (
                      <li key={i}>• {p.first_name} {p.last_name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Duplicates section */}
            {importResult.duplicates.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <h3 className="font-medium text-yellow-800">
                    {importResult.duplicates.length} duplicados encontrados (serán omitidos)
                  </h3>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {importResult.duplicates.map((p, i) => (
                      <li key={i}>• {p.first_name} {p.last_name} - Ya existe en el sistema</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* No valid records */}
            {importResult.success.length === 0 && importResult.duplicates.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <X className="w-5 h-5 text-red-600 mr-2" />
                  <p className="text-red-800">
                    Todas las personas en el archivo ya existen en el sistema.
                  </p>
                </div>
              </div>
            )}

            {/* CSV Format Help */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-2">Formato del archivo CSV:</h4>
              <code className="text-xs bg-gray-100 p-2 rounded block">
                nombre,apellido,email,telefono,servicios<br/>
                Juan,Pérez,juan@email.com,5551234567,Monaguillos;Lectores
              </code>
              <p className="text-xs text-gray-500 mt-2">
                * Las columnas "nombre" y "apellido" son obligatorias<br/>
                * Los servicios se separan con punto y coma (;)
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setIsImportModalOpen(false); setImportResult(null); }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportConfirm}
                isLoading={isImporting}
                disabled={importResult.success.length === 0}
              >
                Importar {importResult.success.length} Personas
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
