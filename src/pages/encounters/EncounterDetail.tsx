import { useEffect, useCallback, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { usePermission } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useNEMSISWarnings } from '@/hooks/useNEMSISWarnings'
import PinSignature from '@/components/PinSignature'
import { LoadingSkeleton, EmptyState } from '@/components/ui'
import { AgencyLogo } from '@/components/AgencyLogo'
import { AMBULANCE_DEFAULT_ORDER, MEDUNIT_DEFAULT_ORDER, PATIENT_GENDER_OPTIONS } from '@/constants/nemsis'

import { useEncounterData } from '@/hooks/useEncounterData'
import { NEMSISTooltip } from '@/components/encounters/NEMSISTooltip'
import { InlineField } from '@/components/encounters/InlineField'
import { DraggableSection } from '@/components/encounters/DraggableSection'
import { VitalsSection } from '@/components/encounters/sections/VitalsSection'
import { MARSection } from '@/components/encounters/sections/MARSection'
import { ProceduresSection } from '@/components/encounters/sections/ProceduresSection'
import { PhotosSection } from '@/components/encounters/sections/PhotosSection'
import { FormsSection } from '@/components/encounters/sections/FormsSection'
import { ProgressNotesSection } from '@/components/encounters/sections/ProgressNotesSection'
import { EncounterActionsBar } from '@/components/encounters/sections/EncounterActionsBar'
import { NarrativeSection } from '@/components/encounters/sections/NarrativeSection'
import { ResponseSection } from '@/components/encounters/sections/ResponseSection'
import { SceneSection } from '@/components/encounters/sections/SceneSection'
import { AssessmentSection } from '@/components/encounters/sections/AssessmentSection'
import { CardiacArrestSection } from '@/components/encounters/sections/CardiacArrestSection'
import { TransportSection } from '@/components/encounters/sections/TransportSection'
import { ProviderSection } from '@/components/encounters/sections/ProviderSection'
import { acuityColor, acuityLabel, statusColor, formatDateTime } from '@/utils/encounterFormatters'

const ENC_DEFAULT_SPANS: Record<string, number> = { narrative: 1, vitals: 1 }

export default function EncounterDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id as string
  const canEdit = usePermission('encounters.edit')
  const currentUser = useUserAssignment()

  const {
    enc, setEnc,
    loading, isOfflineData, incidentName,
    additionalVitals, setAdditionalVitals,
    crewOptions, providerOptions,
    photos, procedures,
    consentForms, compClaims,
    marEntries, setMarEntries,
    progressNotes, setProgressNotes,
    photoSignedUrls, formPdfUrls,
    saveField, markComplete, deleteDraft, signAndLock,
  } = useEncounterData(id, currentUser, navigate)

  const [actionLoading, setActionLoading] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [cardOrder, setCardOrder] = useState<string[]>(AMBULANCE_DEFAULT_ORDER)
  const savedPrefRef = useRef(false)
  const [cardSpans, setCardSpans] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('encounter_card_spans') || '{}') } catch { return {} }
  })
  const getSpan = (cardId: string): 1 | 2 => Math.min(2, Math.max(1, cardSpans[cardId] ?? ENC_DEFAULT_SPANS[cardId] ?? 2)) as 1 | 2
  const cycleCardSpan = (cardId: string) => {
    setCardSpans(prev => {
      const current = prev[cardId] ?? ENC_DEFAULT_SPANS[cardId] ?? 2
      const updated = { ...prev, [cardId]: current === 1 ? 2 : 1 }
      localStorage.setItem('encounter_card_spans', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const loadPrefs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: pref } = await supabase
        .from('user_preferences').select('encounter_section_order')
        .eq('auth_user_id', user.id).single()
      const allSections = [...new Set([...AMBULANCE_DEFAULT_ORDER, ...MEDUNIT_DEFAULT_ORDER])]
      if (pref && (pref as any).encounter_section_order && Array.isArray((pref as any).encounter_section_order)) {
        let saved = (pref as any).encounter_section_order as string[]
        if (saved.includes('ama') || saved.includes('comp')) {
          const amaIdx = saved.indexOf('ama'), compIdx = saved.indexOf('comp')
          const insertAt = amaIdx >= 0 ? amaIdx : compIdx
          saved = saved.filter((s: string) => s !== 'ama' && s !== 'comp')
          if (!saved.includes('forms')) saved.splice(insertAt, 0, 'forms')
        }
        const merged = [...saved.filter((s: string) => allSections.includes(s)),
          ...allSections.filter((s: string) => !saved.includes(s))]
        setCardOrder(merged); savedPrefRef.current = true
      }
    }
    loadPrefs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enc && !savedPrefRef.current) {
      setCardOrder(enc.unit?.toUpperCase().startsWith('RAMBO') ? AMBULANCE_DEFAULT_ORDER : MEDUNIT_DEFAULT_ORDER)
    }
  }, [enc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setCardOrder(prev => {
        const newOrder = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return
          supabase.from('user_preferences').upsert({
            auth_user_id: user.id, encounter_section_order: newOrder, updated_at: new Date().toISOString(),
          }, { onConflict: 'auth_user_id' }).then(({ error }) => {
            if (error) console.error('Failed to save section order:', error.message)
          })
        })
        return newOrder
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allNemsisWarnings = useNEMSISWarnings(enc ?? {} as Record<string, any>)
  const isAmbulance = enc?.unit?.toUpperCase().startsWith('RAMBO') ?? false
  const nemsisWarnings = isAmbulance ? allNemsisWarnings : []
  const nemsisErrors = nemsisWarnings.filter((w: any) => w.severity === 'error')
  const nemsisWarningCount = nemsisWarnings.filter((w: any) => w.severity === 'warning').length
  const nemsisErrorCount = nemsisErrors.length
  const nemsisErrorCountRef = useRef(0); nemsisErrorCountRef.current = nemsisErrorCount
  const nemsisErrorsRef = useRef<any[]>([]); nemsisErrorsRef.current = nemsisErrors

  if (loading) return <LoadingSkeleton fullPage />
  if (!enc) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <EmptyState icon="📋" message="Encounter not found." actionHref="/encounters" actionLabel="← Back" />
    </div>
  )

  const patientName = enc.patient_last_name
    ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}` : enc.patient_first_name || 'Unknown Patient'
  const isSigned = enc.pcr_status === 'Signed'
  const isLocked = enc.pcr_status === 'Complete' || !!enc.signed_at
  const isDraft = !enc.pcr_status || enc.pcr_status === 'Draft'
  const isCreator = currentUser.employee?.name === enc.created_by ||
    (currentUser.employee?.id && enc.created_by_employee_id === currentUser.employee.id)
  const canDeleteDraft = isDraft && !isSigned && isCreator
  const canMedicate = !['EMT', 'Tech'].includes(currentUser.employee?.role || '')

  const SectionBadge = ({ section }: { section: string }) => {
    const issues = nemsisWarnings.filter((w: any) => w.section === section)
    const errs = issues.filter((w: any) => w.severity === 'error')
    if (!isAmbulance || issues.length === 0) return null
    return errs.length > 0
      ? <NEMSISTooltip issues={issues}><span className="text-xs px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-semibold cursor-help">🚫 {errs.length}</span></NEMSISTooltip>
      : <NEMSISTooltip issues={issues}><span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 font-semibold cursor-help">⚠️ {issues.length}</span></NEMSISTooltip>
  }

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">
        <Link to="/encounters" className="text-gray-500 hover:text-gray-300 text-sm">← Encounters</Link>

        {/* Status Bar */}
        <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${statusColor(enc.pcr_status)}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider">PCR Status</span>
            <span className="font-semibold">{enc.pcr_status || 'Draft'}</span>
            {marEntries.some((m: any) => m.requires_cosign && !m.provider_signature_url) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 font-semibold">✍️ Unsigned Order</span>
            )}
            {isAmbulance && !isLocked && (nemsisErrorCount > 0 ? (
              <NEMSISTooltip issues={nemsisErrors}>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 font-semibold cursor-help">🚫 {nemsisErrorCount} NEMSIS error{nemsisErrorCount > 1 ? 's' : ''}</span>
              </NEMSISTooltip>
            ) : nemsisWarningCount > 0 ? (
              <NEMSISTooltip issues={nemsisWarnings.filter((w: any) => w.severity === 'warning')}>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 font-semibold cursor-help">⚠️ {nemsisWarningCount} quality {nemsisWarningCount > 1 ? 'issues' : 'issue'}</span>
              </NEMSISTooltip>
            ) : allNemsisWarnings.length === 0 ? null : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-semibold">✅ NEMSIS ready</span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {canDeleteDraft && (
              <button onClick={() => setShowDeleteConfirm(true)} disabled={deleteLoading}
                className="px-3 py-1 text-xs bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 rounded-lg transition-colors border border-gray-700 hover:border-red-700">
                🗑️ Delete
              </button>
            )}
            {canEdit && !isSigned && <Link to={`/encounters/${enc.id}/edit`} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">Edit</Link>}
            {isCreator && (!enc.pcr_status || enc.pcr_status === 'Draft') && (
              <button onClick={async () => { setActionLoading(true); await markComplete(nemsisErrorCountRef.current, nemsisErrorsRef.current); setActionLoading(false) }} disabled={actionLoading}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold">Mark Complete</button>
            )}
            {isCreator && enc.pcr_status === 'Complete' && (
              <button onClick={() => setShowSignModal(true)} disabled={actionLoading}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold">🔐 Sign & Lock</button>
            )}
            {!isCreator && !isSigned && (
              <span className="text-xs text-amber-400 bg-amber-900/30 px-3 py-1 rounded-lg">
                📋 Created by {enc.created_by || 'unknown'} — pending review
              </span>
            )}
          </div>
        </div>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}
        {isSigned && (
          <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-3 text-sm text-green-300">
            🔒 Locked — signed by <strong>{enc.signed_by || 'unknown'}</strong>
            {enc.signed_at ? ` on ${formatDateTime(enc.signed_at)}` : ''}
          </div>
        )}

        {/* Header card */}
        <div className="theme-card rounded-xl p-4 border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex gap-2 items-start flex-wrap mb-0.5">
                <InlineField label="First Name" value={enc.patient_first_name} fieldKey="patient_first_name" isLocked={isLocked} onSave={saveField} />
                <InlineField label="Last Name" value={enc.patient_last_name} fieldKey="patient_last_name" isLocked={isLocked} onSave={saveField} />
              </div>
              <div className="flex gap-3 flex-wrap mt-1">
                <InlineField label="DOB" value={enc.patient_dob} fieldKey="patient_dob" isLocked={isLocked} onSave={saveField} type="date" />
                <InlineField label="Gender" value={enc.patient_gender} fieldKey="patient_gender" isLocked={isLocked} onSave={saveField} type="select" options={PATIENT_GENDER_OPTIONS} />
                <div className="flex items-center gap-1.5">
                  <AgencyLogo agency={enc.patient_agency} size={22} />
                  <InlineField label="Agency" value={enc.patient_agency} fieldKey="patient_agency" isLocked={isLocked} onSave={saveField} type="select" options={['Cal Fire','USFS','BLM','NPS','ODF','OES / CAL OES','California Conservation Corps','County Fire','Municipal Fire','State/Local Fire','Law Enforcement','BIA','USFWS','DOD','Private Contractor','Other']} />
                </div>
                {enc.patient_age ? <span className="text-gray-500 text-xs self-end pb-1">{enc.patient_age}y</span> : null}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {enc.encounter_id} · {enc.date} · {enc.unit}
                {enc.crew_resource_number && <span className="text-blue-400"> · CRN: {enc.crew_resource_number}</span>}
                {incidentName && <span className="text-orange-400"> · 🔥 {incidentName}</span>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {enc.initial_acuity && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${acuityColor(enc.initial_acuity)}`}>{acuityLabel(enc.initial_acuity)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Draggable Chart Sections */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative items-stretch">
              {cardOrder.map(sectionId => {
                const span = getSpan(sectionId)
                const cycleFn = () => cycleCardSpan(sectionId)
                switch (sectionId) {
                  case 'actions':
                    return <DraggableSection key="actions" id="actions" colSpan={span} onCycleSpan={cycleFn}><EncounterActionsBar enc={enc} isLocked={isLocked} canMedicate={canMedicate} /></DraggableSection>
                  case 'mar':
                    return <DraggableSection key="mar" id="mar" colSpan={span} onCycleSpan={cycleFn}><MARSection enc={enc} marEntries={marEntries} setMarEntries={setMarEntries} canMedicate={canMedicate} /></DraggableSection>
                  case 'vitals':
                    return <DraggableSection key="vitals" id="vitals" colSpan={span} onCycleSpan={cycleFn}><VitalsSection enc={enc} additionalVitals={additionalVitals} crewOptions={crewOptions} currentUser={currentUser} onVitalAdded={v => setAdditionalVitals(prev => [...prev, v])} /></DraggableSection>
                  case 'photos':
                    return <DraggableSection key="photos" id="photos" colSpan={span} onCycleSpan={cycleFn}><PhotosSection enc={enc} photos={photos} photoSignedUrls={photoSignedUrls} /></DraggableSection>
                  case 'procedures':
                    return <DraggableSection key="procedures" id="procedures" colSpan={span} onCycleSpan={cycleFn}><ProceduresSection enc={enc} procedures={procedures} canMedicate={canMedicate} /></DraggableSection>
                  case 'narrative':
                    return <DraggableSection key="narrative" id="narrative" colSpan={span} onCycleSpan={cycleFn}><NarrativeSection enc={enc} isLocked={isLocked} saveField={saveField} /></DraggableSection>
                  case 'response':
                    if (!isAmbulance) return null
                    return <DraggableSection key="response" id="response" colSpan={span} onCycleSpan={cycleFn}><ResponseSection enc={enc} isLocked={isLocked} saveField={saveField} badge={<SectionBadge section="times" />} /></DraggableSection>
                  case 'scene':
                    if (!isAmbulance) return null
                    return <DraggableSection key="scene" id="scene" colSpan={span} onCycleSpan={cycleFn}><SceneSection enc={enc} isLocked={isLocked} saveField={saveField} badge={<SectionBadge section="scene" />} onGpsCapture={coords => { saveField('scene_gps', coords); setEnc(prev => prev ? { ...prev, scene_gps: coords } : prev) }} /></DraggableSection>
                  case 'assessment':
                    return <DraggableSection key="assessment" id="assessment" colSpan={span} onCycleSpan={cycleFn}><AssessmentSection enc={enc} isLocked={isLocked} saveField={saveField} badge={<SectionBadge section="situation" />} /></DraggableSection>
                  case 'cardiac':
                    if (!isAmbulance) return null
                    return <DraggableSection key="cardiac" id="cardiac" colSpan={span} onCycleSpan={cycleFn}><CardiacArrestSection enc={enc} isLocked={isLocked} saveField={saveField} badge={<SectionBadge section="cardiac" />} /></DraggableSection>
                  case 'transport':
                    return <DraggableSection key="transport" id="transport" colSpan={span} onCycleSpan={cycleFn}><TransportSection enc={enc} isLocked={isLocked} saveField={saveField} badge={<SectionBadge section="disposition" />} /></DraggableSection>
                  case 'provider':
                    return <DraggableSection key="provider" id="provider" colSpan={span} onCycleSpan={cycleFn}><ProviderSection enc={enc} isLocked={isLocked} saveField={saveField} providerOptions={providerOptions} badge={<SectionBadge section="provider" />} /></DraggableSection>
                  case 'forms':
                    return <DraggableSection key="forms" id="forms" colSpan={span} onCycleSpan={cycleFn}><FormsSection enc={enc} isLocked={isLocked} consentForms={consentForms} compClaims={compClaims} formPdfUrls={formPdfUrls} /></DraggableSection>
                  case 'notes':
                    return <DraggableSection key="notes" id="notes" colSpan={span} onCycleSpan={cycleFn}><ProgressNotesSection enc={enc} currentUser={currentUser} isAdmin={canEdit} isSigned={isSigned} progressNotes={progressNotes} setProgressNotes={setProgressNotes} /></DraggableSection>
                  default: return null
                }
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Delete Draft Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white">Delete Draft Encounter?</h3>
              <p className="text-sm text-gray-400">This will remove <span className="text-white font-medium">{enc.encounter_id}</span> for <span className="text-white font-medium">{patientName}</span>.</p>
              <p className="text-xs text-gray-500">The record will be soft-deleted and can be recovered by an administrator if needed.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { setDeleteLoading(true); await deleteDraft() }} disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
                  {deleteLoading ? 'Deleting...' : '🗑️ Delete Draft'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* PIN modal — Sign & Lock PCR */}
        {showSignModal && currentUser.employee && (
          <PinSignature label="Sign & Lock PCR" mode="self"
            employeeId={currentUser.employee.id} employeeName={currentUser.employee.name}
            documentContext={enc?.encounter_id || id}
            onSign={async (record) => { setActionLoading(true); await signAndLock(record); setShowSignModal(false); setActionLoading(false) }}
            onCancel={() => setShowSignModal(false)}
          />
        )}

      </div>
    </div>
  )
}
