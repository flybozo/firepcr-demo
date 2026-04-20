
type Props = {
  lotNumber: string
  expDate: string
}

export function CSWarningBanner({ lotNumber, expDate }: Props) {
  return (
    <div className="bg-orange-950 border border-orange-600 rounded-xl p-4 mb-4 flex items-start gap-3">
      <span className="text-2xl">⚠️</span>
      <div className="flex-1">
        <p className="text-orange-400 font-bold text-sm">CONTROLLED SUBSTANCE</p>
        {(lotNumber || expDate) ? (
          <p className="text-orange-300 text-xs mt-1 font-mono">
            {lotNumber ? `Lot: ${lotNumber}` : ''}
            {lotNumber && expDate ? ' | ' : ''}
            {expDate ? `Exp: ${expDate}` : ''}
          </p>
        ) : null}
        <p className="text-orange-300 text-xs mt-1">Waste witness and signature required. All CS transactions are logged.</p>
      </div>
    </div>
  )
}
