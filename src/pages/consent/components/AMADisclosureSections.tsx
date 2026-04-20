import { brand } from '@/lib/branding.config'

const CAPACITY_ITEMS = [
  'Is alert and oriented to person, place, time, and event',
  'Understands their medical condition as explained',
  'Understands the risks of refusing care, including serious injury or DEATH',
  'Does NOT appear impaired by alcohol, drugs, or medical/psychiatric condition',
  'Is ≥ 18 years of age (or emancipated minor)',
]

const REFUSAL_ITEMS = [
  'All emergency medical treatment',
  'Transport to a medical facility',
]

interface Props {
  patientName: string
}

export function AMADisclosureSections({ patientName }: Props) {
  return (
    <>
      <section className="bg-gray-900 rounded-xl p-4 space-y-2">
        <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Capacity Assessment</h2>
        <p className="text-xs text-gray-400">The EMS provider certifies that the patient:</p>
        {CAPACITY_ITEMS.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 text-sm">✓</span>
            <span className="text-sm text-gray-300">{item}</span>
          </div>
        ))}
      </section>

      <section className="bg-gray-900 rounded-xl p-4 space-y-2">
        <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Refusal</h2>
        {REFUSAL_ITEMS.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-red-400 text-sm">✓</span>
            <span className="text-sm text-gray-300">{item}</span>
          </div>
        ))}
      </section>

      <section className="bg-gray-900 rounded-xl p-4">
        <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300 mb-2">Patient Statement & Release</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          I, <span className="text-white font-medium">{patientName}</span>, have been informed of my medical condition, the recommended treatment and/or transport, and the risks of refusal — including serious injury or death. I am voluntarily refusing the emergency medical care described above and release {brand.consentEntity} ({brand.companyLegal}), its medical director, and all EMS providers from any liability arising from this refusal. I have been advised to call 911 or seek emergency care immediately if my condition worsens.
        </p>
      </section>
    </>
  )
}
