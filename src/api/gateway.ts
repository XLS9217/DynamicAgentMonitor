import { request } from './request'

export interface SessionSummary {
  session_id: string
  setting: string
  webhook_url: string
  reconnect_keep: number
  disconnect_time: number | null
  connected: boolean
  expired: boolean
  message_count: number
}

export interface SessionMessage {
  role: string
  content: string
  [key: string]: unknown
}

export interface RagCache {
  query: string
  knowledge: unknown
  retrieved_at: number
}

export interface SessionsResponse {
  status: string
  sessions: SessionSummary[]
}

export interface SessionDetailResponse {
  status: string
  session: SessionSummary
  messages: SessionMessage[]
  rag: RagCache | null
}

export async function getSessions(): Promise<SessionSummary[]> {
  const response = await request.get<SessionsResponse>('/monitor/sessions')
  return response.data.sessions
}

export async function getSession(sessionId: string): Promise<SessionDetailResponse> {
  const response = await request.get<SessionDetailResponse>(`/monitor/sessions/${sessionId}`)
  return response.data
}
