import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AIClient,
  buildApiUrl,
  buildChatCompletionBody,
  buildEmbeddingBody,
  buildImageBody,
  getCapabilityEndpoint,
  normalizeReasoningEffort,
  toNumber,
  toOptionalNumber,
} from '../aiClient'

afterEach(() => {
  vi.restoreAllMocks()
})

describe(`aiClient helpers`, () => {
  it(`serializes max_tokens as a number`, () => {
    const body = buildChatCompletionBody({
      model: `gpt-4o-mini`,
      messages: [{ role: `user`, content: `hello` }],
      parameters: {
        temperature: `0.7`,
        topP: `1`,
        maxTokens: `2048`,
        presencePenalty: `0`,
        frequencyPenalty: `0`,
      },
    })

    expect(body.max_tokens).toBe(2048)
    expect(typeof body.max_tokens).toBe(`number`)
  })

  it(`keeps chat parameters numeric when building the request body`, () => {
    const body = buildChatCompletionBody({
      model: `gpt-4o-mini`,
      messages: [{ role: `user`, content: `hello` }],
      parameters: {
        temperature: `0.7`,
        topP: `1`,
        maxTokens: `2048`,
        presencePenalty: `-0.5`,
        frequencyPenalty: `0.5`,
      },
    })

    expect(body.temperature).toBe(0.7)
    expect(body.top_p).toBe(1)
    expect(body.presence_penalty).toBe(-0.5)
    expect(body.frequency_penalty).toBe(0.5)
  })

  it(`builds endpoint URLs without double slashes`, () => {
    expect(buildApiUrl(`https://example.com/`, `/v1/models`)).toBe(`https://example.com/v1/models`)
  })

  it(`builds capability endpoints for worker proxy paths`, () => {
    expect(getCapabilityEndpoint(`https://editor.example.com/api`, `/v1/models`)).toBe(`https://editor.example.com/api/v1/models`)
  })

  it(`omits undefined optional fields from chat payloads`, () => {
    const body = buildChatCompletionBody({
      model: `gpt-4o-mini`,
      messages: [{ role: `user`, content: `hello` }],
      parameters: { maxTokens: 256 },
    })

    expect(body).not.toHaveProperty(`reasoning_effort`)
    expect(body).toHaveProperty(`max_tokens`, 256)
  })

  it(`does not send reasoning_effort by default`, () => {
    const body = buildChatCompletionBody({
      model: `gpt-4o-mini`,
      messages: [{ role: `user`, content: `hello` }],
      parameters: { maxTokens: 256, reasoningEffort: `` },
    })

    expect(body).not.toHaveProperty(`reasoning_effort`)
  })

  it(`builds an embeddings payload with the selected embedding model`, () => {
    const body = buildEmbeddingBody({
      model: `text-embedding-3-small`,
      input: `hello`,
    })

    expect(body).toEqual({
      model: `text-embedding-3-small`,
      input: `hello`,
    })
  })

  it(`serializes new-api compatible image generation fields`, () => {
    const body = buildImageBody({
      model: `gpt-image-1`,
      prompt: `A clean article cover`,
      n: `1`,
      size: `1024x1024`,
      quality: `auto`,
      responseFormat: `b64_json`,
      background: `transparent`,
      outputFormat: `png`,
      outputCompression: `85`,
      moderation: `auto`,
    })

    expect(body).toEqual({
      model: `gpt-image-1`,
      prompt: `A clean article cover`,
      n: 1,
      size: `1024x1024`,
      quality: `auto`,
      response_format: `b64_json`,
      background: `transparent`,
      output_format: `png`,
      output_compression: 85,
      moderation: `auto`,
    })
  })

  it(`uses the selected protocol when creating images`, async () => {
    const fetchMock = vi.spyOn(globalThis, `fetch`).mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': `application/json` },
    }))
    const client = new AIClient(`https://api.example.com`, `sk-test`, `gemini-native`)

    await client.createImage({
      model: `imagen-4.0-generate-001`,
      prompt: `A clean article cover`,
      n: 1,
      size: `1024x1024`,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/v1beta/models/imagen-4.0-generate-001:predict`,
      expect.objectContaining({
        method: `POST`,
        body: JSON.stringify({
          instances: [{ prompt: `A clean article cover` }],
          parameters: {
            sampleCount: 1,
            aspectRatio: `1:1`,
            personGeneration: `allow_adult`,
          },
        }),
      }),
    )
  })

  it(`uses the OpenAI-compatible image generation endpoint and payload`, async () => {
    const fetchMock = vi.spyOn(globalThis, `fetch`).mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': `application/json` },
    }))
    const client = new AIClient(`https://api.example.com`, `sk-test`)

    await client.createImage({
      model: `gpt-image-1`,
      prompt: `A clean article cover`,
      n: `1`,
      size: `1024x1024`,
      responseFormat: `b64_json`,
      outputFormat: `png`,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/v1/images/generations`,
      expect.objectContaining({
        method: `POST`,
        body: JSON.stringify({
          model: `gpt-image-1`,
          prompt: `A clean article cover`,
          n: 1,
          size: `1024x1024`,
          response_format: `b64_json`,
          output_format: `png`,
        }),
      }),
    )
  })

  it(`uses the OpenAI-compatible image edit endpoint`, async () => {
    const fetchMock = vi.spyOn(globalThis, `fetch`).mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': `application/json` },
    }))
    const client = new AIClient(`https://api.example.com`, `sk-test`)

    await client.createImageEdit({
      model: `gpt-image-1`,
      prompt: `Make it brighter`,
      image: `data:image/png;base64,AAAA`,
      mimeType: `image/png`,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/v1/images/edits`,
      expect.objectContaining({
        method: `POST`,
        body: expect.any(FormData),
      }),
    )
  })

  it(`normalizes numeric helpers safely`, () => {
    expect(toNumber(`12`, 1)).toBe(12)
    expect(toNumber(`bad`, 5)).toBe(5)
    expect(toOptionalNumber(`42`)).toBe(42)
    expect(toOptionalNumber(``)).toBeUndefined()
    expect(normalizeReasoningEffort(`high`)).toBe(`high`)
    expect(normalizeReasoningEffort(`x`)).toBeUndefined()
  })
})
