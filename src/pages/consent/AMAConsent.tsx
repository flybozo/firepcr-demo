import { Suspense } from 'react'
import { brand } from '@/lib/branding.config'
import { useAMAForm } from './components/useAMAForm'
import { AMAEncounterPicker } from './components/AMAEncounterPicker'
import { AMASuccessScreen } from './components/AMASuccessScreen'
import { AMAPatientInfoSection } from './components/AMAPatientInfoSection'
import { AMADisclosureSections } from './components/AMADisclosureSections'
import { AMASignatureSection } from './components/AMASignatureSection'

function AMAFormInner() {
  const {
    form,
    pickerUnit,
    setPickerUnit,
    pickerEncounters,
    assignment,
    encounterId,
    submitted,
    submitting,
    error,
    pdfUrl,
    pdfGenerating,
    patientSigRef,
    providerSigRef,
    formDate,
    formTime,
    patientName,
    handleChange,
    handleSubmit,
    handleDownloadPDF,
    handleReset,
    handleEncounterSelect1,
    handleEncounterSelect2,
  } = useAMAForm()

  if (submitted) {
    return (
      <AMASuccessScreen
        pdfUrl={pdfUrl}
        pdfGenerating={pdfGenerating}
        encounterId={encounterId}
        onDownloadPDF={handleDownloadPDF}
        onReset={handleReset}
      />
    )
  }

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-lg mx-auto p-6 space-y-6">

        {!encounterId && (
          <AMAEncounterPicker
            pickerUnit={pickerUnit}
            setPickerUnit={setPickerUnit}
            pickerEncounters={pickerEncounters}
            assignedUnitName={assignment.unit?.name}
            assignmentLoading={assignment.loading}
            onSelect={handleEncounterSelect1}
          />
        )}

        {!encounterId && (
          <AMAEncounterPicker
            pickerUnit={pickerUnit}
            setPickerUnit={setPickerUnit}
            pickerEncounters={pickerEncounters}
            assignedUnitName={assignment.unit?.name}
            assignmentLoading={assignment.loading}
            onSelect={handleEncounterSelect2}
          />
        )}

        <div className="text-center pt-4">
          <h1 className="text-xl font-bold text-red-500">REMOTE AREA MEDICINE</h1>
          <p className="text-sm text-gray-400">{brand.companyLegal} | DBA {brand.companyName}</p>
          <p className="text-xs text-gray-500">Medical Director: Aaron Stutz, MD</p>
          <p className="text-sm font-semibold mt-2">REFUSAL OF EMERGENCY MEDICAL CARE / AMA</p>
          <p className="text-xs text-gray-400 mt-1">{formDate} — {formTime}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AMAPatientInfoSection form={form} onChange={handleChange} />
          <AMADisclosureSections patientName={patientName} />
          <AMASignatureSection
            label="Patient Signature"
            sigRef={patientSigRef}
            formDate={formDate}
            formTime={formTime}
          />
          <AMASignatureSection
            label="EMS Provider"
            sigRef={providerSigRef}
            formDate={formDate}
            formTime={formTime}
            providerValue={form.provider_of_record}
            onProviderChange={handleChange}
          />

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors">
            {submitting ? 'Saving...' : 'Submit AMA Form'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AMAForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <AMAFormInner />
    </Suspense>
  )
}
