import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarOff,
  BarChart3,
  Settings,
  UsersRound,
  LogOut,
  User,
  X
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ThemeToggle } from './ThemeToggle';

type Page = 'dashboard' | 'people' | 'schedule' | 'unavailability' | 'siblings' | 'reports' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'people', label: 'Servidores', icon: Users },
  { id: 'schedule', label: 'Horarios', icon: Calendar },
  { id: 'unavailability', label: 'Ausencias', icon: CalendarOff },
  { id: 'siblings', label: 'Grupos Familiares', icon: UsersRound },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export function Sidebar({ currentPage, onNavigate, isOpen = false, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    if (window.confirm('¿Está seguro que desea cerrar sesión?')) {
      logout();
    }
  };

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo-misa.jpeg`}
            alt="San Martín de Porres"
            className="w-14 h-14 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 leading-tight">Programación de Servicio</h1>
            <p className="text-sm text-gray-500">Misa de Niños</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        {user && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="ml-2">
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500 text-center">
          Versión 0.1.0
        </p>
      </div>
    </aside>
    </>
  );
}
