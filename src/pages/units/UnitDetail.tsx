import { useParams } from 'react-router-dom'
import QRCodeCard from '@/components/QRCodeCard'
import { brand } from '@/lib/branding.config'
import { LoadingSkeleton, EmptyState, ConfirmDialog } from '@/components/ui'
import { useUnitDetail } from './components/useUnitDetail'
import UnitHeader from './components/UnitHeader'
import VehicleDetails from './components/VehicleDetails'
import ClusterComponents from './components/ClusterComponents'
import CrewPanel from './components/CrewPanel'
import DeploymentHistory from './components/DeploymentHistory'
import InventorySummary from './components/InventorySummary'
import VehicleDocuments from './components/VehicleDocuments'

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const {
    unit, childUnits, inventory, allEmployees, loading, isOfflineData,
    deployments, incidentFilter, setIncidentFilter,
    addingTo, setAddingTo, selectedEmployee, setSelectedEmployee, saving,
    crewConflict, setCrewConflict, confirmCrewReassign,
    confirmAction, setConfirmAction,
    editingVehicle, setEditingVehicle, vehicleForm, setVehicleForm, savingVehicle,
    vehicleDocUrls, vehicleDocs, uploadingDoc, docType, setDocType,
    uploadingPhoto, photoInputRef,
    isAdmin,
    addCrewMember, removeCrewMember, setUnitStatus, saveVehicleDetails,
    handleDocUpload, handlePhotoUpload,
  } = useUnitDetail(id!)

  if (loading) return <LoadingSkeleton fullPage />
  if (!unit) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <EmptyState icon="🚑" message="Unit not found." actionHref="/units" actionLabel="← Back" />
    </div>
  )

  const activeIU = unit.incident_units?.find((iu: any) => iu.incident?.status === 'Active' && !iu.released_at)

  return (
    <div className="bg-gray-950 text-white pb-8">
      <ConfirmDialog
        open={!!crewConflict}
        title="Reassign Crew Member"
        icon="👥"
        message={crewConflict ? `${crewConflict.empName} is currently assigned to ${crewConflict.otherUnit}. Remove them from ${crewConflict.otherUnit} and assign to this unit instead?` : ''}
        confirmLabel="Reassign"
        confirmColor="bg-blue-600 hover:bg-blue-700"
        loading={saving}
        onConfirm={confirmCrewReassign}
        onCancel={() => setCrewConflict(null)}
      />
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">
        <UnitHeader
          unit={unit} activeIU={activeIU} isAdmin={isAdmin}
          isOfflineData={isOfflineData} onStatusChange={setUnitStatus}
        />
        <VehicleDetails
          unit={unit} isAdmin={isAdmin}
          editingVehicle={editingVehicle} vehicleForm={vehicleForm}
          savingVehicle={savingVehicle} uploadingPhoto={uploadingPhoto}
          photoInputRef={photoInputRef}
          onEditStart={() => setEditingVehicle(true)}
          onEditCancel={() => setEditingVehicle(false)}
          onFormChange={(field, value) => setVehicleForm(f => ({ ...f, [field]: value }))}
          onSave={saveVehicleDetails}
          onPhotoUpload={handlePhotoUpload}
        />
        <ClusterComponents childUnits={childUnits} />
        {activeIU && (
          <CrewPanel
            activeIU={activeIU} isAdmin={isAdmin} allEmployees={allEmployees}
            addingTo={addingTo} selectedEmployee={selectedEmployee} saving={saving}
            onAddStart={() => setAddingTo(activeIU.id)}
            onAddCancel={() => setAddingTo(null)}
            onEmployeeSelect={setSelectedEmployee}
            onAddCrew={addCrewMember}
            onRemoveCrew={removeCrewMember}
          />
        )}
        {isAdmin && (
          <DeploymentHistory
            deployments={deployments}
            defaultContractRate={unit.unit_type?.default_contract_rate ?? 0}
            incidentFilter={incidentFilter}
            onFilterChange={setIncidentFilter}
          />
        )}
        <InventorySummary inventory={inventory} unitName={unit.name} />
        {!activeIU && (
          <div className="theme-card rounded-xl p-4 border text-center text-gray-600 text-sm">
            Not currently deployed to an active incident.
          </div>
        )}
        <div className="theme-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-gray-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle QR Code</h2>
            <p className="text-xs text-gray-500 mt-0.5">Print and affix as a sticker — links to this vehicle's details, documents, and credentials.</p>
          </div>
          <QRCodeCard
            url={`${brand.appUrl}/units/${unit.id}`}
            label={unit.name}
            sublabel={unit.unit_type?.name ?? undefined}
            downloadName={`${unit.name.replace(/\s+/g, '-')}-QR`}
            size={180}
          />
        </div>
        <VehicleDocuments
          vehicleDocs={vehicleDocs} vehicleDocUrls={vehicleDocUrls}
          docType={docType} uploadingDoc={uploadingDoc}
          onDocTypeChange={setDocType} onDocUpload={handleDocUpload}
        />
      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
