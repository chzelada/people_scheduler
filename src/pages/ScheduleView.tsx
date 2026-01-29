import React, { useEffect, useState } from 'react';
import { Plus, Download, Send, Trash2, AlertCircle, XCircle, CheckCircle } from 'lucide-react';
import { Button, Modal } from '../components/common';
import { ScheduleCalendar, ScheduleGenerator, ConflictList, EditAssignmentModal } from '../components/schedule';
import { useScheduleStore } from '../stores/scheduleStore';
import { useJobsStore } from '../stores/jobsStore';
import { scheduleApi } from '../services/api';
import type { GenerateScheduleRequest, Assignment, EmptySlot } from '../types';

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className={`
        pointer-events-auto px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3
        transform transition-all duration-300 animate-fade-in
        ${type === 'error'
          ? 'bg-red-600 text-white'
          : 'bg-green-600 text-white'
        }
      `}>
        {type === 'error' ? (
          <XCircle className="w-6 h-6 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-6 h-6 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

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

  // Incomplete schedule state
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [emptySlots, setEmptySlots] = useState<EmptySlot[]>([]);

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
    // Toast component handles auto-dismiss after 2 seconds
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

  const handlePublish = async () => {
    if (!currentSchedule) return;

    try {
      // Check completeness before publishing
      const completeness = await scheduleApi.getCompleteness(currentSchedule.id);

      if (!completeness.is_complete) {
        setEmptySlots(completeness.empty_slots);
        setShowIncompleteModal(true);
        return;
      }

      setShowConfirmPublish(true);
    } catch (error) {
      console.error('Error checking completeness:', error);
      showMessage('error', `Error al verificar completitud: ${error}`);
    }
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

  const handleSaveAssignment = async (assignmentId: string, newPersonId: string, _newPersonName: string) => {
    const scheduleId = preview?.schedule.id || selectedScheduleId;
    if (!scheduleId) return;

    try {
      await scheduleApi.updateAssignment({
        assignment_id: assignmentId,
        new_person_id: newPersonId,
      });

      if (preview) {
        const refreshed = await scheduleApi.get(scheduleId);
        setPreview({
          ...preview,
          schedule: refreshed,
        });
      } else {
        await fetchSchedule(scheduleId);
      }
      showMessage('success', 'Asignacion actualizada');
    } catch (error) {
      console.error('Error updating assignment:', error);
      showMessage('error', `Error al actualizar: ${error}`);
      throw error;
    }
  };

  // Drag and Drop handlers - always call API since generate already saves to DB
  const handleSwapAssignments = async (assignmentId1: string, assignmentId2: string) => {
    const scheduleId = preview?.schedule.id || selectedScheduleId;
    if (!scheduleId) return;

    try {
      await scheduleApi.swapAssignments({
        assignment_id_1: assignmentId1,
        assignment_id_2: assignmentId2,
      });

      if (preview) {
        // Refresh the preview from database
        const refreshed = await scheduleApi.get(scheduleId);
        setPreview({
          ...preview,
          schedule: refreshed,
        });
      } else {
        await fetchSchedule(scheduleId);
      }
      showMessage('success', 'Asignaciones intercambiadas');
    } catch (error) {
      console.error('Error swapping assignments:', error);
      showMessage('error', `Error al intercambiar: ${error}`);
    }
  };

  const handleMoveAssignment = async (
    assignmentId: string,
    targetServiceDateId: string,
    targetJobId: string,
    targetPosition: number
  ) => {
    const scheduleId = preview?.schedule.id || selectedScheduleId;
    if (!scheduleId) return;

    try {
      await scheduleApi.moveAssignment(assignmentId, {
        target_service_date_id: targetServiceDateId,
        target_job_id: targetJobId,
        target_position: targetPosition,
      });

      if (preview) {
        const refreshed = await scheduleApi.get(scheduleId);
        setPreview({
          ...preview,
          schedule: refreshed,
        });
      } else {
        await fetchSchedule(scheduleId);
      }
      showMessage('success', 'Asignacion movida');
    } catch (error) {
      console.error('Error moving assignment:', error);
      showMessage('error', `Error al mover: ${error}`);
    }
  };

  const handleClearAssignment = async (assignmentId: string) => {
    const scheduleId = preview?.schedule.id || selectedScheduleId;
    if (!scheduleId) return;

    try {
      await scheduleApi.clearAssignment(assignmentId);

      if (preview) {
        const refreshed = await scheduleApi.get(scheduleId);
        setPreview({
          ...preview,
          schedule: refreshed,
        });
      } else {
        await fetchSchedule(scheduleId);
      }
      showMessage('success', 'Asignacion vaciada');
    } catch (error) {
      console.error('Error clearing assignment:', error);
      showMessage('error', `Error al vaciar: ${error}`);
    }
  };

  const displaySchedule = preview?.schedule || currentSchedule;
  const isEditable = preview ? true : (currentSchedule?.status === 'DRAFT');
  const editingJobName = editingAssignment?.job_name || jobs.find((j) => j.id === editingAssignment?.job_id)?.name || '';

  // Gather all assignments from the current schedule for eligibility checking
  const allCurrentAssignments = displaySchedule?.service_dates.flatMap((sd) => sd.assignments) || [];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <Toast
          message={statusMessage.text}
          type={statusMessage.type}
          onClose={() => setStatusMessage(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion de Horarios</h1>
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
                No hay horarios aun
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
                    Revise el horario generado antes de guardar. Arrastre para intercambiar o mover asignaciones.
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
                          (Arrastre para mover o intercambiar asignaciones)
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
                onSwapAssignments={handleSwapAssignments}
                onMoveAssignment={handleMoveAssignment}
                onClearAssignment={handleClearAssignment}
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
        title="Confirmar Publicacion"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Esta seguro de publicar este horario? Esto lo hara oficial.
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowConfirmPublish(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmPublish}>
              Si, Publicar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Incomplete Schedule Modal */}
      <Modal
        isOpen={showIncompleteModal}
        onClose={() => setShowIncompleteModal(false)}
        title="Horario Incompleto"
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-700 font-medium">
                No se puede publicar el horario porque hay {emptySlots.length} posicion(es) sin asignar.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Complete todas las asignaciones antes de publicar.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Posiciones vacias:</h4>
            <ul className="space-y-1">
              {emptySlots.map((slot, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex items-center space-x-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  <span>
                    {slot.service_date} - {slot.job_name}
                    {slot.position_name && ` (${slot.position_name})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowIncompleteModal(false)}>
              Entendido
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        title="Confirmar Eliminacion"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Esta seguro de eliminar este horario? Esta accion no se puede deshacer.
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Si, Eliminar
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
