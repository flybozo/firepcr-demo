import { useState } from 'react'
import { usePermission } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { ClinicalTab } from './components/ClinicalTab'
import { OperationsTab } from './components/OperationsTab'
import { WorkforceTab } from './components/WorkforceTab'
import OfflineGate from '@/components/OfflineGate'

type Tab = 'clinical' | 'operations' | 'workforce'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('clinical')
  const canAnalytics = usePermission('admin.analytics')
  const assignment = useUserAssignment()

  const assignedIncidentId = assignment.incidentUnit?.incident_id || null
  const assignedUnitNames: string[] = assignment.unit?.name ? [assignment.unit.name] : []

  const allTabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'clinical',   label: 'Clinical',   icon: '🩺' },
    { id: 'operations', label: 'Operations', icon: '🔥' },
    { id: 'workforce',  label: 'Workforce',  icon: '👥' },
  ]
  const tabs = !canAnalytics ? allTabs.filter(t => t.id === 'clinical') : allTabs

  return (
    <OfflineGate page message="Analytics requires a connection to load report data.">
    <div className="bg-gray-950 text-white pb-8">
      <div className="p-4 md:p-6 space-y-5">

        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">Analytics</h1>
            <p className="text-gray-500 text-xs">Field ops intelligence dashboard</p>
          </div>
          <span className="text-2xl select-none">📊</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'clinical'   && <ClinicalTab isField={!canAnalytics} assignedIncidentId={assignedIncidentId} assignedUnitNames={assignedUnitNames} />}
        {tab === 'operations' && <OperationsTab />}
        {tab === 'workforce'  && <WorkforceTab />}
      </div>
    </div>
    </OfflineGate>
  )
}
