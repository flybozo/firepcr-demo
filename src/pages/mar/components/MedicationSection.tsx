
import type { FormState, InventoryItem, FormularyItem } from '../types'
import { inputCls, labelCls, sectionCls, ROUTES, UNIT_OPTIONS } from '../types'

interface MedicationSectionProps {
  form: FormState
  unitInventory: InventoryItem[]
  filteredFormulary: FormularyItem[]
  loadingInventory: boolean
  hasUnitInventory: boolean
  entryType: 'Administered' | 'Dispensed'
  daysSupply: string
  unitParam: string
  onItemSelect: (name: string) => void
  onUnitChange: (name: string) => void
  set: (field: keyof FormState, value: string) => void
  setDaysSupply: (v: string) => void
  setRouteAutoSuggested: (v: boolean) => void
  setDosageAutoSuggested: (v: boolean) => void
}

export function MedicationSection({
  form, unitInventory, filteredFormulary, loadingInventory, hasUnitInventory,
  entryType, daysSupply, unitParam,
  onItemSelect, onUnitChange, set, setDaysSupply, setRouteAutoSuggested, setDosageAutoSuggested,
}: MedicationSectionProps) {
  const matchingItems = unitInventory.filter(i => i.item_name === form.item_name && i.quantity > 0)
  const hasMultipleLots = form.category === 'CS' && matchingItems.length > 1
  const csAutoFilled = form.category === 'CS' && matchingItems.length > 0

  return (
    <>
      <p className={sectionCls}>Administration Details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={labelCls}>Date *</label>
          <input type="date" className={inputCls + ' min-w-0'} value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Time *</label>
          <input type="time" className={inputCls + ' min-w-0'} value={form.time} onChange={e => set('time', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Unit *</label>
        {unitParam ? (
          <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm">{form.med_unit}</div>
        ) : (
          <select className={inputCls} value={form.med_unit} onChange={e => onUnitChange(e.target.value)}>
            <option value="">Select unit</option>
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      </div>

      <p className={sectionCls}>Medication</p>
      <div>
        <label className={labelCls}>
          Medication *
          {form.med_unit && hasUnitInventory && (
            <span className="ml-2 text-green-400 font-normal normal-case">
              ({unitInventory.length} in stock on {form.med_unit})
            </span>
          )}
          {form.med_unit && loadingInventory && (
            <span className="ml-2 text-gray-500 font-normal normal-case">Loading inventory...</span>
          )}
        </label>
        <select className={inputCls} value={form.item_name} onChange={e => onItemSelect(e.target.value)}>
          <option value="">Select medication</option>
          {hasUnitInventory ? (
            unitInventory.map(item => (
              <option key={item.id} value={item.item_name}>
                {item.item_name} — {item.category} (qty: {item.quantity})
              </option>
            ))
          ) : (
            filteredFormulary.map(item => (
              <option key={item.id} value={item.item_name}>{item.item_name}</option>
            ))
          )}
        </select>
      </div>

      {form.category && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Category:</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${form.category === 'CS' ? 'bg-orange-500 text-white' : form.category === 'Rx' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'}`}>
            {form.category}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={labelCls}>Lot Number{csAutoFilled ? ' — select from inventory' : ''}</label>
          {hasMultipleLots ? (
            <select
              className={inputCls}
              value={form.lot_number}
              onChange={e => {
                const item = matchingItems.find(i => i.cs_lot_number === e.target.value)
                set('lot_number', e.target.value)
                if (item?.cs_expiration_date) set('exp_date', item.cs_expiration_date)
              }}
            >
              <option value="">Select lot...</option>
              {matchingItems.map(i => (
                <option key={i.cs_lot_number || i.id} value={i.cs_lot_number || ''}>
                  {i.cs_lot_number || 'No lot'} (qty: {i.quantity}{i.cs_expiration_date ? `, exp ${i.cs_expiration_date}` : ''})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className={`${inputCls} ${csAutoFilled ? 'opacity-70 cursor-not-allowed' : ''}`}
              value={form.lot_number}
              onChange={e => !csAutoFilled && set('lot_number', e.target.value)}
              readOnly={!!csAutoFilled}
            />
          )}
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Expiration Date{csAutoFilled ? ' (auto-filled)' : ''}</label>
          <input
            type="date"
            className={`${inputCls} min-w-0 ${csAutoFilled ? 'opacity-70 cursor-not-allowed' : ''}`}
            value={form.exp_date}
            onChange={e => !csAutoFilled && set('exp_date', e.target.value)}
            readOnly={!!csAutoFilled}
          />
        </div>
      </div>

      <div className={`grid gap-3 ${entryType === 'Dispensed' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div>
          <label className={labelCls}>{entryType === 'Dispensed' ? 'Qty Dispensed' : 'Qty Used'} *</label>
          <input type="number" className={inputCls} value={form.qty_used} onChange={e => set('qty_used', e.target.value)} min="0" step="0.5" />
        </div>
        <div>
          <label className={labelCls}>Qty Wasted</label>
          <input type="number" className={inputCls} value={form.qty_wasted} onChange={e => set('qty_wasted', e.target.value)} min="0" step="0.5" />
        </div>
        {entryType === 'Dispensed' && (
          <div>
            <label className={labelCls}>Days Supply</label>
            <input type="number" className={inputCls} value={daysSupply} onChange={e => setDaysSupply(e.target.value)} min="1" step="1" placeholder="e.g. 7" />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Dosage Units</label>
        <input
          type="text"
          className={inputCls}
          value={form.dosage_units}
          onChange={e => { setDosageAutoSuggested(false); set('dosage_units', e.target.value) }}
          placeholder="mg, mcg, mL, etc."
        />
      </div>

      <div>
        <label className={labelCls}>Route of Administration</label>
        <select className={inputCls} value={form.medication_route} onChange={e => { setRouteAutoSuggested(false); set('medication_route', e.target.value) }}>
          <option value="">Select route</option>
          {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Sig / Directions</label>
        <input type="text" className={inputCls} value={form.sig_directions} onChange={e => set('sig_directions', e.target.value)} placeholder="e.g. 0.5mg IV push over 2 min" />
      </div>

      <div>
        <label className={labelCls}>Medication Authorization</label>
        <input type="text" className={inputCls} value={form.medication_authorization} onChange={e => set('medication_authorization', e.target.value)} placeholder="Protocol / order reference" />
      </div>
    </>
  )
}
