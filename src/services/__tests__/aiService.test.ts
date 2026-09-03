import { useAIStore } from '@/stores/ai'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateWithAI } from '../ai'

describe(`ai service`, () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`extracts continuation text when an OpenAI-compatible endpoint returns JSON`, async () => {
    vi.spyOn(globalThis, `fetch`).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: `续写内容` } }],
    }), {
      status: 200,
      headers: { 'Content-Type': `application/json` },
    }))
    const store = useAIStore()
    store.connection.apiKey = `sk-test`
    store.connection.baseUrl = `https://api.example.com`
    store.connection.protocol = `openai-chat-completions`

    await expect(generateWithAI(`请继续编写以下内容：测试`)).resolves.toBe(`续写内容`)
  })

  it(`falls back to non-streaming when an OpenAI-compatible stream request has no available channel`, async () => {
    const fetchMock = vi.spyOn(globalThis, `fetch`)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: `model_not_found`,
          message: `No available channel for model ChatGPT/auto under group test`,
        },
      }), {
        status: 503,
        headers: { 'Content-Type': `application/json` },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: `降级后的续写内容` } }],
      }), {
        status: 200,
        headers: { 'Content-Type': `application/json` },
      }))
    const store = useAIStore()
    store.connection.apiKey = `sk-test`
    store.connection.baseUrl = `https://api.example.com`
    store.connection.protocol = `openai-chat-completions`
    store.defaults.chatModel = `ChatGPT/auto`

    await expect(generateWithAI(`请继续编写以下内容：测试`)).resolves.toBe(`降级后的续写内容`)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).stream).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string).stream).toBe(false)
  })
})
