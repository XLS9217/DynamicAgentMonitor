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

export interface BucketSummary {
  name: string
  description: string
}

export interface BlueprintSummary {
  id: string
  name: string
  description: string
  attributes: Record<
    string,
    {
      description: string
      is_identifier: boolean
    }
  >
}

export interface BucketsResponse {
  status: string
  buckets: BucketSummary[]
}

export interface BlueprintsResponse {
  status: string
  blueprints: BlueprintSummary[]
}

export interface BlueprintInstancesResponse {
  status: string
  blueprint_id: string
  instances: Record<string, unknown>[]
}

export async function getSessions(): Promise<SessionSummary[]> {
  const response = await request.get<SessionsResponse>('/monitor/sessions')
  return response.data.sessions
}

export async function getSession(sessionId: string): Promise<SessionDetailResponse> {
  const response = await request.get<SessionDetailResponse>(`/monitor/sessions/${sessionId}`)
  return response.data
}

export async function getBuckets(): Promise<BucketSummary[]> {
  const response = await request.get<BucketsResponse>('/buckets')
  return response.data.buckets
}

export async function getBucketBlueprints(bucketName: string): Promise<BlueprintSummary[]> {
  const response = await request.get<BlueprintsResponse>(
    `/buckets/${encodeURIComponent(bucketName)}/blueprints`,
  )
  return response.data.blueprints
}

export async function getBlueprintInstances(
  blueprintId: string,
): Promise<Record<string, unknown>[]> {
  const response = await request.get<BlueprintInstancesResponse>(
    `/blueprints/${encodeURIComponent(blueprintId)}/instances`,
  )
  return response.data.instances
}
