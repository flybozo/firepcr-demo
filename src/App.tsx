import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import AuthGuard from '@/components/AuthGuard'
import AppLayout from '@/layouts/AppLayout'

// Auth
const Login = lazy(() => import('@/pages/auth/Login'))

// Core pages
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

// MAR
const MARList = lazy(() => import('@/pages/mar/MARList'))
const MARNew = lazy(() => import('@/pages/mar/MARNew'))
const MARDetail = lazy(() => import('@/pages/mar/MARDetail'))

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

// Roster
const RosterList = lazy(() => import('@/pages/roster/RosterList'))
const NewEmployee = lazy(() => import('@/pages/roster/NewEmployee'))
const HRCredentials = lazy(() => import('@/pages/roster/HRCredentials'))
const EmployeeDetail = lazy(() => import('@/pages/roster/EmployeeDetail'))

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
const Contacts = lazy(() => import('@/pages/contacts/Contacts'))
const DocumentsList = lazy(() => import('@/pages/documents/DocumentsList'))
const Handbook = lazy(() => import('@/pages/documents/Handbook'))
const NewDocument = lazy(() => import('@/pages/documents/NewDocument'))
const Formulary = lazy(() => import('@/pages/formulary/Formulary'))
const Payroll = lazy(() => import('@/pages/payroll/Payroll'))
const MyPayroll = lazy(() => import('@/pages/payroll/MyPayroll'))
const Profile = lazy(() => import('@/pages/profile/Profile'))
const UnsignedOrders = lazy(() => import('@/pages/unsigned-orders/UnsignedOrders'))
const MyUnit = lazy(() => import('@/pages/dashboard/MyUnit'))

// Admin
const Admin = lazy(() => import('@/pages/admin/Admin'))
const Announcements = lazy(() => import('@/pages/admin/Announcements'))
const ChatRequests = lazy(() => import('@/pages/admin/ChatRequests'))
const Company = lazy(() => import('@/pages/admin/Company'))
const FireDashboard = lazy(() => import('@/pages/admin/FireDashboard'))

const Loading = () => <div className="min-h-screen bg-gray-950" />

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route index element={<Dashboard />} />

            {/* Encounters */}
            <Route path="encounters" element={<EncountersList />} />
            <Route path="encounters/new" element={<NewEncounter />} />
            <Route path="encounters/new/simple" element={<NewSimpleEncounter />} />
            <Route path="encounters/new/pcr" element={<NewPCREncounter />} />
            <Route path="encounters/photos/new" element={<NewPhoto />} />
            <Route path="encounters/procedures/new" element={<NewProcedure />} />
            <Route path="encounters/:id" element={<EncounterDetail />} />
            <Route path="encounters/:id/edit" element={<EncounterEdit />} />

            {/* MAR */}
            <Route path="mar" element={<MARList />} />
            <Route path="mar/new" element={<MARNew />} />
            <Route path="mar/:id" element={<MARDetail />} />

            {/* Incidents */}
            <Route path="incidents" element={<IncidentsList />} />
            <Route path="incidents/new" element={<NewIncident />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="incidents/:id/shift-ticket" element={<ShiftTicket />} />

            {/* Units */}
            <Route path="units" element={<UnitsList />} />
            <Route path="units/new" element={<NewUnit />} />
            <Route path="units/:id" element={<UnitDetail />} />

            {/* CS */}
            <Route path="cs" element={<CSOverview />} />
            <Route path="cs/receive" element={<CSReceive />} />
            <Route path="cs/transfer" element={<CSTransfer />} />
            <Route path="cs/count" element={<CSCount />} />
            <Route path="cs/audit" element={<CSAudit />} />
            <Route path="cs/checklist" element={<CSChecklist />} />
            <Route path="cs-inventory/count" element={<CSInventoryCount />} />

            {/* Inventory */}
            <Route path="inventory" element={<InventoryList />} />
            <Route path="inventory/add" element={<InventoryAdd />} />
            <Route path="inventory/burnrate" element={<BurnRate />} />
            <Route path="inventory/reorder" element={<Reorder />} />
            <Route path="inventory/:id" element={<InventoryDetail />} />

            {/* Supply Runs */}
            <Route path="supply-runs" element={<SupplyRunsList />} />
            <Route path="supply-runs/new" element={<NewSupplyRun />} />
            <Route path="supply-runs/:id" element={<SupplyRunDetail />} />

            {/* Roster */}
            <Route path="roster" element={<RosterList />} />
            <Route path="roster/new" element={<NewEmployee />} />
            <Route path="roster/hr" element={<HRCredentials />} />
            <Route path="roster/:id" element={<EmployeeDetail />} />

            {/* Schedule */}
            <Route path="schedule" element={<Schedule />} />
            <Route path="schedule/calendar" element={<ScheduleCalendar />} />
            <Route path="schedule/generate" element={<GenerateSchedule />} />

            {/* ICS 214 */}
            <Route path="ics214" element={<ICS214List />} />
            <Route path="ics214/new" element={<NewICS214 />} />
            <Route path="ics214/:id" element={<ICS214Detail />} />
            <Route path="ics214/:id/activity" element={<ICS214Activity />} />

            {/* Other */}
            <Route path="analytics" element={<Analytics />} />
            <Route path="billing" element={<Billing />} />
            <Route path="comp-claims" element={<CompClaimsList />} />
            <Route path="comp-claims/new" element={<NewCompClaim />} />
            <Route path="consent/ama" element={<AMAConsent />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="documents" element={<DocumentsList />} />
            <Route path="documents/handbook" element={<Handbook />} />
            <Route path="documents/new" element={<NewDocument />} />
            <Route path="formulary" element={<Formulary />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="payroll/my" element={<MyPayroll />} />
            <Route path="profile" element={<Profile />} />
            <Route path="unsigned-orders" element={<UnsignedOrders />} />
            <Route path="dashboard/my-unit" element={<MyUnit />} />

            {/* Admin */}
            <Route path="admin" element={<Admin />} />
            <Route path="admin/announcements" element={<Announcements />} />
            <Route path="admin/chat-requests" element={<ChatRequests />} />
            <Route path="admin/company" element={<Company />} />
            <Route path="admin/fire-dashboard" element={<FireDashboard />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
