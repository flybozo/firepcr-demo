import type { ListStyle } from '@/components/ThemeProvider'

/**
 * Returns CSS class names for list containers and rows based on the user's
 * list style preference ('card' or 'list').
 *
 * Selection colors use CSS custom properties (--theme-primary) so they
 * automatically match the sidebar / color scheme chosen in profile settings.
 */
export function getListClasses(style: ListStyle) {
  const isCard = style === 'card'
  return {
    /** Outer container wrapping all rows */
    container: isCard
      ? 'theme-card rounded-xl border overflow-hidden'
      : 'overflow-hidden',
    /** Column header row */
    header: isCard
      ? 'border-b border-gray-700'
      : 'border-b border-gray-800',
    /** Individual row (non-selected) */
    row: isCard
      ? 'border-b border-gray-800/50 list-row-hover-card transition-colors'
      : 'border-l-2 border-l-transparent border-b border-b-gray-800/30 hover:bg-gray-800/40 transition-colors',
    /** Selected row (for split-panel views) */
    rowSelected: isCard
      ? 'border-b border-gray-800/50 list-row-selected-card transition-colors'
      : 'list-row-selected-list transition-colors',
    /** Row divider wrapper */
    divider: isCard
      ? ''
      : '',
    /** Group header (unit name sections) */
    groupHeader: isCard
      ? 'px-4 py-3 border-b border-gray-800 bg-gray-800/40'
      : 'px-3 py-2 bg-gray-800/40 border-b border-gray-800 sticky top-0 z-10',
    /** Helper to pick row class based on selection state */
    rowCls: (selected: boolean) => selected
      ? (isCard
        ? 'border-b border-gray-800/50 list-row-selected-card transition-colors'
        : 'list-row-selected-list transition-colors')
      : (isCard
        ? 'border-b border-gray-800/50 list-row-hover-card transition-colors'
        : 'border-l-2 border-l-transparent border-b border-b-gray-800/30 hover:bg-gray-800/40 transition-colors'),
  }
}
