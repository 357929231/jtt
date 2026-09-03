import type { AICapability, AIProtocolId } from './aiProtocolTypes'
import { buildProtocolRequest, getProtocolEndpoint } from './aiProtocolRegistry'

export type ReasoningEffort = `low` | `medium` | `high`

export interface AIParameters {
  temperature?: unknown
  topP?: unknown
  maxTokens?: unknown
  presencePenalty?: unknown
  frequencyPenalty?: unknown
  reasoningEffort?: unknown
}

export interface ChatMessage {
  role: string
  content: string
}

export interface ChatCompletionInput {
  model: string
  messages: ChatMessage[]
  parameters?: AIParameters
  stream?: boolean
}

export interface CompletionInput {
  model: string
  prompt: string
  maxTokens?: unknown
  temperature?: unknown
}

export interface EmbeddingInput {
  model: string
  input: string | string[]
  encodingFormat?: `float` | `base64`
  dimensions?: unknown
}

export interface RerankInput {
  model: string
  query: string
  documents: string[]
  topN?: unknown
}

export interface ModerationInput {
  model: string
  input: string | string[]
}

export interface ImageInput {
  model: string
  prompt: string
  n?: unknown
  size?: string
  quality?: string
  responseFormat?: string
  background?: string
  outputFormat?: string
  outputCompression?: unknown
  moderation?: string
}

export interface ImageEditInput {
  model: string
  prompt: string
  image: string
  mimeType?: string
  n?: unknown
  size?: string
  quality?: string
  responseFormat?: string
  background?: string
  outputFormat?: string
  outputCompression?: unknown
  inputFidelity?: string
}

export interface SpeechInput {
  model: string
  input: string
  voice: string
  responseFormat?: string
  speed?: unknown
}

export interface VideoInput {
  model: string
  prompt: string
}

export interface RealtimeInput {
  model: string
  voice?: string
}

function isFilled(value: unknown) {
  return !(value === undefined || value === null || value === ``)
}

export function toNumber(value: unknown, fallback: number) {
  const parsed = typeof value === `number` ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toOptionalNumber(value: unknown) {
  if (!isFilled(value)) {
    return undefined
  }

  const parsed = typeof value === `number` ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function normalizeReasoningEffort(value: unknown): ReasoningEffort | undefined {
  if (value === `low` || value === `medium` || value === `high`) {
    return value
  }
  return undefined
}

export function buildApiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, ``)}/${path.replace(/^\/+/, ``)}`
}

export function getCapabilityEndpoint(baseUrl: string, path: string) {
  return buildApiUrl(baseUrl, path)
}

function resolveProtocolPath(path: string, input: unknown) {
  const model = typeof input === `object` && input !== null && `model` in input
    ? String((input as { model?: unknown }).model || ``)
    : ``
  return path.replace(`{model}`, encodeURIComponent(model))
}

function withOptionalField(target: Record<string, unknown>, key: string, value: unknown) {
  if (isFilled(value)) {
    target[key] = value
  }
}

export function buildChatCompletionBody(input: ChatCompletionInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: toNumber(input.parameters?.temperature, 0.7),
    top_p: toNumber(input.parameters?.topP, 1),
    max_tokens: toNumber(input.parameters?.maxTokens, 2048),
    presence_penalty: toNumber(input.parameters?.presencePenalty, 0),
    frequency_penalty: toNumber(input.parameters?.frequencyPenalty, 0),
  }

  withOptionalField(body, `reasoning_effort`, normalizeReasoningEffort(input.parameters?.reasoningEffort))
  withOptionalField(body, `stream`, input.stream)

  return body
}

export function buildCompletionBody(input: CompletionInput) {
  return {
    model: input.model,
    prompt: input.prompt,
    max_tokens: toNumber(input.maxTokens, 2048),
    temperature: toNumber(input.temperature, 0.7),
  }
}

export function buildEmbeddingBody(input: EmbeddingInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    input: input.input,
  }

  withOptionalField(body, `encoding_format`, input.encodingFormat)
  withOptionalField(body, `dimensions`, toOptionalNumber(input.dimensions))
  return body
}

export function buildRerankBody(input: RerankInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    query: input.query,
    documents: input.documents,
  }

  withOptionalField(body, `top_n`, toOptionalNumber(input.topN))
  return body
}

export function buildModerationBody(input: ModerationInput) {
  return {
    model: input.model,
    input: input.input,
  }
}

export function buildImageBody(input: ImageInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
  }

  withOptionalField(body, `n`, toOptionalNumber(input.n))
  withOptionalField(body, `size`, input.size)
  withOptionalField(body, `quality`, input.quality)
  withOptionalField(body, `response_format`, input.responseFormat)
  withOptionalField(body, `background`, input.background)
  withOptionalField(body, `output_format`, input.outputFormat)
  withOptionalField(body, `output_compression`, toOptionalNumber(input.outputCompression))
  withOptionalField(body, `moderation`, input.moderation)
  return body
}

export function buildSpeechBody(input: SpeechInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    input: input.input,
    voice: input.voice,
  }

  withOptionalField(body, `response_format`, input.responseFormat)
  withOptionalField(body, `speed`, toOptionalNumber(input.speed))
  return body
}

export function buildVideoBody(input: VideoInput) {
  return {
    model: input.model,
    prompt: input.prompt,
  }
}

export function buildRealtimeBody(input: RealtimeInput) {
  const body: Record<string, unknown> = {
    model: input.model,
  }

  withOptionalField(body, `voice`, input.voice)
  return body
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.clone().json() as { error?: { message?: string } }
    return payload.error?.message || response.statusText
  }
  catch {
    return await response.text().catch(() => response.statusText)
  }
}

export class AIClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly protocol: AIProtocolId = `openai-chat-completions`,
  ) {}

  private headers(extra?: HeadersInit) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: `application/json`,
      ...extra,
    }
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(buildApiUrl(this.baseUrl, path), init)
    if (!response.ok) {
      throw new Error(`API请求失败 (${response.status}): ${await readErrorMessage(response)}`)
    }
    return response
  }

  async createCapabilityRequest(capability: AICapability, input: unknown) {
    const path = resolveProtocolPath(getProtocolEndpoint(this.protocol, capability), input)
    const body = buildProtocolRequest(this.protocol, capability, input)
    return this.request(path, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(body),
    })
  }

  async listModels() {
    const response = await this.request(`/v1/models`, {
      headers: this.headers({ 'Content-Type': `application/json` }),
    })
    return response.json()
  }

  createChatCompletion(input: ChatCompletionInput) {
    return this.createCapabilityRequest(`chat`, input)
  }

  createCompletion(input: CompletionInput) {
    return this.request(`/v1/completions`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildCompletionBody(input)),
    })
  }

  createEmbedding(input: EmbeddingInput) {
    return this.request(`/v1/embeddings`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildEmbeddingBody(input)),
    })
  }

  createRerank(input: RerankInput) {
    return this.request(`/v1/rerank`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildRerankBody(input)),
    })
  }

  createModeration(input: ModerationInput) {
    return this.request(`/v1/moderations`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildModerationBody(input)),
    })
  }

  createImage(input: ImageInput) {
    return this.createCapabilityRequest(`imageGeneration`, input)
  }

  createImageEdit(input: ImageEditInput) {
    // API requires multipart/form-data with binary image file
    const mimeType = input.mimeType || `image/png`
    const base64Data = input.image.replace(/^data:[^;]+;base64,/, ``)
    const byteString = atob(base64Data)
    const bytes = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mimeType })
    const ext = mimeType.split(`/`)[1] || `png`
    const formData = new FormData()
    formData.append(`image`, blob, `image.${ext}`)
    formData.append(`prompt`, input.prompt)
    formData.append(`model`, input.model)
    if (isFilled(input.n)) {
      formData.append(`n`, String(toOptionalNumber(input.n)))
    }
    if (isFilled(input.size)) {
      formData.append(`size`, input.size!)
    }
    if (isFilled(input.quality)) {
      formData.append(`quality`, input.quality!)
    }
    if (isFilled(input.responseFormat)) {
      formData.append(`response_format`, input.responseFormat!)
    }
    if (isFilled(input.background)) {
      formData.append(`background`, input.background!)
    }
    if (isFilled(input.outputFormat)) {
      formData.append(`output_format`, input.outputFormat!)
    }
    if (isFilled(input.outputCompression)) {
      formData.append(`output_compression`, String(toOptionalNumber(input.outputCompression)))
    }
    if (isFilled(input.inputFidelity)) {
      formData.append(`input_fidelity`, input.inputFidelity!)
    }
    // omit Content-Type so browser sets multipart boundary automatically
    return this.request(`/v1/images/edits`, {
      method: `POST`,
      headers: this.headers(),
      body: formData,
    })
  }

  createSpeech(input: SpeechInput) {
    return this.request(`/v1/audio/speech`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildSpeechBody(input)),
    })
  }

  createTranscription(body: BodyInit) {
    return this.request(`/v1/audio/transcriptions`, {
      method: `POST`,
      headers: this.headers(),
      body,
    })
  }

  createVideo(input: VideoInput) {
    return this.request(`/v1/videos`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildVideoBody(input)),
    })
  }

  createRealtimeSession(input: RealtimeInput) {
    return this.request(`/v1/realtime/sessions`, {
      method: `POST`,
      headers: this.headers({ 'Content-Type': `application/json` }),
      body: JSON.stringify(buildRealtimeBody(input)),
    })
  }
}
