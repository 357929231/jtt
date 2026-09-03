import type { Model } from '../services/aiModels'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { aiModelsService } from '../services/aiModels'

export const useAIModelsStore = defineStore(`aiModels`, () => {
  const models = ref<Model[]>([])
  const isLoading = ref(false)
  const error = ref(``)

  async function fetchModels() {
    try {
      isLoading.value = true
      error.value = ``
      models.value = await aiModelsService.fetchAvailableModels()
    }
    catch (e) {
      error.value = `获取模型列表失败`
      console.error(e)
    }
    finally {
      isLoading.value = false
    }
  }

  function setApiBaseUrl(url: string) {
    aiModelsService.setBaseUrl(url)
  }

  function setApiKey(key: string) {
    aiModelsService.setApiKey(key)
  }

  return {
    models,
    isLoading,
    error,
    fetchModels,
    setApiBaseUrl,
    setApiKey,
  }
})
