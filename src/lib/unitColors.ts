// Consistent unit type colors and emojis across the whole app
// Order: Warehouse → Med Unit → Ambulance → REMS

export const UNIT_TYPE_COLORS: Record<string, string> = {
  'Warehouse': 'bg-purple-900 text-purple-300',
  'Med Unit':  'bg-blue-900 text-blue-300',
  'Ambulance': 'bg-red-900 text-red-300',
  'Rescue':      'bg-green-900 text-green-300',
}

export const UNIT_TYPE_EMOJI: Record<string, string> = {
  'Warehouse': '🏭',
  'Med Unit':  '🏥',
  'Ambulance': '🚑',
  'Rescue':      '🧗',
}

// Active filter button color by unit type
export const UNIT_FILTER_ACTIVE: Record<string, string> = {
  'All':       'bg-gray-600 text-white',
  'Warehouse': 'bg-purple-700 text-white',
  'Med Unit':  'bg-blue-700 text-white',
  'Ambulance': 'bg-red-700 text-white',
  'Rescue':      'bg-green-700 text-white',
}

// Sort order for unit types
export const UNIT_TYPE_ORDER: Record<string, number> = {
  'Warehouse': 0,
  'Med Unit':  1,
  'Ambulance': 2,
  'Rescue':      3,
}

export function unitTypeColor(typeName: string): string {
  return UNIT_TYPE_COLORS[typeName] || 'bg-gray-700 text-gray-400'
}

export function unitEmoji(typeName: string): string {
  return UNIT_TYPE_EMOJI[typeName] || '🚐'
}

export function unitFilterButtonClass(typeName: string, isActive: boolean): string {
  if (!isActive) return 'bg-gray-800 text-gray-400 hover:bg-gray-700'
  return UNIT_FILTER_ACTIVE[typeName] || 'bg-gray-600 text-white'
}

// Sort an array of unit names in canonical order (Warehouse → Med Unit → Ambulance → REMS → alpha)
export function sortUnitNames(
  unitNames: string[],
  getType: (name: string) => string
): string[] {
  return [...unitNames].sort((a, b) => {
    const aOrder = UNIT_TYPE_ORDER[getType(a)] ?? 99
    const bOrder = UNIT_TYPE_ORDER[getType(b)] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })
}
