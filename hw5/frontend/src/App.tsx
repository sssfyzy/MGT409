import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { api, control } from './api'
import { useDesk } from './useDesk'
import type { AgentReport, AuditEvent, Contribution, Proposal, Role } from './types'

const roles: Record<Role, { name: string; initials: string; color: string; purpose: string }> = {
  boss: { name: 'Boss', initials: 'B', color: '#6952bd', purpose: 'Direction & decisions' },
  inventory: { name: 'Inventory', initials: 'I', color: '#347aad', purpose: 'Stock & sourcing' },
  accounting: { name: 'Accounting', initials: 'A', color: '#32866c', purpose: 'Cash & margins' },
  facilities: { name: 'Facilities', initials: 'F', color: '#a27a29', purpose: 'Space & obligations' },
  customer_service: { name: 'Customer Service', initials: 'CS', color: '#ad668d', purpose: 'Clear customer drafts' },
}
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
const human = (role: string) => roles[role as Role]?.name || role
const running = (status?: string) => status === 'queued' || status === 'running'
const toolLabels: Record<string, string> = {
  list_tickets: 'Read the ticket queue', get_shop_state: 'Checked cash and payment records',
  get_vendor_context: 'Checked the vendor and unpaid invoices', get_order_fulfillment_context: 'Checked stock and the linked invoice',
  get_rent_context: 'Checked the lease and rent', get_bulk_discount_context: 'Checked stock, price and margin',
  prepare_payment: 'Prepared a payment for your decision', record_ticket_outcome: 'Recorded the ticket outcome',
}

function Icon({ name }: { name: 'desk' | 'team' | 'play' | 'check' | 'refresh' | 'lock' | 'arrow' | 'close' | 'cash' }) {
  const paths = {
    desk: 'M4 5h16v14H4z M4 10h16 M9 10v9', team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M18 8a4 4 0 0 1 0 8 M19 21v-2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    play: 'm8 5 11 7-11 7z', check: 'm5 12 4 4 10-10', refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 14 6 M18 18a8 8 0 0 1-14-6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3', arrow: 'M5 12h14 m-5-5 5 5-5 5', close: 'm6 6 12 12 M18 6 6 18', cash: 'M3 5h18v14H3z M8 12h.01 M16 12h.01 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

function Avatar({ role }: { role: string }) {
  const info = roles[role as Role]
  return <span className="avatar" style={{ '--actor': info?.color || '#777' } as CSSProperties}>{info?.initials || 'H'}</span>
}

function Modal({ title, children, close, busy = false }: { title: string; children: ReactNode; close: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close() }, [])
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={close}><Icon name="close" /></button></div>
    {children}
  </dialog>
}

function evidenceText(tool: string, out: any): string {
  if (tool === 'prepare_payment' && out?.action) return `${money(out.action.amount)} proposed. ${out.ready_for_approval ? 'Waiting for a human decision.' : out.blockers.join(' ')}`
  if (out?.stock) return `${out.stock.qty ?? 'Unknown'} on hand in size ${out.stock.size}. Shortfall: ${out.stock_shortfall ?? 'unknown'}.`
  if (out?.lease) return `Rent ${money(out.lease.monthly_rent)} · due ${out.lease.next_due}.`
  if (out?.cash_accounts) return out.cash_accounts.map((a: any) => `${a.name}: ${money(a.balance)}`).join(' · ')
  if (out?.vendor) return `${out.vendor.name} · ${out.vendor.lead_days}-day recorded lead time. ${out.shipment_blocked ? 'Shipment blocked by unpaid invoice.' : ''}`
  return 'The finding is recorded below.'
}

function activity(event: AuditEvent): { title: string; detail?: string; evidence?: any; warning?: boolean } | null {
  const d = event.data
  if (event.event === 'agent_start') return { title: `${human(event.agent)} started investigating` }
  if (event.event === 'delegation_start') return { title: `${human(event.agent)} → ${human(d.to)}`, detail: d.task }
  if (event.event === 'delegation_return') return { title: `${human(d.from)} returned findings to ${human(event.agent)}` }
  if (event.event === 'mcp_tool_result') return { title: toolLabels[d.tool] || 'Verified a shop record', detail: evidenceText(d.tool, d.output), evidence: d.output }
  if (event.event === 'agent_result') return { title: `${human(event.agent)} shared a conclusion`, detail: d.report?.summary }
  if (event.event === 'delegation_blocked') return { title: 'A repeated handoff was stopped', detail: d.reason, warning: true }
  if (event.event === 'agent_error' || event.event === 'mcp_tool_error') return { title: `${human(event.agent)} could not complete this step`, detail: d.error, warning: true }
  if (event.event === 'payment_executed') return { title: 'Human-approved payment recorded', detail: money(d.action.amount), evidence: d }
  if (event.event === 'payment_refused') return { title: 'Payment was refused', detail: d.error, warning: true }
  return null
}

function Report({ report }: { report: AgentReport }) {
  return <div className="report-content"><p>{report.summary}</p>
    {report.recommendation && <div className="recommendation"><strong>Recommended next step</strong><p>{report.recommendation}</p></div>}
    {!!report.facts?.length && <details><summary>Supporting facts</summary><ul>{report.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul></details>}
    {!!report.calculations?.length && <details><summary>Calculations</summary><ul>{report.calculations.map((fact, i) => <li key={i}>{fact}</li>)}</ul></details>}
    {!!report.uncertainties?.length && <details><summary>What remains uncertain</summary><ul>{report.uncertainties.map((fact, i) => <li key={i}>{fact}</li>)}</ul></details>}
    {report.draft_message && <details open><summary>Communication draft · not sent</summary><blockquote>{report.draft_message}</blockquote></details>}
  </div>
}

type ModalState = { type: 'connect' } | { type: 'approval'; proposal: Proposal } | { type: 'reset' } | null

export default function App() {
  const [selectedId, setSelectedId] = useState(() => Number(sessionStorage.getItem('campus-selected-ticket')) || 101)
  const desk = useDesk(selectedId)
  const [readOnly, setReadOnly] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [operator, setOperator] = useState('Student operator')
  const [code, setCode] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [assumptions, setAssumptions] = useState(false)
  const [action, setAction] = useState('')
  const [launchId, setLaunchId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [view, setView] = useState<'activity' | 'summary'>('activity')
  const ticket = desk.tickets.find(t => t.id === selectedId)
  const job = desk.jobs[selectedId]
  const busy = desk.busy || !!launchId || !!action
  const selectedProposals = desk.proposals.filter(p => p.action.ticket_id === selectedId)
  const contributions: Contribution[] = job?.result?.contributions || desk.events.filter(e => e.event === 'agent_result').map(e => ({ agent: e.agent as Role, report: e.data.report }))
  const latestContributions = Object.values(Object.fromEntries(contributions.map(c => [c.agent, c])))
  const items = desk.events.map(event => ({ event, entry: activity(event) })).filter(item => item.entry !== null)
  useEffect(() => { sessionStorage.setItem('campus-selected-ticket', String(selectedId)) }, [selectedId])
  useEffect(() => { if (launchId && Object.values(desk.jobs).some(j => j.run_id === launchId)) setLaunchId(null) }, [desk.jobs, launchId])
  useEffect(() => { if (desk.error) setLaunchId(null) }, [desk.error])
  useEffect(() => { setConfirmed(false); setAssumptions(false); setActionError(''); setCode('') }, [modal])

  async function perform(name: string, fn: () => Promise<void>) {
    setAction(name); setActionError(''); setNotice('')
    try { await fn() } catch (e) { setActionError(e instanceof Error ? e.message : 'The action could not be completed') }
    finally { setAction(''); desk.refresh() }
  }
  function roleStatus(role: Role) {
    if (latestContributions.some(c => c.agent === role)) return 'Done'
    const started = desk.events.some(e => e.agent === role && e.event === 'agent_start')
    return running(job?.status) && started ? 'Working' : 'Ready'
  }
  const runLabel = ticket?.status === 'resolved' ? 'Resolved' : running(job?.status) || launchId ? 'Team is working' : readOnly ? 'Run review' : 'Run resolution'
  const shopDate = desk.cash?.shop_date ? new Date(desk.cash.shop_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Connecting…'

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">CC</span><div>Campus Customs<small>Operations desk</small></div></div>
      <div className="side-section">YOUR WORKSPACE</div>
      <button className="side-link active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Icon name="desk" />Operations desk</button>
      <button className="side-link" onClick={() => document.getElementById('team-panel')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="team" />Your agent team</button>
      <div className="desk-note"><span className="tiny-label">A HUMAN AT THE HELM</span><p>Your team investigates.<br />You decide when money moves.</p></div>
      <button className="side-link reset-link" disabled={!desk.session.authenticated || busy} onClick={() => setModal({ type: 'reset' })}><Icon name="refresh" />Reset scenario</button>
      <div className="side-footer"><span className={'connection-dot ' + (desk.error ? 'offline' : '')} />{desk.error ? 'Connection needs attention' : 'Local shop workspace'}</div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div><span className="tiny-label">THE OPERATIONS DESK</span><h1>A clear view. A capable team.</h1><p>Keep the shop moving, one thoughtful decision at a time.</p></div>
        <div className="operator-area"><span className="shop-date">Shop date · {shopDate}</span>
          {desk.session.authenticated ? <button className="operator-button" aria-label="Disconnect operator" onClick={() => void perform('logout', async () => { await api('/session', { method: 'DELETE', headers: { 'X-CSRF-Token': desk.session.csrf_token || '' } }) })}><span className="operator-dot" />{desk.session.operator}<small>Connected</small></button> : <button className="secondary" onClick={() => setModal({ type: 'connect' })}><Icon name="lock" />Connect operator</button>}
        </div>
      </header>
      {(desk.error || actionError) && <div className="alert" role="alert"><strong>Something needs attention</strong><span>{actionError || desk.error}</span><button onClick={() => { setActionError(''); desk.refresh() }}>Retry / refresh</button></div>}
      {notice && <div className="success-note" role="status"><Icon name="check" />{notice}<button className="icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><Icon name="close" /></button></div>}
      <section className="stats-row" aria-label="Shop overview">
        <div className="stat-card"><span>Checking balance</span><strong data-testid="cash-balance">{desk.cash ? money(desk.cash.account.balance) : '—'}</strong><small>{desk.error ? 'Last recorded cash · reconnecting' : 'Recorded cash · refreshed from the shop'}</small><Icon name="cash" /></div>
        <div className="stat-card"><span>Open tickets</span><strong>{desk.loading ? '—' : desk.tickets.filter(t => t.status === 'open').length}<small className="stat-total"> / {desk.tickets.length}</small></strong><small>{desk.tickets.filter(t => t.status === 'resolved').length} resolved · each outcome verified</small></div>
        <div className="stat-card"><span>Waiting for your decision</span><strong>{desk.session.authenticated ? desk.proposals.length : '—'}</strong><small>{desk.session.authenticated ? 'Payment and purchase proposals' : 'Connect to view private approval requests'}</small></div>
      </section>
      <div className="desk-grid">
        <section className="panel ticket-queue"><div className="panel-heading"><h2>Ticket inbox</h2><span className="count-badge">{desk.tickets.length}</span></div><p className="panel-caption">Choose the next thing to move forward.</p>
          <div className="ticket-buttons">{desk.tickets.map(t => <button key={t.id} className={'ticket-button ' + (selectedId === t.id ? 'selected' : '')} aria-pressed={selectedId === t.id} aria-label={`Select ticket ${t.id}: ${t.subject}`} onClick={() => { setSelectedId(t.id); setView('activity') }}>
            <div className="ticket-top"><span>#{t.id}</span><span className={'badge ' + (t.status === 'resolved' ? 'resolved' : 'open')}>{t.status === 'resolved' ? 'Resolved' : running(desk.jobs[t.id]?.status) ? 'Working' : 'Open'}</span></div>
            <strong>{t.subject}</strong><span className="ticket-requester">{t.requester}</span><div className="ticket-bottom"><span>{t.type === 'rent_notice' ? 'Facilities' : t.type === 'price_override' ? 'Pricing request' : 'Customer order'}</span><Icon name="arrow" /></div>
          </button>)}</div>
          <div className="queue-foot"><Icon name="check" /><p>A finished review stays open until a supported resolution is recorded.</p></div>
        </section>
        <section className="work-column">
          <section className="panel ticket-detail"><div className="ticket-detail-top"><div><span className="tiny-label">TICKET {selectedId}</span><h2>{ticket?.subject || 'Loading your desk…'}</h2></div><span className={'badge ' + (ticket?.status === 'resolved' ? 'resolved' : 'open')}>{ticket?.status || 'Loading'}</span></div>
            <p className="requester">Requested by {ticket?.requester || '—'}</p><p className="ticket-brief">{ticket?.notes || 'Select a ticket to begin.'}</p>
            <div className="ticket-chips">{ticket?.sku && <span>{ticket.sku}</span>}{ticket?.size && <span>Size {ticket.size}</span>}{ticket?.qty != null && <span>{ticket.qty} requested</span>}{ticket?.lease_id && <span>Lease {ticket.lease_id}</span>}</div>
            <div className="run-controls"><label className="review-toggle"><input type="checkbox" checked={readOnly} disabled={busy} onChange={e => setReadOnly(e.target.checked)} /><span>Review only<small>{readOnly ? 'Investigate without resolving this ticket' : 'Resolution enabled · payments still need your approval'}</small></span></label>
              <button className="primary" disabled={busy || !desk.session.authenticated || !ticket || ticket.status === 'resolved'} onClick={() => void perform('run', async () => { const r = await control<{ run_id: string }>(`/tickets/${selectedId}/run`, { read_only: readOnly }, desk.session.csrf_token); setLaunchId(r.run_id); desk.rememberRun(selectedId, r.run_id); setView('activity') })}><Icon name={ticket?.status === 'resolved' ? 'check' : 'play'} />{runLabel}</button>
            </div>{!desk.session.authenticated && <p className="connect-hint">Connect as an operator to start the team. Browsing the desk is available now.</p>}
          </section>
          <section className="panel team-panel" id="team-panel"><div className="panel-heading"><h2>Your agent team</h2><span className="tiny-muted">Five roles · one shared task</span></div><div className="team-seats">{Object.entries(roles).map(([key, info]) => <div className={'team-seat ' + roleStatus(key as Role).toLowerCase()} key={key} style={{ '--actor': info.color } as CSSProperties}><Avatar role={key} /><strong>{info.name}</strong><span>{roleStatus(key as Role)}</span></div>)}</div></section>
          <section className="panel activity-panel"><div className="activity-tabs"><button className={view === 'activity' ? 'selected' : ''} onClick={() => setView('activity')}>Team activity</button><button className={view === 'summary' ? 'selected' : ''} onClick={() => setView('summary')}>Agent summaries <span>{latestContributions.length}</span></button>
              {job && <span className={'run-state ' + (running(job.status) ? 'live' : '')}>{running(job.status) ? '● Live' : job.status === 'completed' ? job.read_only ? 'Review ready' : 'Run finished' : job.status}</span>}</div>
            {view === 'activity' ? <div className="activity-feed" aria-live="polite" aria-relevant="additions">{items.length ? items.map(({ event, entry }) => <article className={'activity-item ' + (entry!.warning ? 'warning' : '')} key={event.sequence}><Avatar role={event.agent} /><div><div className="activity-title"><strong>{entry!.title}</strong><time>{new Date(event.timestamp_utc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</time></div>{entry!.detail && <p>{entry!.detail}</p>}{entry!.evidence && <details><summary>View verified evidence</summary><pre>{JSON.stringify(entry!.evidence, null, 2)}</pre></details>}</div></article>) : <div className="empty-state"><span className="empty-icon"><Icon name="team" /></span><h3>A team ready to help.</h3><p>Run a review to see the actual handoffs, verified findings and recommendations here.</p></div>}</div> : <div className="contribution-list">{latestContributions.length ? latestContributions.map(c => <article className="contribution" key={c.agent}><div className="contribution-head"><Avatar role={c.agent} /><div><h3>{human(c.agent)}</h3><small>{roles[c.agent]?.purpose}</small></div><span className="badge resolved">Reported</span></div><Report report={c.report} /></article>) : <div className="empty-state"><h3>Findings will land here.</h3><p>Each specialist's actual contribution appears as the run progresses.</p></div>}</div>}
            {(job?.error || job?.result?.error) && <div className="run-error" role="alert">The run stopped: {job.error || job.result?.error}</div>}
          </section>
        </section>
        <aside className="approval-column"><section className="panel approvals"><div className="panel-heading"><h2>Your decisions</h2><Icon name="lock" /></div><p className="panel-caption">The team prepares. You approve.</p>
          {selectedProposals.length ? selectedProposals.map(p => { const stale = desk.cash?.account.balance !== p.action.balance_before; return <article className="proposal-card" key={p.action_id}><span className="tiny-label">{p.action.kind === 'purchase' ? 'ESTIMATED PURCHASE' : p.action.kind.toUpperCase() + ' PAYMENT'}</span><h3>{p.action.details.payee}</h3><strong className="proposal-amount">{money(p.action.amount)}</strong><dl><div><dt>Current cash used</dt><dd>{money(p.action.balance_before)}</dd></div><div><dt>Cash after payment</dt><dd>{money(p.action.balance_after)}</dd></div></dl>
            {(stale || p.blockers.length > 0) && <p className="proposal-warning">{stale ? 'Cash changed. Re-run this ticket to prepare a fresh proposal.' : p.blockers.join(' ')}</p>}
            {!!p.assumptions.length && <details><summary>Purchase assumptions to review</summary><ul>{p.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
            <button className="primary full-width" disabled={busy || stale || !p.ready_for_approval || !desk.session.authenticated} onClick={() => setModal({ type: 'approval', proposal: p })}>Review payment<Icon name="arrow" /></button><small className="no-auto-pay">Nothing moves until you confirm.</small>
          </article> }) : <div className="decision-empty"><span className="empty-icon"><Icon name="check" /></span><h3>{desk.session.authenticated ? 'No payment waiting.' : 'Your approval stays yours.'}</h3><p>{desk.session.authenticated ? 'Proposals for this ticket will appear here when the team prepares them.' : 'Connect to review payment proposals. Agents cannot approve them.'}</p></div>}
        </section><div className="small-note"><strong>Drafts, not deliveries.</strong><p>Customer and vendor messages stay on the desk. A proposed purchase does not mean stock has arrived.</p></div></aside>
      </div>
      <footer className="page-footer">Campus Customs Operations · Built for clear decisions.<button disabled={busy} onClick={desk.refresh}><Icon name="refresh" />Refresh desk</button></footer>
    </main>
    {modal?.type === 'connect' && <Modal title="Connect as an operator" close={() => setModal(null)} busy={!!action}><p className="modal-intro">Use the private local code created when your backend starts. It is kept in <code>data/operator_access.json</code>.</p><form onSubmit={e => { e.preventDefault(); void perform('connect', async () => { await api('/session', { method: 'POST', body: JSON.stringify({ access_key: code, display_name: operator }) }); setCode(''); setModal(null); setNotice('Operator connected. Your decisions remain in your hands.') }) }}><label className="field">Operator name<input value={operator} onChange={e => setOperator(e.target.value)} required maxLength={100} /></label><label className="field">Operator access code<input type="password" value={code} onChange={e => setCode(e.target.value)} required minLength={32} autoComplete="off" /></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="modal-actions"><button type="button" className="secondary" disabled={!!action} onClick={() => setModal(null)}>Cancel</button><button className="primary" disabled={!!action}>{action ? 'Connecting…' : 'Connect operator'}</button></div></form></Modal>}
    {modal?.type === 'approval' && <Modal title="Approve this payment" close={() => setModal(null)} busy={!!action}><p className="modal-intro">Review the exact proposal before recording a payment.</p><div className="confirm-amount"><span>{modal.proposal.action.details.payee}</span><strong>{money(modal.proposal.action.amount)}</strong><small>From {modal.proposal.action.account} · cash afterward {money(modal.proposal.action.balance_after)}</small></div><label className="confirmation"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I approve this exact {money(modal.proposal.action.amount)} payment.</span></label>{!!modal.proposal.assumptions.length && <><ul className="assumption-list">{modal.proposal.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul><label className="confirmation"><input type="checkbox" checked={assumptions} onChange={e => setAssumptions(e.target.checked)} /><span>I have reviewed and confirm these purchase assumptions.</span></label></>}{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="modal-actions"><button className="secondary" disabled={!!action} onClick={() => setModal(null)}>Cancel</button><button className="primary" disabled={!!action || !confirmed || (!!modal.proposal.assumptions.length && !assumptions)} onClick={() => void perform('approve', async () => { const receipt = await control<{ action: Proposal['action'] }>('/payments/approve', { action_id: modal.proposal.action_id, confirm: true, confirmed_assumptions: assumptions }, desk.session.csrf_token); setModal(null); setNotice(`Payment recorded: ${money(receipt.action.amount)} to ${receipt.action.details.payee}.`) })}>{action ? 'Recording…' : `Confirm ${money(modal.proposal.action.amount)} payment`}</button></div></Modal>}
    {modal?.type === 'reset' && <Modal title="Reset the scenario" close={() => setModal(null)} busy={!!action}><p className="modal-intro">Restore the original tickets, stock and cash for a fresh run. Existing audit history stays intact; pending approvals become invalid.</p><label className="confirmation"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>Restore the original scenario data.</span></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="modal-actions"><button className="secondary" disabled={!!action} onClick={() => setModal(null)}>Cancel</button><button className="primary" disabled={!!action || !confirmed} onClick={() => void perform('reset', async () => { await control('/reset', { confirm: true }, desk.session.csrf_token); setReadOnly(true); setModal(null); setNotice('Scenario restored. Audit history is preserved.') })}>{action ? 'Restoring…' : 'Restore scenario'}</button></div></Modal>}
  </div>
}
