export type Sender = { id: string | null; name: string; headshot_url?: string | null }

export type ReplyMessage = {
  id: string
  content: string
  sender: Sender
}

export type ChatMessage = {
  id: string
  channel_id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  file_url?: string | null
  file_name?: string | null
  reply_to?: string | null
  reply_message?: ReplyMessage | null
  edited_at?: string | null
  deleted_at?: string | null
  created_at: string
  sender: Sender
  external_sender_name?: string | null
  access_code_id?: string | null
}

export type LastMessage = {
  id: string
  content: string
  message_type: string
  created_at: string
  sender?: { name: string }
}

export type ChatChannel = {
  id: string
  type: 'company' | 'incident' | 'unit' | 'direct' | 'external'
  name: string
  description?: string | null
  incident_id?: string | null
  unit_id?: string | null
  created_at: string
  updated_at: string
  last_message?: LastMessage | null
  unread_count: number
  my_role: string
  last_read_at?: string | null
  archived_at?: string | null
}

export type Employee = { id: string; name: string; headshot_url?: string | null; role?: string }
