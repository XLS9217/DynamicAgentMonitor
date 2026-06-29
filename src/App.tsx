/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getBlueprintInstances,
  getBucketBlueprints,
  getBuckets,
  getSession,
  getSessions,
  type BlueprintSummary,
  type BucketSummary,
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

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="json-null">null</span>
  }

  if (Array.isArray(value)) {
    return (
      <div className="json-block" style={{ paddingLeft: depth ? 14 : 0 }}>
        {value.map((item, index) => (
          <div className="json-line" key={index}>
            <span className="json-key">{index}</span>
            <JsonValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    return (
      <div className="json-block" style={{ paddingLeft: depth ? 14 : 0 }}>
        {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
          <div className="json-line" key={key}>
            <span className="json-key">{key}</span>
            <JsonValue value={nestedValue} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  return <span className="json-value">{String(value)}</span>
}

function App() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'rag-buckets' | 'logs'>('sessions')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [buckets, setBuckets] = useState<BucketSummary[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintSummary[]>([])
  const [instances, setInstances] = useState<Record<string, unknown>[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [selectedBlueprint, setSelectedBlueprint] = useState<string | null>(null)
  const [loadingBuckets, setLoadingBuckets] = useState(false)
  const [loadingBlueprints, setLoadingBlueprints] = useState(false)
  const [loadingInstances, setLoadingInstances] = useState(false)
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting',
  )
  const [error, setError] = useState<string | null>(null)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.session_id === selectedId) ?? null,
    [selectedId, sessions],
  )

  const activeBlueprint = useMemo(
    () => blueprints.find((blueprint) => blueprint.id === selectedBlueprint) ?? null,
    [blueprints, selectedBlueprint],
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

  const refreshBuckets = useCallback(async (preferredBucket: string | null = selectedBucket) => {
    setLoadingBuckets(true)
    setError(null)

    try {
      const nextBuckets = await getBuckets()
      const nextBucket = nextBuckets.some((bucket) => bucket.name === preferredBucket)
        ? preferredBucket
        : null

      setBuckets(nextBuckets)
      setSelectedBucket(nextBucket)

      if (!nextBucket) {
        setBlueprints([])
        setInstances([])
        setSelectedBlueprint(null)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoadingBuckets(false)
    }
  }, [selectedBucket])

  const refreshBlueprints = useCallback(
    async (bucketName: string, preferredBlueprint: string | null = selectedBlueprint) => {
      setLoadingBlueprints(true)
      setError(null)

      try {
        const nextBlueprints = await getBucketBlueprints(bucketName)
        const nextBlueprint = nextBlueprints.some(
          (blueprint) => blueprint.id === preferredBlueprint,
        )
          ? preferredBlueprint
          : null

        setBlueprints(nextBlueprints)
        setSelectedBlueprint(nextBlueprint)

        if (!nextBlueprint) {
          setInstances([])
        }
      } catch (requestError) {
        setError(getErrorMessage(requestError))
      } finally {
        setLoadingBlueprints(false)
      }
    },
    [selectedBlueprint],
  )

  const refreshInstances = useCallback(async (blueprintId: string) => {
    setLoadingInstances(true)
    setError(null)

    try {
      setInstances(await getBlueprintInstances(blueprintId))
    } catch (requestError) {
      setInstances([])
      setError(getErrorMessage(requestError))
    } finally {
      setLoadingInstances(false)
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
    if (activeTab === 'rag-buckets' && buckets.length === 0 && !loadingBuckets) {
      refreshBuckets(null)
    }
  }, [activeTab, buckets.length, loadingBuckets, refreshBuckets])

  useEffect(() => {
    if (activeTab === 'rag-buckets' && selectedBucket) {
      refreshBlueprints(selectedBucket)
    }
  }, [activeTab, refreshBlueprints, selectedBucket])

  useEffect(() => {
    if (activeTab === 'rag-buckets' && selectedBlueprint) {
      refreshInstances(selectedBlueprint)
    }
  }, [activeTab, refreshInstances, selectedBlueprint])

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
          <p className="eyebrow">monitor api: {API_BASE_URL} · realtime {realtimeState}</p>
          <h1>Dynamic Agent Monitor</h1>
        </div>
        <nav className="top-tabs" aria-label="Monitor sections">
          <button
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
            type="button"
          >
            sessions
          </button>
          <button
            className={activeTab === 'rag-buckets' ? 'active' : ''}
            onClick={() => setActiveTab('rag-buckets')}
            type="button"
          >
            rag buckets
          </button>
          <button
            className={activeTab === 'logs' ? 'active' : ''}
            onClick={() => setActiveTab('logs')}
            type="button"
          >
            logs
          </button>
        </nav>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {activeTab === 'sessions' && <section className="monitor-grid">
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
      </section>}

      {activeTab === 'rag-buckets' && (
        <section className="rag-browser">
          <aside className="rag-column" aria-label="RAG buckets">
            <div className="rail-header">
              {selectedBucket ? (
                <button
                  className="back-button"
                  onClick={() => {
                    setSelectedBucket(null)
                    setSelectedBlueprint(null)
                    setBlueprints([])
                    setInstances([])
                  }}
                  type="button"
                >
                  Back
                </button>
              ) : (
                <h2>Buckets</h2>
              )}
              <span>{selectedBucket ? blueprints.length : buckets.length}</span>
            </div>

            {selectedBucket && (
              <div className="rail-context">
                <p>bucket</p>
                <h2>{selectedBucket}</h2>
                <p>Blueprints</p>
              </div>
            )}

            {!selectedBucket && loadingBuckets && <p className="empty-state">Loading buckets...</p>}
            {!selectedBucket && !loadingBuckets && buckets.length === 0 && (
              <p className="empty-state">No buckets found.</p>
            )}

            {selectedBucket && loadingBlueprints && (
              <p className="empty-state">Loading blueprints...</p>
            )}
            {selectedBucket && !loadingBlueprints && blueprints.length === 0 && (
              <p className="empty-state">No blueprints found.</p>
            )}

            <div className="rag-list">
              {!selectedBucket &&
                buckets.map((bucket) => (
                  <button
                    className="rag-row"
                    key={bucket.name}
                    onClick={() => {
                      setSelectedBucket(bucket.name)
                      setSelectedBlueprint(null)
                      setInstances([])
                    }}
                    type="button"
                  >
                    <strong>{bucket.name}</strong>
                    <small>{bucket.description || 'No description'}</small>
                  </button>
                ))}

              {selectedBucket &&
                blueprints.map((blueprint) => (
                  <button
                    className={`rag-row ${selectedBlueprint === blueprint.id ? 'active' : ''}`}
                    key={blueprint.id}
                    onClick={() => setSelectedBlueprint(blueprint.id)}
                    type="button"
                  >
                    <strong>{blueprint.name}</strong>
                    <small>{blueprint.description || blueprint.id}</small>
                  </button>
                ))}
            </div>
          </aside>

          <section className="rag-main-page">
            {!activeBlueprint && (
              <div className="blank-panel">
                <h2>No blueprint selected</h2>
                <p>Select a bucket, then click a blueprint to inspect its structure and instances.</p>
              </div>
            )}

            {activeBlueprint && (
              <>
                <div className="pane-header">
                  <p className="eyebrow">bucket: {selectedBucket}</p>
                  <h2>{activeBlueprint.name}</h2>
                  <p>{activeBlueprint.description || activeBlueprint.id}</p>
                </div>

                <section className="attribute-panel">
                  <h3>Blueprint Structure</h3>
                  <div className="attribute-list">
                    {Object.entries(activeBlueprint.attributes).map(([name, attribute]) => (
                      <div className="attribute-row" key={name}>
                        <strong>{name}</strong>
                        <span>{attribute.is_identifier ? 'identifier' : 'attribute'}</span>
                        <p>{attribute.description || 'No description'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="instance-panel">
                  <h3>Instances</h3>
                  {loadingInstances && <p className="empty-state">Loading instances...</p>}
                  {!loadingInstances && instances.length === 0 && (
                    <p className="empty-state">No instances found.</p>
                  )}
                  <div className="instance-list">
                    {instances.map((instance, index) => (
                      <article className="instance-card" key={String(instance.instance_id ?? index)}>
                        <JsonValue value={instance} />
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}
          </section>
        </section>
      )}

      {activeTab === 'logs' && (
        <section className="placeholder-panel">
          <h2>Logs</h2>
        </section>
      )}
    </main>
  )
}

export default App
