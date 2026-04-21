import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChannelItem } from './ChannelItem'
import type { ChatChannel } from '@/types/chat'

type SectionKey = 'company' | 'incident' | 'unit' | 'direct' | 'external'

const SECTION_META: Record<SectionKey, { title: string; color: string; icon: string }> = {
  company:  { title: 'Company',          color: 'bg-blue-900/30 text-blue-300/80',     icon: '🏢' },
  incident: { title: 'Incidents',        color: 'bg-red-900/30 text-red-300/80',       icon: '🔥' },
  unit:     { title: 'Units',            color: 'bg-green-900/30 text-green-300/80',   icon: '🚑' },
  direct:   { title: 'Direct Messages',  color: 'bg-purple-900/30 text-purple-300/80', icon: '💬' },
  external: { title: 'External',         color: 'bg-orange-900/30 text-orange-300/80', icon: '🔥' },
}

const DEFAULT_ORDER: SectionKey[] = ['company', 'incident', 'unit', 'direct', 'external']
const STORAGE_KEY = 'chat-section-order'
const COLLAPSED_KEY = 'chat-sections-collapsed'

function loadOrder(): SectionKey[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as SectionKey[]
      // Ensure all keys present
      const set = new Set(parsed)
      for (const k of DEFAULT_ORDER) { if (!set.has(k)) parsed.push(k) }
      return parsed.filter((k) => DEFAULT_ORDER.includes(k))
    }
  } catch {}
  return [...DEFAULT_ORDER]
}

function loadCollapsed(): Set<string> {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    if (saved) return new Set(JSON.parse(saved))
  } catch {}
  return new Set()
}

// ── Draggable section wrapper ────────────────────────────────────────────────
function DraggableSection({ id, render }: { id: string; render: (listeners: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : 0,
      }}
      {...attributes}
    >
      {render(listeners ?? {})}
    </div>
  )
}

function Section({ sectionKey, items, activeChannelId, onSelectChannel, unreadByChannel, onDeleteDM, onArchive, collapsed, onToggle, dragListeners }: {
  sectionKey: SectionKey
  items: ChatChannel[]
  activeChannelId: string | null
  onSelectChannel: (ch: ChatChannel) => void
  unreadByChannel: Record<string, number>
  onDeleteDM: (channelId: string) => void
  onArchive: (channelId: string, action: 'archive' | 'unarchive') => void
  collapsed: boolean
  onToggle: () => void
  dragListeners?: Record<string, unknown>
}) {
  if (!items.length) return null
  const meta = SECTION_META[sectionKey]
  const totalUnread = items.reduce((sum, ch) => sum + (unreadByChannel[ch.id] || 0), 0)

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg mx-1 mt-1 ${meta.color} transition-colors hover:brightness-110`}
      >
        {/* Drag handle */}
        <span
          className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 select-none"
          onClick={(e) => e.stopPropagation()}
          {...(dragListeners || {})}
        >
          ⠿
        </span>
        <span>{meta.icon}</span>
        <span className="text-gray-300">{meta.title}</span>
        {totalUnread > 0 && (
          <span className="ml-auto mr-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        <span className={`ml-auto text-gray-500 text-[9px] transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
      </button>
      {!collapsed && (
        <div>
          {items.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={activeChannelId === ch.id}
              onClick={() => onSelectChannel(ch)}
              unreadCount={unreadByChannel[ch.id] || 0}
              onDelete={ch.type === 'direct' ? onDeleteDM : undefined}
              onArchive={onArchive}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ChannelListPanel({
  channels,
  activeChannelId,
  onSelectChannel,
  unreadByChannel,
  onNewDM,
  onDeleteDM,
  onArchive,
  loading,
}: {
  channels: ChatChannel[]
  activeChannelId: string | null
  onSelectChannel: (ch: ChatChannel) => void
  unreadByChannel: Record<string, number>
  onNewDM: () => void
  onDeleteDM: (channelId: string) => void
  onArchive: (channelId: string, action: 'archive' | 'unarchive') => void
  loading: boolean
}) {
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(loadOrder)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(loadCollapsed)
  const [archivedExpanded, setArchivedExpanded] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Persist order
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionOrder))
  }, [sectionOrder])

  // Persist collapsed
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedSections]))
  }, [collapsedSections])

  const toggleCollapse = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSectionOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as SectionKey)
      const newIndex = prev.indexOf(over.id as SectionKey)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const active = channels.filter((c) => !c.archived_at)
  const archived = channels.filter((c) => !!c.archived_at)

  const grouped: Record<SectionKey, ChatChannel[]> = {
    company: active.filter((c) => c.type === 'company'),
    incident: active.filter((c) => c.type === 'incident'),
    unit: active.filter((c) => c.type === 'unit'),
    direct: active.filter((c) => c.type === 'direct'),
    external: active.filter((c) => c.type === 'external'),
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex items-center justify-between px-4 py-3 mb-1">
        <h2 className="text-lg font-bold text-white">Team Chat</h2>
        <button
          onClick={onNewDM}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <span>✏️</span>
          <span>New DM</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            <p className="text-2xl mb-2">💬</p>
            <p>No channels yet</p>
            <p className="text-xs mt-1 text-gray-600">Channels will appear when you join an incident or unit</p>
          </div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                {sectionOrder.map((key) => (
                  <DraggableSection key={key} id={key} render={(listeners) => (
                      <Section
                        sectionKey={key}
                        items={grouped[key]}
                        activeChannelId={activeChannelId}
                        onSelectChannel={onSelectChannel}
                        unreadByChannel={unreadByChannel}
                        onDeleteDM={onDeleteDM}
                        onArchive={onArchive}
                        collapsed={collapsedSections.has(key)}
                        onToggle={() => toggleCollapse(key)}
                        dragListeners={listeners}
                      />
                    )} />
                ))}
              </SortableContext>
            </DndContext>

            {archived.length > 0 && (
              <div>
                <button
                  onClick={() => setArchivedExpanded((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg mx-1 mt-1 bg-gray-800/30 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <span className="text-gray-600">⠿</span>
                  <span>📦</span>
                  <span>Archived ({archived.length})</span>
                  <span className={`ml-auto text-gray-500 text-[9px] transition-transform ${archivedExpanded ? 'rotate-90' : ''}`}>▶</span>
                </button>
                {archivedExpanded && (
                  <div className="opacity-60">
                    {archived.map((ch) => (
                      <ChannelItem
                        key={ch.id}
                        channel={ch}
                        isActive={activeChannelId === ch.id}
                        onClick={() => onSelectChannel(ch)}
                        unreadCount={unreadByChannel[ch.id] || 0}
                        onDelete={ch.type === 'direct' ? onDeleteDM : undefined}
                        onArchive={onArchive}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
