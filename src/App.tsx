import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import AuthGuard from '@/components/AuthGuard'
import AppLayout from '@/layouts/AppLayout'

// Auth
import Login from '@/pages/auth/Login'

// Core pages
import Dashboard from '@/pages/Dashboard'

// Encounters
import EncountersList from '@/pages/encounters/EncountersList'
import NewEncounter from '@/pages/encounters/NewEncounter'
import NewSimpleEncounter from '@/pages/encounters/NewSimpleEncounter'
import NewPCREncounter from '@/pages/encounters/NewPCREncounter'
import EncounterDetail from '@/pages/encounters/EncounterDetail'
import EncounterEdit from '@/pages/encounters/EncounterEdit'
import NewPhoto from '@/pages/encounters/NewPhoto'
import NewProcedure from '@/pages/encounters/NewProcedure'

// MAR
import MARList from '@/pages/mar/MARList'
import MARNew from '@/pages/mar/MARNew'
import MARDetail from '@/pages/mar/MARDetail'

// Incidents
import IncidentsList from '@/pages/incidents/IncidentsList'
import NewIncident from '@/pages/incidents/NewIncident'
import IncidentDetail from '@/pages/incidents/IncidentDetail'
import ShiftTicket from '@/pages/incidents/ShiftTicket'

// Units
import UnitsList from '@/pages/units/UnitsList'
import NewUnit from '@/pages/units/NewUnit'
import UnitDetail from '@/pages/units/UnitDetail'

// CS
import CSOverview from '@/pages/cs/CSOverview'
import CSReceive from '@/pages/cs/CSReceive'
import CSTransfer from '@/pages/cs/CSTransfer'
import CSCount from '@/pages/cs/CSCount'
import CSAudit from '@/pages/cs/CSAudit'
import CSChecklist from '@/pages/cs/CSChecklist'
import CSInventoryCount from '@/pages/cs/CSInventoryCount'

// Inventory
import InventoryList from '@/pages/inventory/InventoryList'
import InventoryAdd from '@/pages/inventory/InventoryAdd'
import InventoryDetail from '@/pages/inventory/InventoryDetail'
import BurnRate from '@/pages/inventory/BurnRate'
import Reorder from '@/pages/inventory/Reorder'

// Supply Runs
import SupplyRunsList from '@/pages/supply-runs/SupplyRunsList'
import NewSupplyRun from '@/pages/supply-runs/NewSupplyRun'
import SupplyRunDetail from '@/pages/supply-runs/SupplyRunDetail'

// Roster
import RosterList from '@/pages/roster/RosterList'
import NewEmployee from '@/pages/roster/NewEmployee'
import HRCredentials from '@/pages/roster/HRCredentials'
import EmployeeDetail from '@/pages/roster/EmployeeDetail'

// Schedule
import Schedule from '@/pages/schedule/Schedule'
import ScheduleCalendar from '@/pages/schedule/ScheduleCalendar'
import GenerateSchedule from '@/pages/schedule/GenerateSchedule'

// ICS 214
import ICS214List from '@/pages/ics214/ICS214List'
import NewICS214 from '@/pages/ics214/NewICS214'
import ICS214Detail from '@/pages/ics214/ICS214Detail'
import ICS214Activity from '@/pages/ics214/ICS214Activity'

// Other
import Analytics from '@/pages/analytics/Analytics'
import Billing from '@/pages/billing/Billing'
import CompClaimsList from '@/pages/comp-claims/CompClaimsList'
import NewCompClaim from '@/pages/comp-claims/NewCompClaim'
import AMAConsent from '@/pages/consent/AMAConsent'
import Contacts from '@/pages/contacts/Contacts'
import DocumentsList from '@/pages/documents/DocumentsList'
import Handbook from '@/pages/documents/Handbook'
import NewDocument from '@/pages/documents/NewDocument'
import Formulary from '@/pages/formulary/Formulary'
import Payroll from '@/pages/payroll/Payroll'
import MyPayroll from '@/pages/payroll/MyPayroll'
import Profile from '@/pages/profile/Profile'
import UnsignedOrders from '@/pages/unsigned-orders/UnsignedOrders'
import MyUnit from '@/pages/dashboard/MyUnit'

// Admin
import Admin from '@/pages/admin/Admin'
import Announcements from '@/pages/admin/Announcements'
import ChatRequests from '@/pages/admin/ChatRequests'
import Company from '@/pages/admin/Company'
import FireDashboard from '@/pages/admin/FireDashboard'


function App() {
  return (
    <BrowserRouter>
      <>
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
      </>
    </BrowserRouter>
  )
}

export default App
