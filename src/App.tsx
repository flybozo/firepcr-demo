import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SplitShell from '@/components/SplitShell'
import AuthGuard from '@/components/AuthGuard'
import RouteGuard from '@/components/RouteGuard'
import AppLayout from '@/layouts/AppLayout'

// Eagerly loaded (needed immediately / on every page)
import Login from '@/pages/auth/Login'
import Onboard from '@/pages/onboard/Onboard'
import { ToastContainer } from '@/components/ui'

// Lazy-loaded routes
const Dashboard = lazy(() => import('@/pages/Dashboard'))

// Encounters
const EncountersList = lazy(() => import('@/pages/encounters/EncountersList'))
const NewEncounter = lazy(() => import('@/pages/encounters/NewEncounter'))
const NewSimpleEncounter = lazy(() => import('@/pages/encounters/NewSimpleEncounter'))
const NewPCREncounter = lazy(() => import('@/pages/encounters/NewPCREncounter'))
const EncounterDetail = lazy(() => import('@/pages/encounters/EncounterDetail'))
const EncounterEdit = lazy(() => import('@/pages/encounters/EncounterEdit'))
const NewPhoto = lazy(() => import('@/pages/encounters/NewPhoto'))
const NewProcedure = lazy(() => import('@/pages/encounters/NewProcedure'))
const UnsignedPCRs = lazy(() => import('@/pages/encounters/UnsignedPCRs'))
const UnsignedItems = lazy(() => import('@/pages/unsigned-items/UnsignedItems'))
const PatientSearch = lazy(() => import('@/pages/encounters/PatientSearch'))

// MAR
const MARList = lazy(() => import('@/pages/mar/MARList'))
const MARNew = lazy(() => import('@/pages/mar/MARNew'))
const MARDetail = lazy(() => import('@/pages/mar/MARDetail'))
const MARSearch = lazy(() => import('@/pages/mar/MARSearch'))

// Incidents
const IncidentsList = lazy(() => import('@/pages/incidents/IncidentsList'))
const NewIncident = lazy(() => import('@/pages/incidents/NewIncident'))
const IncidentDetail = lazy(() => import('@/pages/incidents/IncidentDetail'))
const ShiftTicket = lazy(() => import('@/pages/incidents/ShiftTicket'))

// Units
const UnitsList = lazy(() => import('@/pages/units/UnitsList'))
const NewUnit = lazy(() => import('@/pages/units/NewUnit'))
const UnitDetail = lazy(() => import('@/pages/units/UnitDetail'))

// CS
const CSOverview = lazy(() => import('@/pages/cs/CSOverview'))
const CSList = lazy(() => import('@/pages/cs/CSList'))
const CSItemDetail = lazy(() => import('@/pages/cs/CSItemDetail'))
const CSReceive = lazy(() => import('@/pages/cs/CSReceive'))
const CSTransfer = lazy(() => import('@/pages/cs/CSTransfer'))
const CSCount = lazy(() => import('@/pages/cs/CSCount'))
const CSAudit = lazy(() => import('@/pages/cs/CSAudit'))
const CSChecklist = lazy(() => import('@/pages/cs/CSChecklist'))
const CSInventoryCount = lazy(() => import('@/pages/cs/CSInventoryCount'))

// Inventory
const InventoryList = lazy(() => import('@/pages/inventory/InventoryList'))
const InventoryAdd = lazy(() => import('@/pages/inventory/InventoryAdd'))
const InventoryDetail = lazy(() => import('@/pages/inventory/InventoryDetail'))
const BurnRate = lazy(() => import('@/pages/inventory/BurnRate'))
const Reorder = lazy(() => import('@/pages/inventory/Reorder'))

// Supply Runs
const SupplyRunsList = lazy(() => import('@/pages/supply-runs/SupplyRunsList'))
const NewSupplyRun = lazy(() => import('@/pages/supply-runs/NewSupplyRun'))
const SupplyRunDetail = lazy(() => import('@/pages/supply-runs/SupplyRunDetail'))
const SupplyRunSearch = lazy(() => import('@/pages/supply-runs/SupplyRunSearch'))

// Roster
const RosterList = lazy(() => import('@/pages/roster/RosterList'))
const NewEmployee = lazy(() => import('@/pages/roster/NewEmployee'))
const HRCredentials = lazy(() => import('@/pages/roster/HRCredentials'))
const EmployeeDetail = lazy(() => import('@/pages/roster/EmployeeDetail'))
const PayRates = lazy(() => import('@/pages/roster/PayRates'))

// Schedule
const Schedule = lazy(() => import('@/pages/schedule/Schedule'))
const ScheduleCalendar = lazy(() => import('@/pages/schedule/ScheduleCalendar'))
const GenerateSchedule = lazy(() => import('@/pages/schedule/GenerateSchedule'))

// ICS 214
const ICS214List = lazy(() => import('@/pages/ics214/ICS214List'))
const NewICS214 = lazy(() => import('@/pages/ics214/NewICS214'))
const ICS214Detail = lazy(() => import('@/pages/ics214/ICS214Detail'))
const ICS214Activity = lazy(() => import('@/pages/ics214/ICS214Activity'))

// Other
const Analytics = lazy(() => import('@/pages/analytics/Analytics'))
const Billing = lazy(() => import('@/pages/billing/Billing'))
const CompClaimsList = lazy(() => import('@/pages/comp-claims/CompClaimsList'))
const NewCompClaim = lazy(() => import('@/pages/comp-claims/NewCompClaim'))
const AMAConsent = lazy(() => import('@/pages/consent/AMAConsent'))
const ConsentToTreat = lazy(() => import('@/pages/consent/ConsentToTreat'))
const Contacts = lazy(() => import('@/pages/contacts/Contacts'))
const DocumentsList = lazy(() => import('@/pages/documents/DocumentsList'))
const DocumentDetail = lazy(() => import('@/pages/documents/DocumentDetail'))
const Handbook = lazy(() => import('@/pages/documents/Handbook'))
const NewDocument = lazy(() => import('@/pages/documents/NewDocument'))
const Formulary = lazy(() => import('@/pages/formulary/Formulary'))
const Payroll = lazy(() => import('@/pages/payroll/Payroll'))
const MyPayroll = lazy(() => import('@/pages/payroll/MyPayroll'))
const Profile = lazy(() => import('@/pages/profile/Profile'))
const ChatPage = lazy(() => import('@/pages/chat/Chat'))
// Legacy — kept for redirect
const UnsignedOrders = lazy(() => import('@/pages/unsigned-orders/UnsignedOrders'))
const MyUnit = lazy(() => import('@/pages/dashboard/MyUnit'))

// Admin
const Admin = lazy(() => import('@/pages/admin/Admin'))
const Announcements = lazy(() => import('@/pages/admin/Announcements'))
const ChatRequests = lazy(() => import('@/pages/admin/ChatRequests'))
const Company = lazy(() => import('@/pages/admin/Company'))
const Financial = lazy(() => import('@/pages/admin/Financial'))
const FireDashboard = lazy(() => import('@/pages/admin/FireDashboard'))
const FireAdminDashboard = lazy(() => import('@/pages/fire-admin/FireAdminDashboard'))
const PushNotifications = lazy(() => import('@/pages/admin/PushNotifications'))

// Shared loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Self-service employee onboarding — no auth required */}
          <Route path="/onboard" element={<Onboard />} />
          {/* External fire admin dashboard — no auth required */}
          <Route path="/fire-admin/:code" element={<FireAdminDashboard />} />

          <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route index element={<Dashboard />} />

            {/* ── Always accessible (any logged-in user, assigned or not) ── */}
            <Route path="profile" element={<Profile />} />
            <Route path="roster" element={<SplitShell basePath="/roster"><RosterList /></SplitShell>}>
              <Route path=":id" element={<EmployeeDetail />} />
            </Route>
            {/* Schedule request — field users get the full Schedule page (it self-filters) */}
            <Route path="schedule/request" element={<Schedule />} />
            {/* Team Chat — available to all logged-in users */}
            <Route path="chat" element={<ChatPage />} />

            {/* ── Units: field users go straight to their unit; list is admin-only ── */}
            <Route element={<RouteGuard unitListGuard />}>
              <Route path="units" element={<SplitShell basePath="/units" listWidth="lg:w-1/2"><UnitsList /></SplitShell>}>
                <Route path=":id" element={<UnitDetail />} />
              </Route>
            </Route>

            {/* ── Requires active unit assignment ── */}
            <Route element={<RouteGuard require="assigned" />}>
              {/* Encounters */}
              <Route path="encounters/new" element={<NewEncounter />} />
              <Route path="encounters/new/simple" element={<NewSimpleEncounter />} />
              <Route path="encounters/new/pcr" element={<NewPCREncounter />} />
              <Route path="encounters/photos/new" element={<NewPhoto />} />
              <Route path="encounters/procedures/new" element={<NewProcedure />} />
              <Route path="encounters/:id/edit" element={<EncounterEdit />} />
              <Route path="encounters" element={<SplitShell basePath="/encounters"><EncountersList /></SplitShell>}>
                <Route path=":id" element={<EncounterDetail />} />
              </Route>
              {/* MAR */}
              <Route path="mar/new" element={<MARNew />} />
              <Route path="mar/search" element={<MARSearch />} />
              <Route path="mar" element={<SplitShell basePath="/mar"><MARList /></SplitShell>}>
                <Route path=":id" element={<MARDetail />} />
              </Route>
              {/* Incidents */}
              <Route path="incidents/:id/shift-ticket" element={<ShiftTicket />} />
              <Route path="incidents" element={<IncidentsList />} />
              <Route path="incidents/:id" element={<IncidentDetail />} />
              {/* CS */}
              <Route path="cs/overview" element={<CSOverview />} />
              <Route path="cs/transfer" element={<CSTransfer />} />
              <Route path="cs/count" element={<CSCount />} />
              <Route path="cs" element={<SplitShell basePath="/cs" detailPattern="/cs/item/:id"><CSList /></SplitShell>}>
                <Route path="item/:id" element={<CSItemDetail />} />
              </Route>
              <Route path="cs/checklist" element={<CSChecklist />} />
              <Route path="cs-inventory/count" element={<CSInventoryCount />} />
              {/* Inventory */}
              <Route path="inventory" element={<SplitShell basePath="/inventory"><InventoryList /></SplitShell>}>
                <Route path=":id" element={<InventoryDetail />} />
              </Route>
              {/* Supply Runs */}
              <Route path="supply-runs/new" element={<NewSupplyRun />} />
              <Route path="supply-runs/search" element={<SupplyRunSearch />} />
              <Route path="supply-runs" element={<SplitShell basePath="/supply-runs"><SupplyRunsList /></SplitShell>}>
                <Route path=":id" element={<SupplyRunDetail />} />
              </Route>
              {/* ICS 214 */}
              <Route path="ics214" element={<ICS214List />} />
              <Route path="ics214/new" element={<NewICS214 />} />
              <Route path="ics214/:id" element={<ICS214Detail />} />
              <Route path="ics214/:id/activity" element={<ICS214Activity />} />
              {/* Unsigned / Patient */}
              <Route path="unsigned-items" element={<UnsignedItems />} />
              <Route path="unsigned-orders" element={<Navigate to="/unsigned-items" replace />} />
              <Route path="unsigned-pcrs" element={<Navigate to="/unsigned-items" replace />} />
              <Route path="patient-search" element={<PatientSearch />} />
              <Route path="dashboard/my-unit" element={<MyUnit />} />
              {/* Payroll (own pay stubs) */}
              <Route path="payroll/my" element={<MyPayroll />} />
              {/* Consent forms (needed on incident) */}
              <Route path="consent/ama" element={<AMAConsent />} />
              <Route path="consent/treat" element={<ConsentToTreat />} />
              {/* Comp claims */}
              <Route path="comp-claims/new" element={<NewCompClaim />} />
              <Route path="comp-claims" element={<CompClaimsList />} />
            </Route>

            {/* ── Admin only ── */}
            <Route element={<RouteGuard require="admin" />}>
              <Route path="incidents/new" element={<NewIncident />} />
              <Route path="units/new" element={<NewUnit />} />
              <Route path="roster/new" element={<NewEmployee />} />
              <Route path="roster/hr" element={<HRCredentials />} />
              <Route path="roster/pay-rates" element={<PayRates />} />
              <Route path="cs/receive" element={<CSReceive />} />
              <Route path="cs/audit" element={<CSAudit />} />
              <Route path="inventory/add" element={<InventoryAdd />} />
              <Route path="inventory/burnrate" element={<BurnRate />} />
              <Route path="inventory/reorder" element={<Reorder />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="schedule/calendar" element={<ScheduleCalendar />} />
              <Route path="schedule/generate" element={<GenerateSchedule />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="billing" element={<Billing />} />
              <Route path="formulary" element={<Formulary />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="documents/handbook" element={<Handbook />} />
              <Route path="documents/new" element={<NewDocument />} />
              <Route path="documents" element={<SplitShell basePath="/documents"><DocumentsList /></SplitShell>}>
                <Route path=":id" element={<DocumentDetail />} />
              </Route>
              <Route path="supply-runs/search" element={<SupplyRunSearch />} />
              {/* Admin section */}
              <Route path="admin" element={<Admin />} />
              <Route path="admin/announcements" element={<Announcements />} />
              <Route path="admin/push-notifications" element={<PushNotifications />} />
              <Route path="admin/chat-requests" element={<ChatRequests />} />
              <Route path="admin/company" element={<Company />} />
              <Route path="admin/fire-dashboard" element={<FireDashboard />} />
              <Route path="admin/financial" element={<Financial />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
