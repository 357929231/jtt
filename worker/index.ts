interface Env {
  ASSETS: Fetcher
  NEWAPI_BASE_URL?: string
  NEWAPI_API_KEY?: string
}

const API_PREFIX = `/api/`

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({
    error: {
      message,
      type: `proxy_error`,
      code: `proxy_error`,
      param: ``,
    },
  }), {
    status,
    headers: {
      'Content-Type': `application/json`,
    },
  })
}

function buildTargetUrl(request: Request, baseUrl: string) {
  const sourceUrl = new URL(request.url)
  const targetPath = sourceUrl.pathname.replace(/^\/api/, ``)
  const targetUrl = new URL(targetPath + sourceUrl.search, baseUrl.endsWith(`/`) ? baseUrl : `${baseUrl}/`)
  return targetUrl.toString()
}

async function proxyApiRequest(request: Request, env: Env) {
  if (!env.NEWAPI_BASE_URL || !env.NEWAPI_API_KEY) {
    return jsonError(`Worker Proxy 未配置 NEWAPI_BASE_URL 或 NEWAPI_API_KEY`, 500)
  }

  const headers = new Headers(request.headers)
  headers.set(`Authorization`, `Bearer ${env.NEWAPI_API_KEY}`)
  headers.delete(`host`)

  const upstreamResponse = await fetch(buildTargetUrl(request, env.NEWAPI_BASE_URL), {
    method: request.method,
    headers,
    body: request.method === `GET` || request.method === `HEAD` ? undefined : request.body,
  })

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers,
  })
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith(API_PREFIX)) {
      return proxyApiRequest(request, env)
    }

    return env.ASSETS.fetch(request)
  },
}
