import type { Unit, VehicleForm } from './types'

type Props = {
  unit: Unit
  isAdmin: boolean
  editingVehicle: boolean
  vehicleForm: VehicleForm
  savingVehicle: boolean
  uploadingPhoto: boolean
  photoInputRef: React.RefObject<HTMLInputElement>
  onEditStart: () => void
  onEditCancel: () => void
  onFormChange: (field: keyof VehicleForm, value: string) => void
  onSave: () => void
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function VehicleDetails({
  unit, isAdmin, editingVehicle, vehicleForm, savingVehicle, uploadingPhoto,
  photoInputRef, onEditStart, onEditCancel, onFormChange, onSave, onPhotoUpload,
}: Props) {
  const vehicleLabel = [unit.year, unit.make, unit.model].filter(Boolean).join(' ') || null

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle Details</h2>
        {!editingVehicle && isAdmin && (
          <button onClick={onEditStart} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            Edit
          </button>
        )}
      </div>

      {!editingVehicle ? (
        <div className="p-4 flex gap-4">
          <div className="shrink-0 relative group">
            {unit.photo_url ? (
              <img src={unit.photo_url} alt={unit.name} className="w-20 h-20 object-cover rounded-lg" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-2xl">📷</div>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 bg-black/0 hover:bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoUpload} />
              </>
            )}
          </div>
          <div className="flex-1 space-y-2 text-sm">
            {vehicleLabel ? (
              <p className="font-semibold text-white">{vehicleLabel}</p>
            ) : (
              <p className="text-gray-600 italic">No vehicle info</p>
            )}
            {unit.vin && (
              <p className="font-mono text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded inline-block">{unit.vin}</p>
            )}
            {(unit.license_plate || unit.plate_state) && (
              <p className="text-gray-400 text-xs">
                {[unit.license_plate, unit.plate_state].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <input value={vehicleForm.make} onChange={e => onFormChange('make', e.target.value)} placeholder="Make"
              className="col-span-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <input value={vehicleForm.model} onChange={e => onFormChange('model', e.target.value)} placeholder="Model"
              className="col-span-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <input value={vehicleForm.year} onChange={e => onFormChange('year', e.target.value)} placeholder="Year" type="number"
              className="col-span-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <input value={vehicleForm.vin} onChange={e => onFormChange('vin', e.target.value)} placeholder="VIN"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500" />
          <div className="grid grid-cols-2 gap-2">
            <input value={vehicleForm.license_plate} onChange={e => onFormChange('license_plate', e.target.value)} placeholder="License Plate"
              className="bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <input value={vehicleForm.plate_state} onChange={e => onFormChange('plate_state', e.target.value)} placeholder="State (e.g. CA)"
              className="bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <p className="text-xs text-gray-500">Photo: use the camera icon on the unit thumbnail to upload.</p>
          <div className="flex gap-2">
            <button onClick={onSave} disabled={savingVehicle}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors">
              {savingVehicle ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onEditCancel} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
