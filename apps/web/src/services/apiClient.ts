const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401) {
    // Session hết hạn — redirect về login (full page navigation để clear React state)
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `Request failed: ${response.status}`)
  }

  return response.json()
}
