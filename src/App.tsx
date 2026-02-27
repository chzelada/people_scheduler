import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./components/common";
import {
  Dashboard,
  PeopleManagement,
  ScheduleView,
  UnavailabilityManagement,
  SiblingGroups,
  Reports,
  Settings,
} from "./pages";
import { ServidorDashboard } from "./pages/ServidorDashboard";
import { Login } from "./pages/Login";
import { useAuthStore } from "./stores/authStore";

type Page = 'dashboard' | 'people' | 'schedule' | 'unavailability' | 'siblings' | 'reports' | 'settings';

const pageLabels: Record<Page, string> = {
  dashboard: 'Inicio',
  people: 'Servidores',
  schedule: 'Horarios',
  unavailability: 'Ausencias',
  siblings: 'Grupos Familiares',
  reports: 'Reportes',
  settings: 'Configuración',
};

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // If user is a servidor (not admin), show the servidor dashboard
  if (user?.role === 'servidor') {
    return <ServidorDashboard />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage as (page: string) => void} />;
      case 'people':
        return <PeopleManagement />;
      case 'schedule':
        return <ScheduleView />;
      case 'unavailability':
        return <UnavailabilityManagement />;
      case 'siblings':
        return <SiblingGroups />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentPage as (page: string) => void} />;
    }
  };

  return (
    <div className="h-full flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header with hamburger */}
        <div className="md:hidden flex items-center px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 text-lg font-semibold text-gray-900">
            {pageLabels[currentPage]}
          </span>
        </div>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
