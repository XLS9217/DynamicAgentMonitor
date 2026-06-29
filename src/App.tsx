/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getSession,
  getSessions,
  type SessionDetailResponse,
  type SessionSummary,
} from './api/gateway'
import { API_BASE_URL } from './api/request'
import './App.css'

function formatTime(timestamp: number | null) {
  if (!timestamp) {
    return 'n/a'
  }

  return new Date(timestamp * 1000).toLocaleString()
}

function sessionState(session: SessionSummary) {
  if (session.expired) {
    return 'expired'
  }

  return session.connected ? 'connected' : 'disconnected'
}

function statusLabel(session: SessionSummary) {
  const state = sessionState(session)
  return state.charAt(0).toUpperCase() + state.slice(1)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

function getMonitorEventsUrl() {
  return `${API_BASE_URL.replace(/^http/, 'ws')}/monitor/events`
}

function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting',
  )
  const [error, setError] = useState<string | null>(null)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.session_id === selectedId) ?? null,
    [selectedId, sessions],
  )

  const refreshSessions = useCallback(async (preferredId: string | null = null) => {
    setLoadingSessions(true)
    setError(null)

    try {
      const nextSessions = await getSessions()
      const fallbackId = nextSessions[0]?.session_id ?? null
      const nextSelectedId = nextSessions.some((session) => session.session_id === preferredId)
        ? preferredId
        : fallbackId

      setSessions(nextSessions)
      setSelectedId(nextSelectedId)

      if (!nextSelectedId) {
        setDetail(null)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const refreshDetail = useCallback(async (sessionId: string) => {
    setLoadingDetail(true)
    setError(null)

    try {
      setDetail(await getSession(sessionId))
    } catch (requestError) {
      setDetail(null)
      setError(getErrorMessage(requestError))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    refreshSessions(null)
  }, [refreshSessions])

  useEffect(() => {
    if (selectedId) {
      refreshDetail(selectedId)
    }
  }, [refreshDetail, selectedId])

  useEffect(() => {
    const socket = new WebSocket(getMonitorEventsUrl())

    socket.onopen = () => setRealtimeState('connected')
    socket.onclose = () => setRealtimeState('disconnected')
    socket.onerror = () => setRealtimeState('disconnected')
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type?: string }
        if (message.type?.startsWith('session_')) {
          refreshSessions(selectedId)
        }
      } catch {
        return
      }
    }

    return () => socket.close()
  }, [refreshSessions, selectedId])

  return (
    <main className="monitor-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Local monitor API · {API_BASE_URL} · realtime {realtimeState}
          </p>
          <h1>Dynamic Agent Session Monitor</h1>
        </div>
        <button
          className="refresh-button"
          disabled={loadingSessions}
          onClick={() => refreshSessions(selectedId)}
          type="button"
        >
          Refresh
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="monitor-grid">
        <aside className="session-rail" aria-label="Session list">
          <div className="rail-header">
            <h2>Sessions</h2>
            <span>{sessions.length}</span>
          </div>

          {loadingSessions && <p className="empty-state">Loading sessions...</p>}
          {!loadingSessions && sessions.length === 0 && (
            <p className="empty-state">No active sessions.</p>
          )}

          <div className="session-list">
            {sessions.map((session) => (
              <button
                className={`session-row ${selectedId === session.session_id ? 'active' : ''}`}
                key={session.session_id}
                onClick={() => setSelectedId(session.session_id)}
                type="button"
              >
                <span className={`status-dot ${sessionState(session)}`} />
                <span className="session-copy">
                  <strong>{session.session_id}</strong>
                  <small>
                    {statusLabel(session)} · {session.message_count} messages
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-panel">
          {!selectedSession && (
            <div className="blank-panel">
              <h2>No session selected</h2>
              <p>Active sessions from the main service will appear in the list.</p>
            </div>
          )}

          {selectedSession && (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">{statusLabel(selectedSession)}</p>
                  <h2>{selectedSession.session_id}</h2>
                </div>
                <button
                  className="refresh-button secondary"
                  disabled={loadingDetail}
                  onClick={() => refreshDetail(selectedSession.session_id)}
                  type="button"
                >
                  Refresh Detail
                </button>
              </div>

              <dl className="metadata-grid">
                <div>
                  <dt>Setting</dt>
                  <dd>{selectedSession.setting}</dd>
                </div>
                <div>
                  <dt>Webhook</dt>
                  <dd>{selectedSession.webhook_url}</dd>
                </div>
                <div>
                  <dt>Reconnect Keep</dt>
                  <dd>{selectedSession.reconnect_keep}s</dd>
                </div>
                <div>
                  <dt>Disconnected At</dt>
                  <dd>{formatTime(selectedSession.disconnect_time)}</dd>
                </div>
              </dl>

              <div className="inspection-grid">
                <section className="messages-panel">
                  <h3>Messages</h3>
                  {loadingDetail && <p className="empty-state">Loading messages...</p>}
                  {!loadingDetail && detail?.messages.length === 0 && (
                    <p className="empty-state">No persisted messages.</p>
                  )}

                  {detail?.messages.map((message, index) => (
                    <article className="message-card" key={`${message.role}-${index}`}>
                      <strong>{message.role}</strong>
                      <p>{message.content}</p>
                    </article>
                  ))}
                </section>

                <section className="rag-panel">
                  <h3>Latest RAG</h3>
                  {!detail?.rag && <p className="empty-state">No RAG cache available.</p>}

                  {detail?.rag && (
                    <>
                      <div className="rag-summary">
                        <strong>{detail.rag.query}</strong>
                        <span>{formatTime(detail.rag.retrieved_at)}</span>
                      </div>
                      <pre>{JSON.stringify(detail.rag.knowledge, null, 2)}</pre>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
