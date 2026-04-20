import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserAssignment } from '@/lib/useUserAssignment'
import type { ICS214Header, Activity, Personnel } from './types'

export function useICS214Data(ics214IdParam: string, assignment: UserAssignment) {
  const supabase = createClient()
  const [header, setHeader] = useState<ICS214Header | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!navigator.onLine) {
      const { getCachedData } = await import('@/lib/offlineStore')
      const cachedHeaders = await getCachedData('ics214s')
      const h = cachedHeaders.find((h: any) => h.ics214_id === ics214IdParam || h.id === ics214IdParam)
      if (h) setHeader(h as ICS214Header)
      const cachedActs = await getCachedData('ics214_activities')
      setActivities(cachedActs.filter((a: any) => a.ics214_id === ics214IdParam) as Activity[])
      const cachedPers = await getCachedData('ics214_personnel')
      setPersonnel(cachedPers.filter((p: any) => p.ics214_id === ics214IdParam) as Personnel[])
      setLoading(false)
      return
    }
    try {
      const [{ data: hData }, { data: aData }, { data: pData }] = await Promise.all([
        supabase.from('ics214_headers').select('*').eq('ics214_id', ics214IdParam).single(),
        supabase.from('ics214_activities').select('*').eq('ics214_id', ics214IdParam).order('log_datetime'),
        supabase.from('ics214_personnel').select('*').eq('ics214_id', ics214IdParam),
      ])
      setHeader(hData as ICS214Header | null)
      setActivities((aData as Activity[]) || [])
      setPersonnel((pData as Personnel[]) || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [ics214IdParam])

  const saveField = async (key: string, value: string) => {
    if (!header) return
    await supabase.from('ics214_headers').update({ [key]: value || null }).eq('ics214_id', ics214IdParam)
    setHeader(prev => prev ? { ...prev, [key]: value || null } : prev)
  }

  const addActivity = async ({ datetime, description }: { datetime: string; description: string }) => {
    const { getIsOnline } = await import('@/lib/syncManager')
    const { queueOfflineWrite } = await import('@/lib/offlineStore')
    const activityData = {
      ics214_id: ics214IdParam,
      log_datetime: datetime ? new Date(datetime).toISOString() : new Date().toISOString(),
      description: description.trim(),
      logged_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
      activity_type: 'activity',
    }
    if (getIsOnline()) {
      const { data } = await supabase.from('ics214_activities').insert(activityData).select().single()
      if (data) setActivities(prev => [...prev, data as Activity].sort((a, b) => a.log_datetime.localeCompare(b.log_datetime)))
    } else {
      const offlineEntry = { id: crypto.randomUUID(), ...activityData }
      await queueOfflineWrite('ics214_activities', 'insert', offlineEntry)
      setActivities(prev => [...prev, offlineEntry as unknown as Activity].sort((a, b) => a.log_datetime.localeCompare(b.log_datetime)))
    }
  }

  const addPersonnel = async ({ name, position, agency }: { name: string; position: string; agency: string }) => {
    const { data } = await supabase.from('ics214_personnel').insert({
      ics214_id: ics214IdParam,
      employee_name: name,
      ics_position: position,
      home_agency: agency,
    }).select().single()
    if (data) setPersonnel(prev => [...prev, data as Personnel])
  }

  return { supabase, header, setHeader, activities, setActivities, personnel, loading, load, saveField, addActivity, addPersonnel }
}
