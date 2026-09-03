import type {
  AIParameters,
  ChatMessage,
} from './aiClient'

export type AIProtocolId =
  | `openai-chat-completions`
  | `openai-responses`
  | `anthropic-native`
  | `gemini-native`

export type AICapability =
  | `chat`
  | `mediaRecognition`
  | `imageGeneration`
  | `imageEdit`
  | `embedding`
  | `rerank`
  | `moderation`
  | `image`
  | `speech`
  | `transcription`
  | `video`
  | `realtime`

export interface ProtocolChatInput {
  model: string
  messages: ChatMessage[]
  parameters?: AIParameters
  stream?: boolean
}

export interface ProtocolMediaRecognitionInput {
  model: string
  inputText: string
  media: Array<{ mimeType: string, data: string }>
}

export interface ProtocolImageInput {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  responseFormat?: string
  background?: string
  outputFormat?: string
  outputCompression?: number
  moderation?: string
  inputFidelity?: string
}

export interface AICapabilitySetting {
  enabled: boolean
  followConnectionProtocol: boolean
  protocol: AIProtocolId
  endpoint: string
  model: string
}

export interface AIProtocolDefinition {
  id: AIProtocolId
  label: string
  supportedCapabilities: AICapability[]
  buildEndpoint: (capability: AICapability) => string
  buildRequest: (capability: AICapability, input: any) => Record<string, unknown>
}
