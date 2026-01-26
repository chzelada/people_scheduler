import React, { useEffect, useState } from 'react';
import { format, parseISO, isSameMonth, startOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, endOfMonth, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Star, LogOut, Key } from 'lucide-react';
import { scheduleApi, MyAssignment } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Button, Modal, Input } from '../components/common';

export function ServidorDashboard() {
  const { user, logout, changePassword } = useAuthStore();
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user?.person_id) {
      fetchAssignments();
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

  const nextAssignment = assignments[0];
  const upcomingAssignments = assignments.slice(0, 5);

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
              No tienes servicios programados
            </h2>
            <p className="text-gray-500">
              Cuando te asignen un servicio, aparecerá aquí
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
              {upcomingAssignments.map((assignment, index) => (
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
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);

                return (
                  <div
                    key={index}
                    className={`relative aspect-square p-1 rounded-lg transition-colors ${
                      !isCurrentMonth ? 'opacity-30' : ''
                    } ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                  >
                    <div className={`text-center text-sm ${
                      isTodayDate ? 'font-bold text-blue-600' : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {assignment && (
                      <div
                        className="absolute bottom-1 left-1 right-1 h-1.5 rounded-full"
                        style={{ backgroundColor: assignment.job_color }}
                        title={assignment.job_name}
                      />
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
            </div>
          </div>
        </div>
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
    </div>
  );
}
