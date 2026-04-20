import { InlineField } from '@/components/encounters/InlineField'
import { toast } from '@/lib/toast'
import { SectionCard } from '@/components/encounters/SectionCard'
import { SCENE_TYPE_LABELS, FIRST_EMS_OPTIONS } from '@/constants/nemsis'
import type { Encounter } from '@/types/encounters'
import type React from 'react'

export function SceneSection({ enc, isLocked, saveField, onGpsCapture, badge }: {
  enc: Encounter
  isLocked: boolean
  saveField: (k: string, v: string) => void
  onGpsCapture: (coords: string) => void
  badge?: React.ReactNode
}) {
  return (
    <SectionCard title="Scene Information" badge={badge}>
      <InlineField label="Scene Type / Location" value={enc.scene_type} fieldKey="scene_type" isLocked={isLocked} onSave={saveField} type="select" options={SCENE_TYPE_LABELS} />
      <InlineField label="# Patients at Scene" value={enc.num_patients_at_scene} fieldKey="num_patients_at_scene" isLocked={isLocked} onSave={saveField} type="number" />
      <InlineField label="First Unit on Scene" value={enc.first_ems_unit_on_scene} fieldKey="first_ems_unit_on_scene" isLocked={isLocked} onSave={saveField} type="select" options={FIRST_EMS_OPTIONS} />
      <InlineField label="Scene Address" value={enc.scene_address} fieldKey="scene_address" isLocked={isLocked} onSave={saveField} />
      <InlineField label="City" value={enc.scene_city} fieldKey="scene_city" isLocked={isLocked} onSave={saveField} />
      <InlineField label="County" value={enc.scene_county} fieldKey="scene_county" isLocked={isLocked} onSave={saveField} />
      <InlineField label="State" value={enc.scene_state} fieldKey="scene_state" isLocked={isLocked} onSave={saveField} />
      <InlineField label="ZIP" value={enc.scene_zip} fieldKey="scene_zip" isLocked={isLocked} onSave={saveField} />
      <div className="col-span-full flex items-center gap-2">
        <div className="flex-1">
          <InlineField label="GPS Coordinates" value={enc.scene_gps} fieldKey="scene_gps" isLocked={isLocked} onSave={saveField} />
        </div>
        {!isLocked && (
          <button type="button"
            className="shrink-0 text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg flex items-center gap-1 transition-colors mt-4"
            onClick={() => {
              if (!navigator.geolocation) { toast.warning('Geolocation not available on this device.'); return }
              navigator.geolocation.getCurrentPosition(
                pos => onGpsCapture(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                err => toast.warning('GPS error: ' + err.message),
                { enableHighAccuracy: true, timeout: 10000 }
              )
            }}>
            📍 Get GPS
          </button>
        )}
      </div>
    </SectionCard>
  )
}
