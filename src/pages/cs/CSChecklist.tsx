
import { Link } from 'react-router-dom'
export default function ChecklistStubPage() {
  return (
    <div className="p-6 md:p-8 max-w-lg mt-8 md:mt-0">
      <h1 className="text-2xl font-bold mb-2">Daily Unit Checklist</h1>
      <p className="text-gray-400 text-sm mb-4">Complete the daily equipment and CS count checklist for your unit.</p>
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2">
        <p className="text-gray-500 text-sm">Templates seeded (84 items total):</p>
        <ul className="text-xs text-gray-400 space-y-1 ml-4">
          <li>🚑 Ambulance: CS Count, Vehicle, Equipment, Comms (25 items)</li>
          <li>🏥 Med Unit: CS Count, Trailer, Equipment, Comms (26 items)</li>
          <li>🧗 REMS: CS Count, Vehicles, Tech Rescue, Medical, Comms (33 items)</li>
        </ul>
        <p className="text-xs text-gray-600 mt-2">Full interactive checklist form coming in next build session.</p>
      </div>
      <Link to="/cs" className="block mt-4 text-center text-gray-600 text-sm">← CS Overview</Link>
    </div>
  )
}
