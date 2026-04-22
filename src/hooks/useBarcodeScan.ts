import { useState, useRef, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type ScanMessage = { text: string; type: 'success' | 'warn' | 'error' }

type ScanRun = {
  incident_unit_id: string | null
  unit_id?: string | null
  raw_barcodes: string[] | null
}

type ScanFormulary = {
  barcode?: string | null
  upc?: string | null
  item_name: string
  category: string
}

type ScanInventoryRow = {
  id: string
  item_name: string
  quantity: number
  barcode?: string | null
  upc?: string | null
}

interface UseBarcodeScanOptions {
  supplyRunId: string
  run: ScanRun | null
  formulary: ScanFormulary[]
  onScanComplete: () => Promise<void>
  onRunUpdate: (updater: (prev: any) => any) => void
  supabase: SupabaseClient
}

export function useBarcodeScan({
  supplyRunId,
  run,
  formulary,
  onScanComplete,
  onRunUpdate,
  supabase,
}: UseBarcodeScanOptions) {
  const [scanMode, setScanMode] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanMessage, setScanMessage] = useState<ScanMessage | null>(null)
  const [scanning, setScanning] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scanMode) {
      const t = setTimeout(() => barcodeRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [scanMode])

  const handleBarcodeScan = async (rawCode: string) => {
    if (!rawCode.trim() || scanning) return
    const code = rawCode.trim()
    setScanning(true)
    setBarcodeInput('')

    const unitId = run?.unit_id
    let added = false

    try {
      if (unitId) {
        const { data: invRows } = await supabase
          .from('unit_inventory')
          .select('id, item_name, quantity, barcode, upc')
          .eq('unit_id', unitId)

        const match = (invRows as ScanInventoryRow[] | null)?.find(
          row => row.barcode === code || row.upc === code
        )

        if (match) {
          const { error: itemErr } = await supabase.from('supply_run_items').insert({
            supply_run_id: supplyRunId,
            item_name: match.item_name,
            category: 'Supply',
            quantity: 1,
            barcode: code,
          })
          if (itemErr) throw new Error(itemErr.message)

          const newQty = Math.max(0, (match.quantity || 0) - 1)
          await supabase.from('unit_inventory').update({ quantity: newQty }).eq('id', match.id)

          setScanMessage({ text: `✓ Added: ${match.item_name}`, type: 'success' })
          added = true
          await onScanComplete()
        }
      }

      if (!added) {
        const formularyMatch = formulary.find(f => f.barcode === code || f.upc === code)

        if (formularyMatch) {
          const { error: itemErr } = await supabase.from('supply_run_items').insert({
            supply_run_id: supplyRunId,
            item_name: formularyMatch.item_name,
            category: formularyMatch.category || 'Supply',
            quantity: 1,
            barcode: code,
          })
          if (itemErr) throw new Error(itemErr.message)

          setScanMessage({ text: `✓ Added from formulary: ${formularyMatch.item_name}`, type: 'success' })
          added = true
          await onScanComplete()
        }
      }

      if (!added) {
        const existing = run?.raw_barcodes || []
        const updated = [...existing, code]
        await supabase.from('supply_runs').update({ raw_barcodes: updated }).eq('id', supplyRunId)
        setScanMessage({ text: `Unknown barcode: ${code}`, type: 'warn' })
        onRunUpdate(prev => prev ? { ...prev, raw_barcodes: updated } : prev)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan error'
      setScanMessage({ text: `Error: ${msg}`, type: 'error' })
    }

    setScanning(false)
    setTimeout(() => setScanMessage(null), 3000)
    setTimeout(() => barcodeRef.current?.focus(), 50)
  }

  return {
    scanMode, setScanMode,
    barcodeInput, setBarcodeInput,
    scanMessage,
    scanning,
    barcodeRef,
    handleBarcodeScan,
  }
}
