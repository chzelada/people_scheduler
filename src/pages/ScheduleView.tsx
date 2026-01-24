import React, { useEffect, useState } from 'react';
import { Plus, Download, Send, Trash2 } from 'lucide-react';
import { Button, Modal } from '../components/common';
import { ScheduleCalendar, ScheduleGenerator, ConflictList, EditAssignmentModal } from '../components/schedule';
import { useScheduleStore } from '../stores/scheduleStore';
import { useJobsStore } from '../stores/jobsStore';
import { scheduleApi } from '../services/api';
import type { GenerateScheduleRequest, Assignment } from '../types';

const statusLabels: Record<string, string> = {
  PUBLISHED: 'PUBLICADO',
  DRAFT: 'BORRADOR',
  ARCHIVED: 'ARCHIVADO',
};

export function ScheduleView() {
  const {
    schedules,
    currentSchedule,
    preview,
    fetchSchedules,
    fetchSchedule,
    generateSchedule,
    saveSchedule,
    publishSchedule,
    deleteSchedule,
    exportSchedule,
    setPreview,
    isLoading,
    isGenerating,
  } = useScheduleStore();

  const { jobs, fetchJobs } = useJobsStore();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit assignment state
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingServiceDate, setEditingServiceDate] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedScheduleId) {
      fetchSchedule(selectedScheduleId);
    }
  }, [selectedScheduleId]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleGenerate = async (request: GenerateScheduleRequest) => {
    try {
      await generateSchedule(request);
      setIsGeneratorOpen(false);
    } catch (error) {
      console.error('Error generating schedule:', error);
      showMessage('error', `Error al generar el horario: ${error}`);
    }
  };

  const handleSavePreview = async () => {
    try {
      const saved = await saveSchedule();
      setSelectedScheduleId(saved.id);
      setPreview(null);
      showMessage('success', 'Horario guardado exitosamente');
    } catch (error) {
      console.error('Error saving schedule:', error);
      showMessage('error', `Error al guardar el horario: ${error}`);
    }
  };

  const handlePublish = () => {
    setShowConfirmPublish(true);
  };

  const confirmPublish = () => {
    if (!currentSchedule) return;

    setIsPublishing(true);
    setShowConfirmPublish(false);

    publishSchedule(currentSchedule.id)
      .then(() => fetchSchedules())
      .then(() => {
        setIsPublishing(false);
        showMessage('success', 'Horario publicado exitosamente');
      })
      .catch((error) => {
        console.error('Error publishing schedule:', error);
        setIsPublishing(false);
        showMessage('error', `Error al publicar: ${error}`);
      });
  };

  const handleDelete = () => {
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!currentSchedule) return;
    setShowConfirmDelete(false);
    try {
      await deleteSchedule(currentSchedule.id);
      setSelectedScheduleId(null);
      showMessage('success', 'Horario eliminado');
    } catch (error) {
      showMessage('error', `Error al eliminar: ${error}`);
    }
  };

  const handleExport = async () => {
    if (currentSchedule) {
      try {
        const path = await exportSchedule(currentSchedule.id);
        showMessage('success', `Horario exportado a: ${path}`);
      } catch (error) {
        showMessage('error', `Error al exportar: ${error}`);
      }
    }
  };

  const handleEditAssignment = (assignment: Assignment, serviceDate: string) => {
    setEditingAssignment(assignment);
    setEditingServiceDate(serviceDate);
  };

  const handleSaveAssignment = async (assignmentId: string, newPersonId: string, newPersonName: string) => {
    try {
      if (preview) {
        // For preview mode, update the state directly (no database call)
        const updatedServiceDates = preview.schedule.service_dates.map((sd) => ({
          ...sd,
          assignments: sd.assignments.map((a) => {
            if (a.id === assignmentId) {
              return { ...a, person_id: newPersonId, person_name: newPersonName, manual_override: true };
            }
            return a;
          }),
        }));
        setPreview({
          ...preview,
          schedule: {
            ...preview.schedule,
            service_dates: updatedServiceDates,
          },
        });
        showMessage('success', 'Asignación actualizada');
      } else if (selectedScheduleId) {
        // For saved schedules, call the API
        await scheduleApi.updateAssignment({
          assignment_id: assignmentId,
          new_person_id: newPersonId,
        });
        await fetchSchedule(selectedScheduleId);
        showMessage('success', 'Asignación actualizada');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      showMessage('error', `Error al actualizar: ${error}`);
      throw error;
    }
  };

  const displaySchedule = preview?.schedule || currentSchedule;
  const isEditable = preview ? true : (currentSchedule?.status === 'DRAFT');
  const editingJobName = editingAssignment?.job_name || jobs.find((j) => j.id === editingAssignment?.job_id)?.name || '';

  // Gather all assignments from the current schedule for eligibility checking
  const allCurrentAssignments = displaySchedule?.service_dates.flatMap((sd) => sd.assignments) || [];

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-lg ${
          statusMessage.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Horarios</h1>
          <p className="text-gray-500 mt-1">Generar y administrar horarios de voluntarios</p>
        </div>
        <Button onClick={() => setIsGeneratorOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Generar Horario
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Schedule List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-900">Horarios</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {schedules.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No hay horarios aún
              </div>
            ) : (
              schedules.map((schedule) => (
                <button
                  key={schedule.id}
                  onClick={() => { setPreview(null); setSelectedScheduleId(schedule.id); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedScheduleId === schedule.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">{schedule.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {schedule.service_dates?.length || 0} fechas
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        schedule.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : schedule.status === 'DRAFT'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {statusLabels[schedule.status] || schedule.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Schedule Details */}
        <div className="lg:col-span-3 space-y-4">
          {preview && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-yellow-800">Modo Vista Previa</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Revise el horario generado antes de guardar. Puede editar las asignaciones haciendo clic en el icono de lápiz.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="secondary" onClick={() => setPreview(null)}>
                    Descartar
                  </Button>
                  <Button onClick={handleSavePreview} isLoading={isLoading}>
                    Guardar Horario
                  </Button>
                </div>
              </div>

              {preview.conflicts.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    Conflictos ({preview.conflicts.length})
                  </h4>
                  <ConflictList conflicts={preview.conflicts} />
                </div>
              )}
            </div>
          )}

          {displaySchedule ? (
            <>
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {displaySchedule.name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {displaySchedule.service_dates.length} fechas de servicio
                      {isEditable && (
                        <span className="ml-2 text-primary-600">
                          (Haga clic en el lápiz para editar asignaciones)
                        </span>
                      )}
                    </p>
                  </div>
                  {!preview && currentSchedule && (
                    <div className="flex space-x-2">
                      <Button variant="secondary" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-1" />
                        Exportar
                      </Button>
                      {currentSchedule.status === 'DRAFT' && (
                        <Button size="sm" onClick={handlePublish} isLoading={isPublishing}>
                          <Send className="w-4 h-4 mr-1" />
                          Publicar
                        </Button>
                      )}
                      <Button variant="danger" size="sm" onClick={handleDelete}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <ScheduleCalendar
                schedule={displaySchedule}
                jobs={jobs}
                editable={isEditable}
                onEditAssignment={handleEditAssignment}
              />
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Sin Horario Seleccionado</h3>
              <p className="text-gray-500 mt-2">
                Seleccione un horario de la lista o genere uno nuevo
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        title="Generar Horario"
      >
        <ScheduleGenerator onGenerate={handleGenerate} isLoading={isGenerating} />
      </Modal>

      {/* Edit Assignment Modal */}
      <EditAssignmentModal
        isOpen={!!editingAssignment}
        onClose={() => {
          setEditingAssignment(null);
          setEditingServiceDate(null);
        }}
        assignment={editingAssignment}
        serviceDate={editingServiceDate}
        jobName={editingJobName}
        currentScheduleAssignments={allCurrentAssignments}
        onSave={handleSaveAssignment}
      />

      {/* Confirm Publish Modal */}
      <Modal
        isOpen={showConfirmPublish}
        onClose={() => setShowConfirmPublish(false)}
        title="Confirmar Publicación"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Está seguro de publicar este horario? Esto lo hará oficial.
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowConfirmPublish(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmPublish}>
              Sí, Publicar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        title="Confirmar Eliminación"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Está seguro de eliminar este horario? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Sí, Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Calendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
