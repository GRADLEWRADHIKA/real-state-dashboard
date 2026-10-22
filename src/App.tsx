import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { siteRoutes } from '@estateflow/site';
import { homeFor, useAuth } from '@/lib/auth';
import { AppShell, RequireRole } from '@/components/layout/AppShell';
import { SplashScreen } from '@/components/layout/Brand';
import LoginPage from '@/pages/Login';
import type { Role } from '@/types';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const LeadsList = lazy(() => import('@/pages/leads/LeadsList'));
const LeadDetail = lazy(() => import('@/pages/leads/LeadDetail'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));
const PropertiesList = lazy(() => import('@/pages/properties/PropertiesList'));
const PropertyDetail = lazy(() => import('@/pages/properties/PropertyDetail'));
const CustomersList = lazy(() => import('@/pages/customers/CustomersList'));
const CustomerDetail = lazy(() => import('@/pages/customers/CustomerDetail'));
const Deals = lazy(() => import('@/pages/Deals'));
const SiteVisits = lazy(() => import('@/pages/SiteVisits'));
const Followups = lazy(() => import('@/pages/Followups'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const FinanceOverview = lazy(() => import('@/pages/finance/FinanceOverview'));
const Transactions = lazy(() => import('@/pages/finance/Transactions'));
const Installments = lazy(() => import('@/pages/finance/Installments'));
const Receipt = lazy(() => import('@/pages/finance/Receipt'));
const Brokers = lazy(() => import('@/pages/Brokers'));
const BrokerDetail = lazy(() => import('@/pages/BrokerDetail'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Staff = lazy(() => import('@/pages/Staff'));
const Documents = lazy(() => import('@/pages/Documents'));
const Reports = lazy(() => import('@/pages/Reports'));
const Users = lazy(() => import('@/pages/Users'));
const Settings = lazy(() => import('@/pages/Settings'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));
const Requests = lazy(() => import('@/pages/Requests'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const SALES: Role[] = ['admin', 'manager', 'sales'];
const STAFF: Role[] = ['admin', 'manager', 'sales', 'accounts'];
const FIN: Role[] = ['admin', 'accounts'];
const OFFICE: Role[] = ['admin', 'manager', 'accounts'];

const guard = (roles: Role[], el: React.ReactNode) => <RequireRole roles={roles}>{el}</RequireRole>;

/** Signed-in users leave /login for the page they originally asked for (or their home). */
function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <LoginPage />;
  const from = (location.state as { from?: string } | null)?.from;
  return <Navigate to={from && !from.startsWith('/login') ? from : homeFor(user.role)} replace />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <SplashScreen />;

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      {/* The public website: its home page is "/" for visitors; signed-in staff get the CRM there. */}
      {siteRoutes({ withHome: !user, account: user ? { to: '/', label: 'Open the CRM' } : { to: '/login', label: 'Staff login' } })}
      <Route element={<AppShell />}>
        {user && <Route index element={user.role === 'accounts' ? <Navigate to="/finance" replace /> : guard(SALES, <Dashboard />)} />}
        <Route path="leads" element={guard(SALES, <LeadsList />)} />
        <Route path="leads/:id" element={guard(SALES, <LeadDetail />)} />
        <Route path="pipeline" element={guard(SALES, <Pipeline />)} />
        <Route path="properties" element={guard(STAFF, <PropertiesList />)} />
        <Route path="properties/:id" element={guard(STAFF, <PropertyDetail />)} />
        <Route path="customers" element={guard(STAFF, <CustomersList />)} />
        <Route path="customers/:id" element={guard(STAFF, <CustomerDetail />)} />
        <Route path="deals" element={guard(SALES, <Deals />)} />
        <Route path="site-visits" element={guard(SALES, <SiteVisits />)} />
        <Route path="followups" element={guard(SALES, <Followups />)} />
        <Route path="tasks" element={guard(STAFF, <Tasks />)} />
        <Route path="finance" element={guard(FIN, <FinanceOverview />)} />
        <Route path="finance/transactions" element={guard(FIN, <Transactions />)} />
        <Route path="finance/installments" element={guard(FIN, <Installments />)} />
        <Route path="expenses" element={guard(FIN, <Expenses />)} />
        <Route path="brokers" element={guard(OFFICE, <Brokers />)} />
        <Route path="brokers/:id" element={guard(OFFICE, <BrokerDetail />)} />
        <Route path="receipts/:id" element={guard(STAFF, <Receipt />)} />
        <Route path="documents" element={guard(STAFF, <Documents />)} />
        <Route path="reports" element={guard(['admin', 'manager', 'accounts'], <Reports />)} />
        <Route path="requests" element={guard(STAFF, <Requests />)} />
        <Route path="staff" element={guard(OFFICE, <Staff />)} />
        <Route path="users" element={guard(['admin', 'manager'], <Users />)} />
        <Route path="audit" element={guard(['admin'], <AuditLog />)} />
        <Route path="settings" element={guard(STAFF, <Settings />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
