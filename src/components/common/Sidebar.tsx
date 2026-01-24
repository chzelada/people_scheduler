import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarOff,
  BarChart3,
  Settings,
  UsersRound
} from 'lucide-react';

type Page = 'dashboard' | 'people' | 'schedule' | 'unavailability' | 'siblings' | 'reports' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { id: 'people', label: 'Personas', icon: Users },
  { id: 'schedule', label: 'Horarios', icon: Calendar },
  { id: 'unavailability', label: 'Ausencias', icon: CalendarOff },
  { id: 'siblings', label: 'Grupos Familiares', icon: UsersRound },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Programador</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de Voluntarios</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
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
        <p className="text-xs text-gray-500 text-center">
          Versión 0.1.0
        </p>
      </div>
    </aside>
  );
}
