import { useState } from "react";
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

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
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
        return <Dashboard />;
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
        return <Dashboard />;
    }
  };

  return (
    <div className="h-full flex">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
