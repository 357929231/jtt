import { describe, expect, it } from 'vitest'
import {
  buildProtocolRequest,
  getProtocolDefinition,
  getProtocolEndpoint,
  resolveCapabilityEndpoint,
} from '../aiProtocolRegistry'

describe(`protocol registry`, () => {
  it(`supports responses, claude, and gemini protocols`, () => {
    expect(getProtocolDefinition(`openai-responses`).id).toBe(`openai-responses`)
    expect(getProtocolDefinition(`anthropic-native`).id).toBe(`anthropic-native`)
    expect(getProtocolDefinition(`gemini-native`).id).toBe(`gemini-native`)
  })

  it(`uses the responses endpoint for openai-responses chat`, () => {
    expect(getProtocolEndpoint(`openai-responses`, `chat`)).toBe(`/v1/responses`)
  })

  it(`uses OpenAI-compatible image generation and edit endpoints`, () => {
    expect(getProtocolEndpoint(`openai-chat-completions`, `imageGeneration`)).toBe(`/v1/images/generations`)
    expect(getProtocolEndpoint(`openai-chat-completions`, `imageEdit`)).toBe(`/v1/images/edits`)
  })

  it(`builds a Claude native chat payload`, () => {
    const body = buildProtocolRequest(`anthropic-native`, `chat`, {
      model: `claude-3-5-sonnet`,
      messages: [{ role: `user`, content: `hello` }],
      parameters: {
        maxTokens: 2048,
      },
    }) as Record<string, unknown>

    expect(body.model).toBe(`claude-3-5-sonnet`)
    expect(body.messages).toEqual([{ role: `user`, content: `hello` }])
    expect(body.max_tokens).toBe(2048)
  })

  it(`builds a Gemini native text chat payload`, () => {
    const body = buildProtocolRequest(`gemini-native`, `chat`, {
      model: `gemini-1.5-pro`,
      messages: [{ role: `user`, content: `hello` }],
      parameters: {
        temperature: 0.7,
      },
    }) as Record<string, unknown>

    expect(body.contents).toBeTruthy()
    expect(body.generationConfig).toBeTruthy()
  })

  it(`builds a Gemini media recognition request`, () => {
    const body = buildProtocolRequest(`gemini-native`, `mediaRecognition`, {
      model: `gemini-1.5-pro`,
      inputText: `Describe this image`,
      media: [{ mimeType: `image/png`, data: `base64data` }],
    }) as Record<string, unknown>

    expect(body.contents).toBeTruthy()
  })

  it(`builds a Gemini Imagen generation request`, () => {
    expect(getProtocolDefinition(`gemini-native`).supportedCapabilities).toContain(`imageGeneration`)
    expect(getProtocolEndpoint(`gemini-native`, `imageGeneration`)).toBe(`/v1beta/models/{model}:predict`)

    const body = buildProtocolRequest(`gemini-native`, `imageGeneration`, {
      model: `imagen-4.0-generate-001`,
      prompt: `A clean article cover`,
      n: 2,
      size: `1792x1024`,
      quality: `hd`,
    }) as Record<string, any>

    expect(body).toEqual({
      instances: [{ prompt: `A clean article cover` }],
      parameters: {
        sampleCount: 2,
        aspectRatio: `16:9`,
        personGeneration: `allow_adult`,
        imageSize: `2K`,
      },
    })
  })

  it(`uses explicit capability endpoint override when provided`, () => {
    expect(resolveCapabilityEndpoint(`/custom/images`, `/v1/images/generations`)).toBe(`/custom/images`)
  })
})
