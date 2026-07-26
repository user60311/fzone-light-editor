export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  })
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status })
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}
