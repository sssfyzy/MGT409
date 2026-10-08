export const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...options, credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof body.detail === 'string' ? body.detail :
      Array.isArray(body.detail) ? body.detail.map((item: { msg: string }) => item.msg).join('; ') : 'Request failed'
    throw new ApiError(detail, response.status)
  }
  return body as T
}

export function control<T>(path: string, body: object, csrf: string | undefined) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body), headers: { 'X-CSRF-Token': csrf || '' } })
}
