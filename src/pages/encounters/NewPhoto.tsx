
import EncounterPicker, { type PickedEncounter } from '@/components/EncounterPicker'

import { useCallback, useState, Suspense, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useNavigate, useSearchParams } from 'react-router-dom'

function PhotoUploadInner() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const unitParamFromUrl = ''

  // ── Encounter picker state and loader ──────────────────────────────────────
  const [pickerUnit, setPickerUnit] = useState(unitParamFromUrl || '')
  const [pickerEncounters, setPickerEncounters] = useState<{
    id: string; encounter_id: string
    patient_first_name: string|null; patient_last_name: string|null
    patient_dob: string|null; primary_symptom_text: string|null
    date: string|null; unit: string|null; provider_of_record: string|null
    incident_id: string|null
  }[]>([])

  const loadPickerEncounters = async (unitName: string) => {
    if (!unitName) { setPickerEncounters([]); return }
    const { data } = await supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, patient_dob: date_of_birth, primary_symptom_text, date, unit, provider_of_record, incident_id')
      .eq('unit', unitName)
      .order('date', { ascending: false })
      .limit(25)
    // patient_dob is date_of_birth column — handle gracefully
    setPickerEncounters((data as any) || [])
  }

  useEffect(() => {
    if (pickerUnit) loadPickerEncounters(pickerUnit)
  }, [pickerUnit])

  // Auto-fill pickerUnit from assignment
  useEffect(() => {
    if (!assignment.loading && assignment.unit?.name && !pickerUnit) {
      setPickerUnit(assignment.unit.name)
    }
  }, [assignment.loading, assignment.unit])

  const EncounterPicker = ({ onSelect }: { 
    onSelect: (enc: typeof pickerEncounters[0]) => void 
  }) => (
    <div className="bg-gray-900 rounded-xl p-4 border border-blue-900/50 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-blue-400">
        🔗 Link to Patient Encounter
      </h2>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Unit</label>
        {assignment.unit?.name && !assignment.loading ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
            <span className="text-sm text-white font-medium">{assignment.unit.name}</span>
            <span className="text-xs text-gray-500">(your unit)</span>
          </div>
        ) : (
          <select
            value={pickerUnit}
            onChange={e => setPickerUnit(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select unit...</option>
            {['Medic 1','Medic 2','Medic 3','Medic 4','Command 1','Aid 1','Aid 2','Rescue 1','Rescue 2'].map(u => <option key={u}>{u}</option>)}
          </select>
        )}
      </div>
      {pickerUnit && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Patient Encounter</label>
          {pickerEncounters.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No recent encounters on {pickerUnit}.</p>
          ) : (
            <select
              defaultValue=""
              onChange={e => {
                const enc = pickerEncounters.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
                if (enc) onSelect(enc)
              }}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select patient...</option>
              {pickerEncounters.map(enc => (
                <option key={enc.id} value={enc.encounter_id || enc.id}>
                  {enc.patient_last_name 
                    ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                    : 'Unknown'
                  } — {enc.primary_symptom_text || '—'} ({enc.date || '—'})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )


  const [selectedUUID, setSelectedUUID] = useState("")
  const [encounterOptions, setEncounterOptions] = useState<{id: string, encounter_id: string, patient_first_name: string|null, patient_last_name: string|null, primary_symptom_text: string|null, date: string|null, unit: string|null, provider_of_record: string|null}[]>([])


  // ─── Encounter picker UI ──────────────────────────────────────────────────
  const EncounterPickerSection = ({ onSelect }: { onSelect: (enc: typeof encounterOptions[0]) => void }) => (
    <div className="theme-card rounded-xl p-4 border space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Link to Patient Encounter
      </h2>
      {encounterOptions.length === 0 ? (
        <p className="text-xs text-gray-600">
          {encounterOptions !== undefined ? 'No recent encounters found.' : 'Loading...'}
        </p>
      ) : (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Select Patient</label>
          <select
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            defaultValue=""
            onChange={e => {
              const enc = encounterOptions.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
              if (enc) onSelect(enc)
            }}>
            <option value="">Select patient encounter...</option>
            {encounterOptions.map(enc => (
              <option key={enc.id} value={enc.encounter_id || enc.id}>
                {enc.patient_last_name
                  ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                  : 'Unknown Patient'
                } — {enc.primary_symptom_text || 'No complaint'} ({enc.date || '—'})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )

  const loadEncountersForUnit = async (unitName: string) => {
    if (!unitName) { setEncounterOptions([]); return }
    const { data } = await supabase
      .from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit, provider_of_record')
      .eq('unit', unitName)
      .order('date', { ascending: false })
      .limit(20)
    setEncounterOptions(data || [])
  }

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }, [])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const handleSubmit = async () => {
    if (!file) { setError('Please select an image.'); return }
    if (!encounterId) { setError('No encounter ID provided.'); return }
    setUploading(true)
    setError('')

    try {
      // 1. Look up the encounter UUID by encounter_id text
      const { data: enc, error: encErr } = await supabase
        .from('patient_encounters')
        .select('id, encounter_id')
        .eq('encounter_id', encounterId)
        .single()
      if (encErr || !enc) throw new Error(`Encounter not found: ${encounterId}`)

      // 2. Upload image to storage
      const ext = file.name.split('.').pop() || 'jpg'
      const timestamp = Date.now()
      const path = `encounters/${encounterId}/${timestamp}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('patient-photos')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadErr) {
        if (uploadErr.message?.includes('Bucket not found') || uploadErr.message?.includes('bucket')) {
          throw new Error('Storage bucket not set up — contact admin')
        }
        throw new Error(`Upload failed: ${uploadErr.message}`)
      }

      // 3. Store the storage path (bucket is private — signed URLs generated on display)
      const photoUrl = path  // store path, not public URL

      // 4. Insert into patient_photos
      const { error: insertErr } = await supabase.from('patient_photos').insert({
        encounter_id: enc.id,
        photo_url: photoUrl,
        caption: caption || null,
        taken_at: new Date().toISOString(),
      })
      if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`)

      // 5. Redirect to encounter
      navigate(`/encounters/${enc.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
    }
  }

  const inp = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8 mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-xl font-bold">Add Photo</h1>
            {encounterId && (
              <p className="text-xs text-gray-400">Adding photo to Encounter <span className="font-mono text-blue-400">{encounterId}</span></p>
            )}
          </div>
        </div>

        {!encounterId && (
        <EncounterPickerSection onSelect={enc => {
          const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
          // Store encounter UUID for photos table FK
          setSelectedUUID(enc.id)
        }} />
      )}
            <div className="theme-card rounded-xl p-4 border space-y-4">
          {/* Drag-drop / file input */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? 'border-red-500 bg-red-950/20' : 'border-gray-700 hover:border-gray-500'}`}
            onClick={() => document.getElementById('photo-input')?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📷</div>
                <p className="text-gray-400 text-sm">Tap to select or drag an image here</p>
                <p className="text-gray-600 text-xs">JPEG, PNG, HEIC supported</p>
              </div>
            )}
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {file && (
            <p className="text-xs text-gray-500 text-center">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>
          )}

          {/* Caption */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Caption (optional)</label>
            <input
              type="text"
              className={inp}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="e.g. Wound on left forearm, pre-treatment"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/30 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={uploading || !file}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors"
        >
          {uploading ? 'Uploading...' : '📤 Upload Photo'}
        </button>
      </div>
    </div>
  )
}

export default function PhotoUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <PhotoUploadInner />
    </Suspense>
  )
}
