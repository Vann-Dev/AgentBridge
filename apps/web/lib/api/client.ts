export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const data = (await response.json().catch(() => null)) as T & { error?: string }

  if (!response.ok) {
    throw new Error(data?.error ?? "Request failed")
  }

  return data
}
