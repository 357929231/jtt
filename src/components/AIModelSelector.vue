<script setup lang="ts">
import { onMounted } from 'vue'
import { useAIStore } from '../stores/ai'
import { useAIModelsStore } from '../stores/aiModels'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const { modelId } = defineProps({
  modelId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits([`update:modelId`])

const aiStore = useAIStore()
const aiModelsStore = useAIModelsStore()

onMounted(async () => {
  aiModelsStore.setApiBaseUrl(aiStore.connection.baseUrl)
  aiModelsStore.setApiKey(aiStore.connection.apiKey)
  await aiModelsStore.fetchModels()
})

function handleModelChange(value: string) {
  emit(`update:modelId`, value)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <Select :value="modelId" @update:value="handleModelChange">
        <SelectTrigger class="w-[240px]">
          <SelectValue placeholder="选择AI模型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="model in aiModelsStore.models"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="aiModelsStore.isLoading"
          @click="aiModelsStore.fetchModels"
        >
          {{ aiModelsStore.isLoading ? '获取中...' : '获取模型' }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="aiModelsStore.isLoading"
          @click="aiModelsStore.fetchModels"
        >
          刷新列表
        </Button>
      </div>
    </div>
    <p v-if="aiModelsStore.error" class="text-sm text-red-500">
      {{ aiModelsStore.error }}
    </p>
    <p v-if="aiModelsStore.models.length === 0 && !aiModelsStore.error" class="text-sm text-gray-500">
      请点击"获取模型"按钮获取可用的模型列表
    </p>
  </div>
</template>
