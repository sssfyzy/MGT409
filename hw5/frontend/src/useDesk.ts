import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api'
import type { AuditEvent, Cash, Job, Proposal, Session, Ticket } from './types'

function savedRuns(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem('campus-run-ids') || '{}') } catch { return {} }
}

export function useDesk(selectedId: number) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [cash, setCash] = useState<Cash | null>(null)
  const [session, setSession] = useState<Session>({ authenticated: false })
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [runIds, setRunIds] = useState<Record<string, string>>(savedRuns)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const generation = useRef<number | null>(null)
  const refresh = useCallback(() => setRefreshTick(n => n + 1), [])
  const rememberRun = useCallback((id: number, runId: string) => {
    setJobs(previous => { const next = { ...previous }; delete next[id]; return next })
    setEvents([])
    setRunIds(previous => ({ ...previous, [id]: runId }))
  }, [])

  useEffect(() => { sessionStorage.setItem('campus-run-ids', JSON.stringify(runIds)) }, [runIds])
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    async function poll() {
      try {
        const options = { signal: controller.signal }
        const [queue, balance, operator] = await Promise.all([
          api<{ tickets: Ticket[]; generation: number }>('/tickets', options),
          api<Cash>('/cash', options), api<Session>('/session', options),
        ])
        if (!alive) return
        setTickets(queue.tickets); setCash(balance); setSession(operator)
        if (generation.current !== null && generation.current !== queue.generation) {
          setRunIds({}); setJobs({}); setEvents([])
        }
        generation.current = queue.generation
        const pending = operator.authenticated ? await api<{ proposals: Proposal[] }>('/payments/pending', options) : { proposals: [] }
        if (!alive) return
        setProposals(pending.proposals)
        const results = await Promise.all(Object.entries(runIds).map(async ([id, runId]) => {
          try {
            const job = await api<Job>('/runs/' + encodeURIComponent(runId), options)
            return job.generation === queue.generation ? [id, job] as const : null
          } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e }
        }))
        if (!alive) return
        const validRunIds = Object.fromEntries(results.filter((r): r is readonly [string, Job] => r !== null).map(([id, job]) => [id, job.run_id]))
        if (Object.keys(validRunIds).length !== Object.keys(runIds).length) setRunIds(validRunIds)
        setJobs(Object.fromEntries(results.filter((r): r is readonly [string, Job] => r !== null)))
        const selectedRun = results.find(r => r && Number(r[0]) === selectedId)?.[1]
        if (selectedRun) {
          const log = await api<{ events: AuditEvent[] }>('/events?run_id=' + encodeURIComponent(selectedRun.run_id) + '&limit=200', options)
          if (alive) setEvents(log.events)
        } else setEvents([])
        setError('')
      } catch (e) {
        if (alive && !(e instanceof DOMException && e.name === 'AbortError'))
          setError(e instanceof Error ? e.message : 'Could not reach the operations desk')
      } finally {
        if (alive) { setLoading(false); timer = setTimeout(poll, 1400) }
      }
    }
    void poll()
    return () => { alive = false; controller.abort(); clearTimeout(timer) }
  }, [selectedId, runIds, refreshTick])

  const busy = Object.values(jobs).some(job => job.status === 'queued' || job.status === 'running')
  return { tickets, cash, session, proposals, jobs, events, error, loading, busy, refresh, rememberRun }
}
