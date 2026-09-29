import { useState, type FormEvent } from 'react'

export type AuthUser = {
  id: number; first_name: string; last_name: string; name: string; email: string
}

type Props = {
  creating: boolean
  onSuccess: (user: AuthUser) => void
}

export default function AuthPage({ creating, onSuccess }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (creating && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const body = creating
        ? { first_name: firstName, last_name: lastName, email, password, confirm_password: confirmPassword }
        : { email, password }
      const response = await fetch(`/api/auth/${creating ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data.detail === 'string' ? data.detail : 'Please check your information and try again.')
        return
      }
      onSuccess(data.user as AuthUser)
    } catch {
      setError('We could not reach the shop. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="wrap section account-page"><div className="account-card">
    <span className="eyebrow">Your account</span><h1>{creating ? 'Create account' : 'Log in'}</h1>
    <p>{creating ? 'Join the Campus Customs community.' : 'Welcome back. Sign in to your account.'}</p>
    <form onSubmit={submit}>
      {creating && <div className="name-fields">
        <label>First name<input type="text" autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} required maxLength={80} /></label>
        <label>Last name<input type="text" autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} required maxLength={80} /></label>
      </div>}
      <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
      <label>Password<input type="password" autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={creating ? 8 : 1} maxLength={128} /></label>
      {creating && <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Please wait…' : creating ? 'Create account' : 'Log in'}</button>
    </form>
    <p className="account-switch">{creating ? 'Already have an account?' : 'New to Campus Customs?'} <a href={creating ? '/login' : '/create-account'}>{creating ? 'Log in' : 'Create account'}</a></p>
  </div></main>
}
