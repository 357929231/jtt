import type { AIParameters as AIClientParameters, ReasoningEffort } from '@/services/aiClient'
import type { AICapability, AICapabilitySetting, AIProtocolId } from '@/services/aiProtocolTypes'
import type { Model } from '../services/aiModels'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AIClient, getCapabilityEndpoint as getResolvedCapabilityEndpoint, toNumber } from '../services/aiClient'
import { aiModelsService } from '../services/aiModels'
import { getProtocolDefinition, listProtocols } from '../services/aiProtocolRegistry'

export type ModelCapability = `chatModel` | `completionModel` | `embeddingModel` | `rerankModel` | `moderationModel` | `imageModel` | `speechModel` | `transcriptionModel` | `videoModel` | `realtimeModel`
export type CapabilityTest = `models` | `chat` | `mediaRecognition` | `embeddings` | `rerank` | `moderations` | `imageGeneration` | `imageEdit` | `speech` | `video` | `realtime`

export interface AIConnectionSettings {
  baseUrl: string
  apiKey: string
  apiStyle: `openai-compatible`
  mode: `direct` | `worker-proxy`
  protocol: AIProtocolId
}

export interface AIDefaultModels {
  chatModel: string
  completionModel: string
  embeddingModel: string
  rerankModel: string
  moderationModel: string
  imageModel: string
  speechModel: string
  transcriptionModel: string
  videoModel: string
  realtimeModel: string
}

export interface AICapabilitySettings {
  chat: AICapabilitySetting
  imageGeneration: AICapabilitySetting
  imageEdit: AICapabilitySetting
  mediaRecognition: AICapabilitySetting
}

export interface AIParameters extends AIClientParameters {
  temperature: number
  topP: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  reasoningEffort: ReasoningEffort | ``
}

export interface AIImageParameters {
  n: number
  size: string
  quality: string
  responseFormat: string
  background: string
  outputFormat: string
  outputCompression: number | ``
  moderation: string
  inputFidelity: string
}

function readLegacyString(key: string, fallback = ``) {
  return localStorage.getItem(key) || fallback
}

function readLegacyNumber(key: string, fallback: number) {
  return toNumber(localStorage.getItem(key), fallback)
}

function readLegacyAiSettings() {
  try {
    const raw = localStorage.getItem(`aiSettings`)
    return raw ? JSON.parse(raw) : {}
  }
  catch {
    return {}
  }
}

function createConnectionDefaults(): AIConnectionSettings {
  const legacy = readLegacyAiSettings()
  return {
    baseUrl: readLegacyString(`md-ai-api-domain`, legacy.apiDomain || `https://api.xiaohuxing.eu.org`),
    apiKey: readLegacyString(`md-ai-api-key`, legacy.apiKey || ``),
    apiStyle: `openai-compatible`,
    mode: legacy.connection?.mode === `worker-proxy` ? `worker-proxy` : `direct`,
    protocol: legacy.connection?.protocol || `openai-chat-completions`,
  }
}

function createModelDefaults(): AIDefaultModels {
  const legacy = readLegacyAiSettings()
  const legacyCustomModel = readLegacyString(`md-ai-custom-model`, ``)
  const chatModel = legacyCustomModel || readLegacyString(`md-ai-selected-model`, legacy.selectedModel || `gpt-4o-mini`)
  return {
    chatModel,
    completionModel: legacy.completionModel || chatModel,
    embeddingModel: legacy.embeddingModel || `text-embedding-3-small`,
    rerankModel: legacy.rerankModel || ``,
    moderationModel: legacy.moderationModel || ``,
    imageModel: legacy.imageModel || `dall-e-3`,
    speechModel: legacy.speechModel || `tts-1`,
    transcriptionModel: legacy.transcriptionModel || ``,
    videoModel: legacy.videoModel || ``,
    realtimeModel: legacy.realtimeModel || ``,
  }
}

function createParameterDefaults(): AIParameters {
  const legacy = readLegacyAiSettings()
  return {
    temperature: readLegacyNumber(`md-ai-temperature`, legacy.temperature || 0.7),
    topP: toNumber(legacy.topP, 1),
    maxTokens: readLegacyNumber(`md-ai-max-length`, legacy.maxLength || 2048),
    presencePenalty: toNumber(legacy.presencePenalty, 0),
    frequencyPenalty: toNumber(legacy.frequencyPenalty, 0),
    reasoningEffort: legacy.reasoningEffort === `low` || legacy.reasoningEffort === `medium` || legacy.reasoningEffort === `high` ? legacy.reasoningEffort : ``,
  }
}

function createImageParameterDefaults(): AIImageParameters {
  const legacy = readLegacyAiSettings()
  return {
    n: Math.max(1, Math.round(toNumber(legacy.imageParameters?.n, 1))),
    size: legacy.imageParameters?.size || `1024x1024`,
    quality: legacy.imageParameters?.quality || `auto`,
    responseFormat: legacy.imageParameters?.responseFormat || `url`,
    background: legacy.imageParameters?.background || ``,
    outputFormat: legacy.imageParameters?.outputFormat || ``,
    outputCompression: legacy.imageParameters?.outputCompression ?? ``,
    moderation: legacy.imageParameters?.moderation || ``,
    inputFidelity: legacy.imageParameters?.inputFidelity || ``,
  }
}

function createPresetDefaults() {
  const legacy = readLegacyAiSettings()
  return Array.isArray(legacy.presetWords) && legacy.presetWords.length > 0
    ? legacy.presetWords
    : [``]
}

function createCapabilityDefaults(): AICapabilitySettings {
  return {
    chat: {
      enabled: true,
      followConnectionProtocol: true,
      protocol: `openai-chat-completions`,
      endpoint: ``,
      model: `gpt-4o-mini`,
    },
    imageGeneration: {
      enabled: true,
      followConnectionProtocol: true,
      protocol: `openai-chat-completions`,
      endpoint: ``,
      model: `dall-e-3`,
    },
    imageEdit: {
      enabled: true,
      followConnectionProtocol: true,
      protocol: `openai-chat-completions`,
      endpoint: ``,
      model: `gpt-image-1`,
    },
    mediaRecognition: {
      enabled: true,
      followConnectionProtocol: true,
      protocol: `gemini-native`,
      endpoint: ``,
      model: `gemini-1.5-pro`,
    },
  }
}

export const useAIStore = defineStore(`ai`, () => {
  const connection = useStorage<AIConnectionSettings>(`md-ai-connection`, createConnectionDefaults())
  const defaults = useStorage<AIDefaultModels>(`md-ai-default-models`, createModelDefaults())
  const capabilities = useStorage<AICapabilitySettings>(`md-ai-capabilities`, createCapabilityDefaults())
  const parameters = useStorage<AIParameters>(`md-ai-parameters`, createParameterDefaults())
  const imageParameters = useStorage<AIImageParameters>(`md-ai-image-parameters`, createImageParameterDefaults())
  const presetWords = useStorage<string[]>(`md-ai-preset-words`, createPresetDefaults())
  const customModel = useStorage(`md-ai-custom-model`, readLegacyString(`md-ai-custom-model`, ``))
  const customModels = useStorage<string[]>(`md-ai-custom-models`, [])

  const settingsDialogVisible = ref(false)
  const isGenerating = ref(false)
  const models = ref<Model[]>([])
  const isLoading = ref(false)
  const error = ref(``)
  const capabilityTestResults = ref<Record<string, string>>({})
  const isTestingCapability = ref<Record<string, boolean>>({})

  function syncModelService() {
    aiModelsService.setBaseUrl(connection.value.baseUrl)
    aiModelsService.setApiKey(connection.value.apiKey)
  }

  syncModelService()

  if (customModel.value) {
    if (!customModels.value.includes(customModel.value)) {
      customModels.value.push(customModel.value)
    }
    defaults.value.chatModel = customModel.value
    customModel.value = ``
  }

  function getClient() {
    if (connection.value.mode === `direct` && !connection.value.apiKey) {
      throw new Error(`请先设置 API Key`)
    }

    if (!connection.value.baseUrl || connection.value.baseUrl === `YOUR_API_BASE_URL`) {
      throw new Error(`请先设置 API 地址`)
    }

    return new AIClient(connection.value.baseUrl, connection.value.mode === `worker-proxy` ? `proxy-mode` : connection.value.apiKey, connection.value.protocol)
  }

  const usingProxy = computed(() => connection.value.mode === `worker-proxy`)
  const availableProtocols = computed(() => listProtocols())
  const supportedCapabilities = computed(() => getProtocolDefinition(connection.value.protocol).supportedCapabilities)

  function getCapabilityProtocol(capability: keyof AICapabilitySettings) {
    const config = capabilities.value[capability]
    return config.followConnectionProtocol ? connection.value.protocol : config.protocol
  }

  function getCapabilityEndpoint(capability: keyof AICapabilitySettings) {
    const config = capabilities.value[capability]
    return config.endpoint.trim()
  }

  function getCapabilityModel(capability: keyof AICapabilitySettings) {
    const config = capabilities.value[capability]
    return config.model.trim()
  }

  function updateCapabilitySetting<K extends keyof AICapabilitySettings>(capability: K, key: keyof AICapabilitySettings[K], value: any) {
    ;(capabilities.value[capability][key] as any) = value
  }

  const apiKey = computed({
    get: () => connection.value.apiKey,
    set: (value: string) => {
      connection.value.apiKey = value.trim()
      syncModelService()
    },
  })

  const apiDomain = computed({
    get: () => connection.value.baseUrl,
    set: (value: string) => {
      connection.value.baseUrl = value.trim()
      syncModelService()
    },
  })

  const selectedModel = computed({
    get: () => defaults.value.chatModel,
    set: (value: string) => {
      defaults.value.chatModel = value
      localStorage.setItem(`md-ai-selected-model`, value)
    },
  })

  const temperature = computed({
    get: () => parameters.value.temperature,
    set: (value: number | string) => {
      parameters.value.temperature = toNumber(value, 0.7)
    },
  })

  const maxLength = computed({
    get: () => parameters.value.maxTokens,
    set: (value: number | string) => {
      parameters.value.maxTokens = Math.max(1, Math.round(toNumber(value, 2048)))
    },
  })

  async function fetchModels(options?: { strict?: boolean }) {
    if (!connection.value.apiKey) {
      error.value = `请先设置API Key`
      return
    }
    if (!connection.value.baseUrl) {
      error.value = `请先设置API地址`
      return
    }

    try {
      isLoading.value = true
      error.value = ``
      syncModelService()
      models.value = await aiModelsService.fetchAvailableModels({ fallbackToDefaults: !options?.strict })
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : `获取模型列表失败`
      models.value = []
    }
    finally {
      isLoading.value = false
    }
  }

  function selectModel(model: string) {
    if (!model) {
      return
    }

    selectedModel.value = model
  }

  function setDefaultModel(capability: ModelCapability, model: string) {
    defaults.value[capability] = model
    if (capability === `chatModel`) {
      localStorage.setItem(`md-ai-selected-model`, model)
    }
  }

  function setCustomModel(model: string) {
    customModel.value = model.trim()
  }

  function setApiKey(key: string) {
    apiKey.value = key
  }

  function setApiDomain(domain: string) {
    apiDomain.value = domain
  }

  function setConnectionMode(mode: AIConnectionSettings[`mode`]) {
    connection.value.mode = mode
  }

  function setProtocol(protocol: AIProtocolId) {
    connection.value.protocol = protocol
  }

  function setTemperature(value: number) {
    temperature.value = value
  }

  function setMaxLength(value: number) {
    maxLength.value = value
  }

  function updateParameter<K extends keyof AIParameters>(key: K, value: AIParameters[K] | string | number) {
    if (key === `reasoningEffort`) {
      parameters.value.reasoningEffort = value === `low` || value === `medium` || value === `high` ? value : ``
      return
    }

    const numericKeys = new Set<keyof AIParameters>([`temperature`, `topP`, `maxTokens`, `presencePenalty`, `frequencyPenalty`])
    if (numericKeys.has(key)) {
      const fallbackMap: Record<string, number> = {
        temperature: 0.7,
        topP: 1,
        maxTokens: 2048,
        presencePenalty: 0,
        frequencyPenalty: 0,
      }
      ;(parameters.value[key] as number) = toNumber(value, fallbackMap[key as string])
      if (key === `maxTokens`) {
        parameters.value.maxTokens = Math.max(1, Math.round(parameters.value.maxTokens))
      }
    }
  }

  function updateImageParameter<K extends keyof AIImageParameters>(key: K, value: AIImageParameters[K] | string | number) {
    if (key === `n`) {
      imageParameters.value.n = Math.max(1, Math.round(toNumber(value, 1)))
      return
    }
    if (key === `outputCompression`) {
      imageParameters.value.outputCompression = value === `` ? `` : Math.max(0, Math.min(100, Math.round(toNumber(value, 85))))
      return
    }
    ;(imageParameters.value[key] as string) = String(value)
  }

  function addPresetWord(word: string) {
    presetWords.value.push(word)
  }

  function removePresetWord(index: number) {
    presetWords.value.splice(index, 1)
  }

  function setGenerating(status: boolean) {
    isGenerating.value = status
  }

  function addCustomModel(modelName: string) {
    const normalized = modelName.trim()
    if (!normalized || customModels.value.includes(normalized)) {
      return
    }

    customModels.value.push(normalized)
    selectedModel.value = normalized
  }

  function removeCustomModel(modelName: string) {
    const index = customModels.value.indexOf(modelName)
    if (index > -1) {
      customModels.value.splice(index, 1)
    }

    if (selectedModel.value === modelName) {
      selectedModel.value = models.value[0]?.id || `gpt-4o-mini`
    }
  }

  function getCurrentModelId() {
    return defaults.value.chatModel || `gpt-4o-mini`
  }

  function saveAllSettings() {
    syncModelService()
    localStorage.setItem(`aiSettings`, JSON.stringify({
      connection: connection.value,
      capabilities: capabilities.value,
      defaults: defaults.value,
      parameters: parameters.value,
      imageParameters: imageParameters.value,
      presetWords: presetWords.value,
      customModels: customModels.value,
      customModel: customModel.value,
    }))
    localStorage.setItem(`md-ai-selected-model`, defaults.value.chatModel)
  }

  function getResolvedEndpoint(path: string) {
    return getResolvedCapabilityEndpoint(connection.value.baseUrl, path)
  }

  async function recognizeMedia(input: { model: string, inputText: string, media: Array<{ mimeType: string, data: string }> }) {
    const capProtocol = getCapabilityProtocol(`mediaRecognition`)
    const capEndpoint = getCapabilityEndpoint(`mediaRecognition`)
    const baseUrl = capEndpoint || connection.value.baseUrl
    const apiKey = connection.value.mode === `worker-proxy` ? `proxy-mode` : connection.value.apiKey
    const client = new AIClient(baseUrl, apiKey, capProtocol)
    const response = await client.createCapabilityRequest(`mediaRecognition`, input)
    return response.json()
  }

  async function generateImage(input: { prompt: string, n?: number, size?: string }) {
    const capProtocol = getCapabilityProtocol(`imageGeneration`)
    const capEndpoint = getCapabilityEndpoint(`imageGeneration`)
    const baseUrl = capEndpoint || connection.value.baseUrl
    const apiKey = connection.value.mode === `worker-proxy` ? `proxy-mode` : connection.value.apiKey
    const client = new AIClient(baseUrl, apiKey, capProtocol)
    const response = await client.createImage({
      model: getCapabilityModel(`imageGeneration`) || defaults.value.imageModel || `dall-e-3`,
      prompt: input.prompt,
      n: input.n || imageParameters.value.n,
      size: input.size || imageParameters.value.size,
      quality: imageParameters.value.quality,
      responseFormat: imageParameters.value.responseFormat,
      background: imageParameters.value.background,
      outputFormat: imageParameters.value.outputFormat,
      outputCompression: imageParameters.value.outputCompression,
      moderation: imageParameters.value.moderation,
    })
    return response.json()
  }

  async function editImage(input: { prompt: string, image: string, mimeType?: string }) {
    const capProtocol = getCapabilityProtocol(`imageEdit`)
    const capEndpoint = getCapabilityEndpoint(`imageEdit`)
    const baseUrl = capEndpoint || connection.value.baseUrl
    const apiKey = connection.value.mode === `worker-proxy` ? `proxy-mode` : connection.value.apiKey
    const client = new AIClient(baseUrl, apiKey, capProtocol)
    const response = await client.createImageEdit({
      model: getCapabilityModel(`imageEdit`) || `gpt-image-1`,
      prompt: input.prompt,
      image: input.image,
      mimeType: input.mimeType,
      n: imageParameters.value.n,
      size: imageParameters.value.size,
      quality: imageParameters.value.quality,
      responseFormat: imageParameters.value.responseFormat,
      background: imageParameters.value.background,
      outputFormat: imageParameters.value.outputFormat,
      outputCompression: imageParameters.value.outputCompression,
      inputFidelity: imageParameters.value.inputFidelity,
    })
    return response.json()
  }

  function protocolSupports(capability: AICapability) {
    return supportedCapabilities.value.includes(capability)
  }

  async function runCapabilityTest(capability: CapabilityTest) {
    isTestingCapability.value = {
      ...isTestingCapability.value,
      [capability]: true,
    }

    try {
      const client = getClient()
      let result = `测试成功`

      switch (capability) {
        case `models`:
          await fetchModels({ strict: true })
          result = `模型列表获取成功，共 ${models.value.length} 个模型`
          break
        case `chat`: {
          const response = await client.createChatCompletion({
            model: getCurrentModelId(),
            messages: [{ role: `user`, content: `请回复：pong` }],
            parameters: parameters.value,
          })
          const payload = await response.json() as any
          result = payload.choices?.[0]?.message?.content || `聊天接口调用成功`
          break
        }
        case `mediaRecognition`: {
          const payload = await recognizeMedia({
            model: defaults.value.chatModel || getCurrentModelId(),
            inputText: `Describe this image`,
            media: [{ mimeType: `image/png`, data: `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==` }],
          }) as any
          result = payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join(``) || `Gemini 媒体识别调用成功`
          break
        }
        case `embeddings`: {
          const response = await client.createEmbedding({
            model: defaults.value.embeddingModel || `text-embedding-3-small`,
            input: `ping`,
          })
          const payload = await response.json() as any
          result = `嵌入接口调用成功，向量数 ${payload.data?.length || 0}`
          break
        }
        case `moderations`: {
          const response = await client.createModeration({
            model: defaults.value.moderationModel || getCurrentModelId(),
            input: `hello`,
          })
          const payload = await response.json() as any
          result = payload.results ? `审查接口调用成功` : `审查接口响应成功`
          break
        }
        case `rerank`: {
          const response = await client.createRerank({
            model: defaults.value.rerankModel || `jina-reranker-v2-base-multilingual`,
            query: `wechat article`,
            documents: [`wechat article editor`, `weather report`],
            topN: 1,
          })
          const payload = await response.json() as any
          result = `重排序接口调用成功，结果数 ${payload.results?.length || 0}`
          break
        }
        case `imageGeneration`: {
          const payload = await generateImage({
            prompt: `A minimal geometric logo`,
            n: 1,
            size: `1024x1024`,
          }) as any
          result = payload.data?.[0]?.url || payload.data?.[0]?.b64_json ? `图像接口调用成功` : `图像接口响应成功`
          break
        }
        case `imageEdit`: {
          const payload = await editImage({
            prompt: `Make this single pixel blue`,
            image: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==`,
            mimeType: `image/png`,
          }) as any
          result = payload.data?.[0]?.url || payload.data?.[0]?.b64_json ? `图片编辑接口调用成功` : `图片编辑接口响应成功`
          break
        }
        case `speech`: {
          await client.createSpeech({
            model: defaults.value.speechModel || `tts-1`,
            input: `hello`,
            voice: `alloy`,
            responseFormat: `mp3`,
            speed: 1,
          })
          result = `语音合成接口调用成功`
          break
        }
        case `video`: {
          await client.createVideo({
            model: defaults.value.videoModel || getCurrentModelId(),
            prompt: `A short product teaser`,
          })
          result = `视频接口调用成功`
          break
        }
        case `realtime`: {
          await client.createRealtimeSession({
            model: defaults.value.realtimeModel || getCurrentModelId(),
          })
          result = `实时语音接口调用成功`
          break
        }
      }

      capabilityTestResults.value = {
        ...capabilityTestResults.value,
        [capability]: result,
      }
      return result
    }
    catch (e) {
      const message = e instanceof Error ? e.message : `测试失败`
      capabilityTestResults.value = {
        ...capabilityTestResults.value,
        [capability]: message,
      }
      throw e
    }
    finally {
      isTestingCapability.value = {
        ...isTestingCapability.value,
        [capability]: false,
      }
    }
  }

  if (connection.value.apiKey && connection.value.baseUrl && models.value.length === 0) {
    setTimeout(() => {
      fetchModels().catch(() => {})
    }, 200)
  }

  return {
    connection,
    capabilities,
    usingProxy,
    availableProtocols,
    supportedCapabilities,
    defaults,
    parameters,
    imageParameters,
    apiKey,
    apiDomain,
    selectedModel,
    customModel,
    presetWords,
    temperature,
    maxLength,
    isGenerating,
    settingsDialogVisible,
    models,
    customModels,
    isLoading,
    error,
    capabilityTestResults,
    isTestingCapability,
    setApiKey,
    selectModel,
    setCustomModel,
    setApiDomain,
    setConnectionMode,
    setProtocol,
    updateCapabilitySetting,
    addPresetWord,
    removePresetWord,
    setTemperature,
    setMaxLength,
    updateParameter,
    updateImageParameter,
    setGenerating,
    fetchModels,
    addCustomModel,
    removeCustomModel,
    saveAllSettings,
    getCurrentModelId,
    setDefaultModel,
    runCapabilityTest,
    getClient,
    getResolvedEndpoint,
    protocolSupports,
    recognizeMedia,
    getCapabilityProtocol,
    getCapabilityEndpoint,
    getCapabilityModel,
    generateImage,
    editImage,
  }
})
