import { useState } from 'react'

export function Avatar({ person, size = 32 }: { person: { name: string; headshot_url?: string | null }; size?: number }) {
  const [imgErr, setImgErr] = useState(false)
  const initial = person.name?.charAt(0).toUpperCase() || '?'

  if (person.headshot_url && !imgErr) {
    return (
      <img
        src={person.headshot_url}
        alt={person.name}
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-white font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}
