<script setup lang="ts">
import { useAIStore } from '@/stores'
import { BrainCircuit, X } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '../../../components/ui/menubar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'

const aiStore = useAIStore()
const fetchingModels = ref(false)

const {
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
} = storeToRefs(aiStore)

const showCustomModelInput = ref(false)

function toggleCustomModel() {
  showCustomModelInput.value = !showCustomModelInput.value
  if (!showCustomModelInput.value) {
    selectedModel.value = `gpt-3.5-turbo`
  }
}

async function fetchModels() {
  fetchingModels.value = true
  try {
    await aiStore.fetchAvailableModels()
  }
  catch (error) {
    console.error(`Failed to fetch models:`, error)
    // Handle error appropriately, e.g., display an error message to the user
  }
  finally {
    fetchingModels.value = false
  }
}

// 计算属性，用于根据 apiKey 和 apiDomain 的状态返回不同的模型列表
const modelList = computed(() => {
  if (!apiKey.value && !apiDomain.value) {
    return [`gpt-3.5-turbo`, `gpt-4`]
  }
  return availableModels.value
})

// 监听 apiKey 和 apiDomain 的变化
watch(
  [apiKey, apiDomain],
  ([newApiKey, newApiDomain]) => {
    if (!newApiKey && !newApiDomain) {
      selectedModel.value = `gpt-3.5-turbo`
    }
  },
  { immediate: true } // 立即执行一次，确保初始状态正确
)
</script>

<template>
  <MenubarMenu>
    <MenubarTrigger :disabled="isGenerating">
      <div class="flex items-center">
        <BrainCircuit class="mr-2 size-4" :class="{ 'animate-spin': isGenerating }" />
        {{ isGenerating ? 'AI生成中...' : 'AI助手' }}
      </div>
    </MenubarTrigger>
    <MenubarContent align="start">
      <MenubarItem @click="settingsDialogVisible = true">
        <BrainCircuit class="mr-2 size-4" />
        OpenAI 设置
      </MenubarItem>
      <MenubarItem as="a" :href="apiDomain" target="_blank">
        <BrainCircuit class="mr-2 size-4" />
        天马座API
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>

  <!-- OpenAI设置对话框 -->
  <Dialog v-model:open="settingsDialogVisible">
    <DialogContent class="mobile-dialog sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>OpenAI 设置</DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <!-- API Key -->
        <div class="grid gap-2">
          <Label for="apiKey">API Key</Label>
          <Input
            id="apiKey"
            v-model="apiKey"
            type="password"
            placeholder="sk-..."
          />
        </div>

        <!-- API 域名 -->
        <div class="grid gap-2">
          <Label for="apiDomain">API 地址</Label>
          <div class="flex items-center gap-2">
          <Input
            id="apiDomain"
            v-model="apiDomain"
            placeholder="https://api.puzhehei.top"
          />
          </div>
          <p class="text-muted-foreground text-xs">
            输入 https或http加域名，系统会自动补全完整路径，如：https://api.puzhehei.top
          </p>
        </div>

        <!-- 模型选择 -->
        <div class="grid gap-2">
          <Label>模型</Label>
          <div class="flex flex-wrap items-center gap-2">
            <Select
              v-if="!showCustomModelInput"
              v-model="selectedModel"
              class="flex-1"
            >
              <SelectTrigger class="flex-1">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="model in modelList"
                  :key="model"
                  :value="model"
                >
                  {{ model }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else-if="showCustomModelInput"
              v-model="customModel"
              placeholder="输入自定义模型名称"
              class="flex-1"
            />
            <Button
              variant="outline"
              :disabled="fetchingModels"
              @click="fetchModels"
            >
              {{ fetchingModels ? '正在获取' : '获取模型' }}
            </Button>
            <Button
              variant="outline"
              class="whitespace-nowrap"
              :class="{ 'border-primary': showCustomModelInput }"
              @click="toggleCustomModel"
            >
              {{ showCustomModelInput ? '取消自定义' : '自定义模型' }}
            </Button>
          </div>
        </div>

        <!-- 系统提示词 -->
        <div class="grid gap-2">
          <Label>系统提示词</Label>
          <div v-for="(_, index) in presetWords" :key="index" class="flex items-center gap-2">
            <Input v-model="presetWords[index]" />
            <Button
              variant="outline"
              size="icon"
              @click="presetWords.splice(index, 1)"
            >
              <X class="size-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            @click="presetWords.push('')"
          >
            添加提示词
          </Button>
        </div>

        <!-- 温度设置 -->
        <div class="grid gap-2">
          <div class="flex justify-between">
            <Label>温度</Label>
            <span class="text-muted-foreground">{{ Number(temperature).toFixed(1) }}</span>
          </div>
          <Input
            v-model.number="temperature"
            type="number"
            :min="0"
            :max="2"
            :step="0.1"
            class="w-full"
          />
          <p class="text-muted-foreground text-xs">
            较低的值使输出更加集中和确定，较高的值使输出更加多样和创造性
          </p>
        </div>

        <!-- 最大长度 -->
        <div class="grid gap-2">
          <Label>最大长度</Label>
          <Input
            v-model.number="maxLength"
            type="number"
            :min="1"
            :max="4096"
          />
          <p class="text-muted-foreground text-xs">
            生成文本的最大标记数（1-4096）
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="settingsDialogVisible = false">
          取消
        </Button>
        <Button @click="settingsDialogVisible = false">
          确定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
@media (max-width: 768px) {
  .mobile-dialog {
    width: 90% !important;
    max-width: none !important;
    margin: 16px auto !important;
    padding: 16px !important;
  }

  .mobile-dialog :deep(.DialogHeader) {
    padding: 0 0 8px 0;
  }

  .mobile-dialog :deep(.DialogTitle) {
    font-size: 16px;
  }

  .mobile-dialog :deep(label) {
    font-size: 14px;
  }

  .mobile-dialog :deep(input),
  .mobile-dialog :deep(button) {
    height: 36px;
    font-size: 14px;
  }

  .mobile-dialog :deep(.DialogFooter) {
    margin-top: 16px;
  }
}
</style>