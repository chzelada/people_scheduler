import React, { useEffect, useState } from 'react';
import { format, parseISO, isSameMonth, startOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, endOfMonth, isToday, isSameDay, isSunday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Star, LogOut, Key, XCircle, CalendarX, Trash2 } from 'lucide-react';
import { scheduleApi, myUnavailabilityApi, MyAssignment } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Button, Modal, Input } from '../components/common';
import type { Unavailability } from '../types';

export function ServidorDashboard() {
  const { user, logout, changePassword } = useAuthStore();
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Unavailability state
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [isUnavailabilityModalOpen, setIsUnavailabilityModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [unavailabilityReason, setUnavailabilityReason] = useState('');
  const [isSavingUnavailability, setIsSavingUnavailability] = useState(false);

  useEffect(() => {
    if (user?.person_id) {
      fetchAssignments();
      fetchUnavailabilities();
    }
  }, [user?.person_id]);

  const fetchAssignments = async () => {
    if (!user?.person_id) return;
    setIsLoading(true);
    try {
      const data = await scheduleApi.getMyAssignments(user.person_id);
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnavailabilities = async () => {
    try {
      const data = await myUnavailabilityApi.getAll();
      setUnavailabilities(data);
    } catch (error) {
      console.error('Error fetching unavailabilities:', error);
    }
  };

  const handleSundayClick = (date: Date) => {
    // Only allow clicking on future Sundays
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    if (!isSunday(date) || date < todayDate) return;

    // Check if already unavailable
    const existing = unavailabilities.find(u => isSameDay(parseISO(u.start_date), date));
    if (existing) {
      // Ask to delete
      if (window.confirm(`¿Deseas eliminar tu ausencia del ${format(date, "d 'de' MMMM", { locale: es })}?`)) {
        handleDeleteUnavailability(existing.id);
      }
    } else {
      // Open modal to add
      setSelectedDate(date);
      setUnavailabilityReason('');
      setIsUnavailabilityModalOpen(true);
    }
  };

  const handleSaveUnavailability = async () => {
    if (!selectedDate) return;

    setIsSavingUnavailability(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await myUnavailabilityApi.create([dateStr], unavailabilityReason || undefined);
      await fetchUnavailabilities();
      setIsUnavailabilityModalOpen(false);
      setSelectedDate(null);
      setUnavailabilityReason('');
    } catch (error) {
      console.error('Error saving unavailability:', error);
      alert('Error al guardar ausencia: ' + String(error));
    } finally {
      setIsSavingUnavailability(false);
    }
  };

  const handleDeleteUnavailability = async (id: string) => {
    try {
      await myUnavailabilityApi.delete(id);
      await fetchUnavailabilities();
    } catch (error) {
      console.error('Error deleting unavailability:', error);
      alert('Error al eliminar ausencia: ' + String(error));
    }
  };

  const getUnavailabilityForDate = (date: Date) => {
    return unavailabilities.find(u => isSameDay(parseISO(u.start_date), date));
  };

  // Separate upcoming and past assignments
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingAssignments = assignments.filter(a => parseISO(a.service_date) >= today);
  const pastAssignments = assignments.filter(a => parseISO(a.service_date) < today);
  const nextAssignment = upcomingAssignments[0];

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.current, passwordForm.new);
      setIsPasswordModalOpen(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      alert('Contraseña cambiada exitosamente');
    } catch (error) {
      setPasswordError(String(error));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro que deseas salir?')) {
      logout();
    }
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAssignmentForDate = (date: Date) => {
    return assignments.find(a => isSameDay(parseISO(a.service_date), date));
  };

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                ¡Hola, {user?.username}!
              </h1>
              <p className="text-sm text-gray-500">Bienvenido a tu horario de servicio</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cambiar contraseña"
            >
              <Key className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Next Assignment - Hero Card */}
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
            </div>
          </div>
        ) : nextAssignment ? (
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg p-1">
            <div className="bg-white rounded-xl p-6 md:p-8">
              <div className="flex items-center justify-center mb-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  <Star className="w-4 h-4 mr-1" />
                  Tu Próximo Servicio
                </span>
              </div>
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
                  {format(parseISO(nextAssignment.service_date), "EEEE d", { locale: es })}
                </h2>
                <p className="text-xl text-gray-600 mb-4">
                  {format(parseISO(nextAssignment.service_date), "MMMM yyyy", { locale: es })}
                </p>
                <div
                  className="inline-block px-6 py-3 rounded-full text-white text-lg font-semibold"
                  style={{ backgroundColor: nextAssignment.job_color }}
                >
                  {nextAssignment.job_name}
                  {nextAssignment.position_name && (
                    <span className="ml-2 opacity-90">- {nextAssignment.position_name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              {pastAssignments.length > 0
                ? 'No tienes servicios próximos'
                : 'No tienes servicios programados'}
            </h2>
            <p className="text-gray-500">
              {pastAssignments.length > 0
                ? 'Revisa tu historial de servicios abajo'
                : 'Cuando te asignen un servicio, aparecerá aquí'}
            </p>
          </div>
        )}

        {/* Upcoming List */}
        {upcomingAssignments.length > 1 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Próximos Servicios</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {upcomingAssignments.slice(1).map((assignment, index) => (
                <li key={index} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-gray-100">
                      <span className="text-xs text-gray-500 uppercase">
                        {format(parseISO(assignment.service_date), 'MMM', { locale: es })}
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        {format(parseISO(assignment.service_date), 'd')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(parseISO(assignment.service_date), 'EEEE', { locale: es })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {assignment.position_name || 'Sin posición asignada'}
                      </p>
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: assignment.job_color }}
                  >
                    {assignment.job_name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Past Assignments */}
        {pastAssignments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Servicios Anteriores</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {pastAssignments.slice(0, 10).map((assignment, index) => (
                <li key={index} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors opacity-60">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-gray-50">
                      <span className="text-xs text-gray-400 uppercase">
                        {format(parseISO(assignment.service_date), 'MMM', { locale: es })}
                      </span>
                      <span className="text-lg font-bold text-gray-500">
                        {format(parseISO(assignment.service_date), 'd')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">
                        {format(parseISO(assignment.service_date), 'EEEE', { locale: es })}
                      </p>
                      <p className="text-sm text-gray-400">
                        {assignment.position_name || 'Sin posición asignada'}
                      </p>
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium text-white opacity-70"
                    style={{ backgroundColor: assignment.job_color }}
                  >
                    {assignment.job_name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Calendario</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="p-4">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const assignment = getAssignmentForDate(day);
                const unavailability = getUnavailabilityForDate(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);
                const isSundayDay = isSunday(day);
                const isFutureSunday = isSundayDay && day >= today;

                return (
                  <div
                    key={index}
                    onClick={() => isFutureSunday && isCurrentMonth && handleSundayClick(day)}
                    className={`relative aspect-square p-1 rounded-lg transition-colors ${
                      !isCurrentMonth ? 'opacity-30' : ''
                    } ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${
                      isFutureSunday && isCurrentMonth ? 'cursor-pointer hover:bg-blue-50' : ''
                    } ${unavailability ? 'bg-red-50' : ''}`}
                  >
                    <div className={`text-center text-sm ${
                      isTodayDate ? 'font-bold text-blue-600' : unavailability ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {unavailability && (
                      <div
                        className="absolute bottom-1 left-1 right-1 h-1.5 rounded-full bg-red-400"
                        title={`No disponible: ${unavailability.reason || 'Sin motivo'}`}
                      />
                    )}
                    {assignment && !unavailability && (
                      <div
                        className="absolute bottom-1 left-1 right-1 h-1.5 rounded-full"
                        style={{ backgroundColor: assignment.job_color }}
                        title={assignment.job_name}
                      />
                    )}
                    {isFutureSunday && isCurrentMonth && !unavailability && !assignment && (
                      <div className="absolute bottom-1 left-1 right-1 h-1.5 rounded-full bg-gray-200" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <div className="flex flex-wrap gap-4 text-sm">
              {Array.from(new Set(assignments.map(a => a.job_name))).map((jobName) => {
                const assignment = assignments.find(a => a.job_name === jobName);
                return (
                  <div key={jobName} className="flex items-center">
                    <span
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: assignment?.job_color }}
                    />
                    <span className="text-gray-600">{jobName}</span>
                  </div>
                );
              })}
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full mr-2 bg-red-400" />
                <span className="text-gray-600">No disponible</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Haz clic en un domingo futuro para marcar tu ausencia
            </p>
          </div>
        </div>

        {/* My Unavailabilities */}
        {unavailabilities.filter(u => parseISO(u.start_date) >= today).length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center">
              <CalendarX className="w-5 h-5 text-red-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Mis Ausencias Programadas</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {unavailabilities
                .filter(u => parseISO(u.start_date) >= today)
                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                .map((unavail) => (
                  <li key={unavail.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-red-50">
                        <span className="text-xs text-red-500 uppercase">
                          {format(parseISO(unavail.start_date), 'MMM', { locale: es })}
                        </span>
                        <span className="text-lg font-bold text-red-600">
                          {format(parseISO(unavail.start_date), 'd')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {format(parseISO(unavail.start_date), 'EEEE', { locale: es })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {unavail.reason || 'Sin motivo especificado'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Eliminar esta ausencia?')) {
                          handleDeleteUnavailability(unavail.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar ausencia"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </main>

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => { setIsPasswordModalOpen(false); setPasswordForm({ current: '', new: '', confirm: '' }); setPasswordError(''); }}
        title="Cambiar Contraseña"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Input
            type="password"
            label="Contraseña Actual"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            required
          />
          <Input
            type="password"
            label="Nueva Contraseña"
            value={passwordForm.new}
            onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
            required
          />
          <Input
            type="password"
            label="Confirmar Nueva Contraseña"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            required
          />

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsPasswordModalOpen(false); setPasswordForm({ current: '', new: '', confirm: '' }); setPasswordError(''); }}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isChangingPassword}>
              Cambiar Contraseña
            </Button>
          </div>
        </form>
      </Modal>

      {/* Unavailability Modal */}
      <Modal
        isOpen={isUnavailabilityModalOpen}
        onClose={() => { setIsUnavailabilityModalOpen(false); setSelectedDate(null); setUnavailabilityReason(''); }}
        title="Marcar Ausencia"
      >
        <div className="space-y-4">
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <CalendarX className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-lg font-semibold text-gray-900">
              {selectedDate && format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              No estarás disponible para servir este domingo
            </p>
          </div>

          <Input
            label="Motivo (opcional)"
            placeholder="Ej: Viaje, Compromiso familiar..."
            value={unavailabilityReason}
            onChange={(e) => setUnavailabilityReason(e.target.value)}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsUnavailabilityModalOpen(false); setSelectedDate(null); setUnavailabilityReason(''); }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveUnavailability}
              isLoading={isSavingUnavailability}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Marcar como No Disponible
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
