import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-2 lg:col-span-3',
}

export function SortableCard({
  id,
  children,
  colSpan = 3,
}: {
  id: string
  colSpan?: 1 | 2 | 3
  children: (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', flexDirection: 'column' }} className={`group ${COL_SPAN_CLASSES[colSpan] || 'col-span-3'}`}>
      {children({ ...attributes, ...listeners })}
    </div>
  )
}
