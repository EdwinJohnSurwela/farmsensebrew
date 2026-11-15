import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { dashboardPath } from './role-route';
import Landing from './pages/Landing';
import RoleLogin from './pages/RoleLogin';
import Shell from './components/Shell';
import AdminDashboard from './pages/admin/AdminDashboard';
import AuditLog from './pages/admin/AuditLog';
import SensorBoxes from './pages/admin/SensorBoxes';
import ServerPage from './pages/admin/ServerPage';
import AgronomistDashboard from './pages/agronomist/AgronomistDashboard';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';
import AlertsPage from './pages/shared/AlertsPage';
import IrrigationPage from './pages/shared/IrrigationPage';
import AnalyticsPage from './pages/shared/AnalyticsPage';
import ManualPage from './pages/shared/ManualPage';
import ManualPrint from './manual/ManualPrint';
import {
  IconDashboard, IconBoxes, IconAudit, IconServer, IconAlerts, IconWater,
  IconAnalytics, IconManual,
} from './icons';

// Last tab for every role: the role's own User Manual.
const manualTab = (role) => ({
  key: 'manual', label: 'User Manual', short: 'Manual', icon: <IconManual />, element: <ManualPage role={role} />,
});
import { IconAgronomist, IconFarmOwner, IconFieldStaff, IconAdmin } from './components/RoleIcons';

const ROLE_META = {
  admin: {
    accent: 'var(--admin)',
    title: 'Admin Login',
    subtitle: 'System Configuration & User Access',
    icon: <IconAdmin />,
    tabs: [
      { key: 'dashboard', label: 'Overview', icon: <IconDashboard />, element: <AdminDashboard /> },
      { key: 'boxes', label: 'Sensor Boxes', icon: <IconBoxes />, element: <SensorBoxes /> },
      { key: 'audit', label: 'Audit Log', icon: <IconAudit />, element: <AuditLog /> },
      { key: 'server', label: 'Raspberry Pi 4 Server', icon: <IconServer />, element: <ServerPage /> },
      manualTab('admin'),
    ],
  },
  agronomist: {
    accent: 'var(--agronomist)',
    title: 'Agronomist Login',
    subtitle: 'Full Sensor Data & Analytics',
    icon: <IconAgronomist />,
    tabs: [
      { key: 'dashboard', label: 'Overview', icon: <IconDashboard />, element: <AgronomistDashboard /> },
      { key: 'alerts', label: 'Alerts', icon: <IconAlerts />, element: <AlertsPage /> },
      { key: 'irrigation', label: 'Irrigation', icon: <IconWater />, element: <IrrigationPage /> },
      { key: 'analytics', label: 'Analytics', icon: <IconAnalytics />, element: <AnalyticsPage /> },
      manualTab('agronomist'),
    ],
  },
  farm_owner: {
    accent: 'var(--owner)',
    title: 'Farm Owner Login',
    subtitle: 'Business Intelligence & Recommendations',
    icon: <IconFarmOwner />,
    tabs: [
      { key: 'dashboard', label: 'Overview', icon: <IconDashboard />, element: <OwnerDashboard /> },
      { key: 'alerts', label: 'Alerts', icon: <IconAlerts />, element: <AlertsPage /> },
      { key: 'irrigation', label: 'Irrigation', icon: <IconWater />, element: <IrrigationPage /> },
      { key: 'analytics', label: 'Analytics', icon: <IconAnalytics />, element: <AnalyticsPage /> },
      manualTab('farm_owner'),
    ],
  },
  field_staff: {
    accent: 'var(--staff)',
    title: 'Field Staff Login',
    subtitle: 'Simple Zone Status & Instructions',
    icon: <IconFieldStaff />,
    tabs: [
      { key: 'dashboard', label: 'Overview', icon: <IconDashboard />, element: <StaffDashboard /> },
      // Field staff work the farm daily (the owner is only on site on
      // weekends) — they execute the watering, so they get Irrigation.
      { key: 'irrigation', label: 'Irrigation', icon: <IconWater />, element: <IrrigationPage /> },
      // Read-only: staff record what they did from their Overview.
      { key: 'alerts', label: 'Alerts', icon: <IconAlerts />, element: <AlertsPage /> },
      manualTab('field_staff'),
    ],
  },
};

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user || dashboardPath(user.role) === '/login') return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={dashboardPath(user.role)} replace />;
  return children;
}

function ProtectedManual() {
  const { role } = useParams();
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && role !== user.role) return <Navigate to={dashboardPath(user.role)} replace />;
  return <ManualPrint />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<RoleLogin />} />
          <Route path="/manual-print/:role" element={<ProtectedManual />} />
          {Object.entries(ROLE_META).map(([role, meta]) => (
            <Route key={role}>
              <Route
                path={`/${role}/login`}
                element={<Navigate to="/login" replace />}
              />
              <Route
                path={`/${role}/dashboard`}
                element={
                  <Protected role={role}>
                    <Shell role={role} meta={meta} />
                  </Protected>
                }
              />
            </Route>
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
