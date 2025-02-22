import { getModelList } from '@/services/ai'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAIStore = defineStore(`ai`, () => {
  const apiKey = useStorage(`md-ai-api-key`, ``)
  const selectedModel = useStorage(`md-ai-selected-model`, `gpt-3.5-turbo`)
  const customModel = useStorage(`md-ai-custom-model`, ``)
  const apiDomain = useStorage(`md-ai-api-domain`, `https://api.puzhehei.top`)
  const presetWords = useStorage<string[]>(`md-ai-preset-words`, [])
  const temperature = useStorage<number>(`md-ai-temperature`, 0.7)
  const maxLength = useStorage<number>(`md-ai-max-length`, 2048)
  const isGenerating = ref(false)
  const settingsDialogVisible = ref(false)
  const availableModels = useStorage<string[]>(`md-ai-available-models`, [])

  // 保存API Key
  function setApiKey(key: string) {
    apiKey.value = key
  }

  // 选择模型
  function selectModel(model: string) {
    selectedModel.value = model
  }

  // 设置自定义模型
  function setCustomModel(model: string) {
    customModel.value = model
  }

  // 设置 API 域名
  function setApiDomain(domain: string) {
    apiDomain.value = domain
  }

  // 添加预设词
  function addPresetWord(word: string) {
    presetWords.value.push(word)
  }

  // 删除预设词
  function removePresetWord(index: number) {
    presetWords.value.splice(index, 1)
  }

  // 更新温度
  function setTemperature(temp: number) {
    temperature.value = temp
  }

  // 更新最大长度
  function setMaxLength(length: number) {
    maxLength.value = length
  }

  // 设置生成状态
  function setGenerating(status: boolean) {
    isGenerating.value = status
  }

  // 获取可用模型列表
  async function fetchAvailableModels() {
    if (apiKey.value && apiDomain.value) {
      try {
        const apiDomainValue = apiDomain.value.endsWith(`/`) ? apiDomain.value : `${apiDomain.value}/`
        availableModels.value = await getModelList(`${apiDomainValue}v1/models`, apiKey.value)

        // 默认选择第一个模型
        if (availableModels.value.length > 0) {
          selectedModel.value = availableModels.value[0]
        }
      }
      catch (error) {
        console.error(`Failed to fetch models:`, error)
        // Optionally, set availableModels to an empty array or a default list
        availableModels.value = []
        throw error // Re-throw to allow the component to handle the error as well
      }
    }
    else {
      availableModels.value = []
      selectedModel.value = `gpt-3.5-turbo` // 恢复默认模型
    }
  }

  return {
    apiKey,
    selectedModel,
    customModel,
    apiDomain,
    presetWords,
    temperature,
    maxLength,
    isGenerating,
    settingsDialogVisible,
    availableModels,
    setApiKey,
    selectModel,
    setCustomModel,
    setApiDomain,
    addPresetWord,
    removePresetWord,
    setTemperature,
    setMaxLength,
    setGenerating,
    fetchAvailableModels,
  }
})