<script setup lang="ts">
import type { CapabilityTest, ModelCapability } from '@/stores/ai'
import { useAIStore } from '@/stores'
import { BrainCircuit } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '../../../components/ui/menubar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { useToast } from '../../../components/ui/use-toast'
import AIModelSelector from './AIModelSelector.vue'

const aiStore = useAIStore()
const { toast } = useToast()

const {
  apiKey,
  apiDomain,
  connection,
  usingProxy,
  availableProtocols,
  supportedCapabilities,
  defaults,
  parameters,
  imageParameters,
  presetWords,
  customModels,
  isGenerating,
  settingsDialogVisible,
  isLoading,
  error,
  capabilityTestResults,
  isTestingCapability,
} = storeToRefs(aiStore)

const activeTab = ref(`connection`)
const customModelName = ref(``)
const mediaPrompt = ref(`Describe this image`)
const mediaRecognitionResult = ref(``)
const selectedMedia = ref<{ mimeType: string, data: string } | null>(null)

const modelFields: Array<{ key: ModelCapability, label: string }> = [
  { key: `chatModel`, label: `聊天模型` },
  { key: `completionModel`, label: `补全模型` },
  { key: `embeddingModel`, label: `嵌入模型` },
  { key: `rerankModel`, label: `重排序模型` },
  { key: `moderationModel`, label: `审查模型` },
  { key: `imageModel`, label: `图像模型` },
  { key: `speechModel`, label: `语音合成模型` },
  { key: `transcriptionModel`, label: `转录模型` },
  { key: `videoModel`, label: `视频模型` },
  { key: `realtimeModel`, label: `实时语音模型` },
]

const capabilityTests: Array<{ key: CapabilityTest, label: string, endpoint: string }> = [
  { key: `models`, label: `模型列表`, endpoint: `/v1/models` },
  { key: `chat`, label: `聊天`, endpoint: `/v1/chat/completions` },
  { key: `mediaRecognition`, label: `媒体识别`, endpoint: `/v1beta/models:generateContent` },
  { key: `embeddings`, label: `嵌入`, endpoint: `/v1/embeddings` },
  { key: `rerank`, label: `重排序`, endpoint: `/v1/rerank` },
  { key: `moderations`, label: `审查`, endpoint: `/v1/moderations` },
  { key: `imageGeneration`, label: `图像生成`, endpoint: `/v1/images/generations` },
  { key: `imageEdit`, label: `图像编辑`, endpoint: `/v1/images/edits` },
  { key: `speech`, label: `语音合成`, endpoint: `/v1/audio/speech` },
  { key: `video`, label: `视频`, endpoint: `/v1/videos` },
  { key: `realtime`, label: `实时语音`, endpoint: `/v1/realtime/sessions` },
]

const capabilityMap: Record<string, string> = {
  chat: `chat`,
  mediaRecognition: `mediaRecognition`,
  embeddings: `embedding`,
  rerank: `rerank`,
  moderations: `moderation`,
  imageGeneration: `imageGeneration`,
  imageEdit: `imageEdit`,
  speech: `speech`,
  video: `video`,
  realtime: `realtime`,
}

const modelFieldCapabilityMap: Record<ModelCapability, string> = {
  chatModel: `chat`,
  completionModel: `chat`,
  embeddingModel: `embedding`,
  rerankModel: `rerank`,
  moderationModel: `moderation`,
  imageModel: `image`,
  speechModel: `speech`,
  transcriptionModel: `transcription`,
  videoModel: `video`,
  realtimeModel: `realtime`,
}

const visibleModelFields = computed(() => modelFields.filter(field => aiStore.protocolSupports(modelFieldCapabilityMap[field.key] as any)))
const visibleCapabilityTests = computed(() => capabilityTests.filter(item => item.key === `models` || aiStore.protocolSupports(capabilityMap[item.key] as any)))

const capabilityOverrideFields = [
  { key: `chat`, label: `聊天` },
  { key: `imageGeneration`, label: `图像生成` },
  { key: `imageEdit`, label: `图像编辑` },
  { key: `mediaRecognition`, label: `媒体识别` },
] as const

function resolveEndpoint(path: string) {
  return aiStore.getResolvedEndpoint(path)
}

function resolveCapabilityTestEndpoint(item: { key: CapabilityTest, endpoint: string }) {
  if (item.key === `mediaRecognition` && connection.value.protocol === `gemini-native`) {
    return resolveEndpoint(`/v1beta/models/${defaults.value.chatModel || `gemini-2.5-flash`}:generateContent`)
  }
  if (item.key === `imageGeneration` && connection.value.protocol === `gemini-native`) {
    return resolveEndpoint(`/v1beta/models/${defaults.value.imageModel || `imagen-4.0-generate-001`}:predict`)
  }
  return resolveEndpoint(item.endpoint)
}

async function saveSettings() {
  aiStore.saveAllSettings()
  settingsDialogVisible.value = false
  toast({
    title: `设置已保存`,
    description: `AI 配置已更新，聊天模型: ${defaults.value.chatModel || `未设置`}`,
  })
}

async function refreshModels() {
  await aiStore.fetchModels()
  if (!error.value) {
    toast({
      title: `模型列表已更新`,
      description: `已获取最新可用模型列表`,
    })
  }
}

async function addCustomModel() {
  if (!customModelName.value.trim()) {
    toast({
      title: `无法添加模型`,
      description: `请输入模型名称`,
      variant: `destructive`,
    })
    return
  }

  aiStore.addCustomModel(customModelName.value)
  customModelName.value = ``
}

async function runCapabilityTest(key: CapabilityTest) {
  try {
    const message = await aiStore.runCapabilityTest(key)
    toast({
      title: `能力测试成功`,
      description: message,
    })
  }
  catch (e) {
    toast({
      title: `能力测试失败`,
      description: e instanceof Error ? e.message : `请求失败`,
      variant: `destructive`,
    })
  }
}

async function handleMediaFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    selectedMedia.value = null
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const result = typeof reader.result === `string` ? reader.result.split(`,`)[1] || `` : ``
    selectedMedia.value = {
      mimeType: file.type || `image/png`,
      data: result,
    }
  }
  reader.readAsDataURL(file)
}

async function runMediaRecognition() {
  if (!selectedMedia.value) {
    toast({
      title: `媒体识别失败`,
      description: `请先选择图片文件`,
      variant: `destructive`,
    })
    return
  }

  try {
    const payload = await aiStore.recognizeMedia({
      model: defaults.value.chatModel,
      inputText: mediaPrompt.value,
      media: [selectedMedia.value],
    }) as any
    mediaRecognitionResult.value = payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join(``) || `识别成功`
  }
  catch (error) {
    toast({
      title: `媒体识别失败`,
      description: error instanceof Error ? error.message : `请求失败`,
      variant: `destructive`,
    })
  }
}

watch(settingsDialogVisible, async (newValue) => {
  if (newValue && aiStore.models.length === 0 && apiKey.value && apiDomain.value) {
    await aiStore.fetchModels()
  }
})
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
        AI 提供商设置
      </MenubarItem>
      <MenubarItem as="a" :href="apiDomain" target="_blank">
        <BrainCircuit class="mr-2 size-4" />
        打开 API 地址
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>

  <Dialog v-model:open="settingsDialogVisible">
    <DialogContent class="sm:max-w-[900px]">
      <DialogHeader>
        <DialogTitle>AI 提供商设置</DialogTitle>
        <DialogDescription>
          配置 New API / OpenAI 兼容接口，按能力映射模型并测试端点。
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="grid gap-4">
        <TabsList class="grid grid-cols-2 h-auto gap-2 bg-transparent md:grid-cols-4">
          <TabsTrigger value="connection">
            连接
          </TabsTrigger>
          <TabsTrigger value="models">
            模型
          </TabsTrigger>
          <TabsTrigger value="parameters">
            参数
          </TabsTrigger>
          <TabsTrigger value="capabilities">
            能力
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" class="grid gap-4">
          <div class="grid gap-2">
            <Label for="protocol">协议格式</Label>
            <select id="protocol" v-model="connection.protocol" class="bg-background border-input h-10 w-full flex border rounded-md px-3 py-2 text-sm">
              <option v-for="protocol in availableProtocols" :key="protocol.id" :value="protocol.id">
                {{ protocol.label }}
              </option>
            </select>
            <p class="text-muted-foreground text-xs">
              当前协议会影响真实请求格式、端点、能力可见性和主生成流程。
            </p>
          </div>

          <div class="grid gap-2">
            <Label for="connectionMode">连接模式</Label>
            <select id="connectionMode" v-model="connection.mode" class="bg-background border-input h-10 w-full flex border rounded-md px-3 py-2 text-sm">
              <option value="direct">
                直连上游 API
              </option>
              <option value="worker-proxy">
                Worker Proxy /api 代理
              </option>
            </select>
            <p class="text-muted-foreground text-xs">
              代理模式下，浏览器不会直接使用真实 API Key，推荐配合 Cloudflare Worker 使用。
            </p>
          </div>

          <div class="grid gap-2">
            <Label for="apiKey">API Key</Label>
            <Input id="apiKey" v-model="apiKey" type="password" :placeholder="usingProxy ? '代理模式可留空，由 Worker 注入上游 Key' : 'sk-...'" :disabled="usingProxy" />
          </div>

          <div class="grid gap-2">
            <Label for="apiDomain">Base URL</Label>
            <Input id="apiDomain" v-model="apiDomain" :placeholder="usingProxy ? 'https://your-editor-domain.example.com/api' : 'https://api.xiaohuxing.eu.org'" />
            <p class="text-muted-foreground text-xs">
              {{ usingProxy ? '代理模式请填写你的站点 /api 根地址，例如 https://your-domain.example.com/api。' : '直连模式请填写 OpenAI 兼容根地址，能力端点会自动拼接。' }}
            </p>
          </div>

          <div class="grid gap-2 border rounded-md p-4 text-sm">
            <p><span class="font-medium">兼容族：</span>{{ connection.apiStyle }}</p>
            <p><span class="font-medium">当前协议：</span>{{ connection.protocol }}</p>
            <p><span class="font-medium">连接模式：</span>{{ connection.mode }}</p>
            <p><span class="font-medium">支持能力：</span>{{ supportedCapabilities.join(', ') }}</p>
            <p><span class="font-medium">当前聊天端点：</span>{{ resolveEndpoint(connection.protocol === 'openai-responses' ? '/v1/responses' : connection.protocol === 'anthropic-native' ? '/v1/messages' : connection.protocol === 'gemini-native' ? `/v1beta/models/${defaults.chatModel || 'gemini-2.5-flash'}:generateContent` : '/v1/chat/completions') }}</p>
            <p><span class="font-medium">当前模型列表端点：</span>{{ resolveEndpoint('/v1/models') }}</p>
          </div>
        </TabsContent>

        <TabsContent value="models" class="grid gap-4">
          <div class="flex flex-wrap items-center gap-2">
            <Button variant="outline" :disabled="isLoading" @click="refreshModels">
              {{ isLoading ? '获取中...' : '获取模型列表' }}
            </Button>
            <span class="text-muted-foreground text-xs">模型列表来自 `/v1/models`，再映射到不同能力。</span>
          </div>

          <p v-if="error" class="text-sm text-red-500">
            {{ error }}
          </p>

          <div class="grid gap-4 md:grid-cols-2">
            <AIModelSelector
              v-for="field in visibleModelFields"
              :key="field.key"
              :label="field.label"
              :model-id="defaults[field.key]"
              @update:model-id="value => aiStore.setDefaultModel(field.key, value)"
            />
          </div>

          <div class="grid gap-2 border rounded-md p-4">
            <Label>自定义模型</Label>
            <div class="flex gap-2">
              <Input v-model="customModelName" placeholder="输入私有模型 ID，例如 gpt-4o-mini-custom" />
              <Button variant="outline" @click="addCustomModel">
                添加
              </Button>
            </div>
            <div v-if="customModels.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="model in customModels"
                :key="model"
                type="button"
                class="border rounded-full px-3 py-1 text-xs"
                @click="aiStore.removeCustomModel(model)"
              >
                {{ model }} · 删除
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="parameters" class="grid gap-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="grid gap-2">
              <Label for="temperature">温度</Label>
              <Input id="temperature" :model-value="parameters.temperature" type="number" step="0.1" min="0" max="2" @update:model-value="value => aiStore.updateParameter('temperature', value)" />
            </div>

            <div class="grid gap-2">
              <Label for="topP">Top P</Label>
              <Input id="topP" :model-value="parameters.topP" type="number" step="0.1" min="0" max="1" @update:model-value="value => aiStore.updateParameter('topP', value)" />
            </div>

            <div class="grid gap-2">
              <Label for="maxTokens">Max Tokens</Label>
              <Input id="maxTokens" :model-value="parameters.maxTokens" type="number" step="1" min="1" @update:model-value="value => aiStore.updateParameter('maxTokens', value)" />
            </div>

            <div class="grid gap-2">
              <Label for="presencePenalty">Presence Penalty</Label>
              <Input id="presencePenalty" :model-value="parameters.presencePenalty" type="number" step="0.1" min="-2" max="2" @update:model-value="value => aiStore.updateParameter('presencePenalty', value)" />
            </div>

            <div class="grid gap-2">
              <Label for="frequencyPenalty">Frequency Penalty</Label>
              <Input id="frequencyPenalty" :model-value="parameters.frequencyPenalty" type="number" step="0.1" min="-2" max="2" @update:model-value="value => aiStore.updateParameter('frequencyPenalty', value)" />
            </div>

            <div class="grid gap-2">
              <Label for="reasoningEffort">Reasoning Effort</Label>
              <select id="reasoningEffort" v-model="parameters.reasoningEffort" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                <option value="">
                  不发送
                </option>
                <option value="low">
                  low
                </option>
                <option value="medium">
                  medium
                </option>
                <option value="high">
                  high
                </option>
              </select>
            </div>
          </div>

          <div class="grid gap-2">
            <Label>系统提示词</Label>
            <Input v-model="presetWords[0]" placeholder="给聊天模型的 system prompt" />
          </div>

          <div class="grid gap-4 border rounded-md p-4">
            <div>
              <p class="font-medium">
                图像生成参数
              </p>
              <p class="text-muted-foreground text-xs">
                兼容 New API / OpenAI 图像端点；Gemini Imagen 会自动把尺寸映射为 aspectRatio、把质量映射为 imageSize。
              </p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2">
                <Label for="imageN">数量</Label>
                <Input id="imageN" :model-value="imageParameters.n" type="number" min="1" max="128" @update:model-value="value => aiStore.updateImageParameter('n', value)" />
              </div>
              <div class="grid gap-2">
                <Label for="imageSize">尺寸</Label>
                <select id="imageSize" v-model="imageParameters.size" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                  <option value="1024x1024">
                    1024x1024
                  </option>
                  <option value="1024x1792">
                    1024x1792
                  </option>
                  <option value="1792x1024">
                    1792x1024
                  </option>
                  <option value="1536x1024">
                    1536x1024
                  </option>
                  <option value="1024x1536">
                    1024x1536
                  </option>
                </select>
              </div>
              <div class="grid gap-2">
                <Label for="imageQuality">质量</Label>
                <select id="imageQuality" v-model="imageParameters.quality" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                  <option value="">
                    不发送
                  </option>
                  <option value="auto">
                    auto
                  </option>
                  <option value="standard">
                    standard
                  </option>
                  <option value="hd">
                    hd
                  </option>
                  <option value="low">
                    low
                  </option>
                  <option value="medium">
                    medium
                  </option>
                  <option value="high">
                    high
                  </option>
                </select>
              </div>
              <div class="grid gap-2">
                <Label for="imageResponseFormat">返回格式</Label>
                <select id="imageResponseFormat" v-model="imageParameters.responseFormat" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                  <option value="">
                    不发送
                  </option>
                  <option value="url">
                    url
                  </option>
                  <option value="b64_json">
                    b64_json
                  </option>
                </select>
              </div>
              <div class="grid gap-2">
                <Label for="imageBackground">背景</Label>
                <select id="imageBackground" v-model="imageParameters.background" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                  <option value="">
                    不发送
                  </option>
                  <option value="auto">
                    auto
                  </option>
                  <option value="transparent">
                    transparent
                  </option>
                  <option value="opaque">
                    opaque
                  </option>
                </select>
              </div>
              <div class="grid gap-2">
                <Label for="imageOutputFormat">输出格式</Label>
                <select id="imageOutputFormat" v-model="imageParameters.outputFormat" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                  <option value="">
                    不发送
                  </option>
                  <option value="png">
                    png
                  </option>
                  <option value="jpeg">
                    jpeg
                  </option>
                  <option value="webp">
                    webp
                  </option>
                </select>
              </div>
              <div class="grid gap-2">
                <Label for="imageOutputCompression">压缩质量</Label>
                <Input id="imageOutputCompression" :model-value="imageParameters.outputCompression" type="number" min="0" max="100" placeholder="jpeg/webp 可用" @update:model-value="value => aiStore.updateImageParameter('outputCompression', value)" />
              </div>
              <div class="grid gap-2">
                <Label for="imageInputFidelity">编辑保真度</Label>
                <select id="imageInputFidelity" v-model="imageParameters.inputFidelity" class="border-input bg-background h-10 w-full flex border rounded-md px-3 py-2 text-sm">
                  <option value="">
                    不发送
                  </option>
                  <option value="low">
                    low
                  </option>
                  <option value="high">
                    high
                  </option>
                </select>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="capabilities" class="grid gap-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div
              v-for="item in capabilityOverrideFields"
              :key="item.key"
              class="grid gap-3 border rounded-md p-4"
            >
              <p class="font-medium">
                {{ item.label }}
              </p>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="aiStore.capabilities[item.key].followConnectionProtocol"
                  @change="event => aiStore.updateCapabilitySetting(item.key, 'followConnectionProtocol', (event.target as HTMLInputElement).checked)"
                >
                跟随全局协议
              </label>
              <Input
                :model-value="aiStore.capabilities[item.key].model"
                placeholder="单独指定模型，可留空走默认"
                @update:model-value="value => aiStore.updateCapabilitySetting(item.key, 'model', String(value))"
              />
              <Input
                :model-value="aiStore.capabilities[item.key].endpoint"
                placeholder="单独指定端点，可留空走协议默认"
                @update:model-value="value => aiStore.updateCapabilitySetting(item.key, 'endpoint', String(value))"
              />
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="item in visibleCapabilityTests"
              :key="item.key"
              class="grid gap-2 border rounded-md p-4"
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-medium">
                    {{ item.label }}
                  </p>
                  <p class="text-muted-foreground break-all text-xs">
                    {{ resolveCapabilityTestEndpoint(item) }}
                  </p>
                </div>
                <Button variant="outline" :disabled="isTestingCapability[item.key]" @click="runCapabilityTest(item.key)">
                  {{ isTestingCapability[item.key] ? '测试中...' : '测试' }}
                </Button>
              </div>
              <p v-if="capabilityTestResults[item.key]" class="text-muted-foreground break-all text-xs">
                {{ capabilityTestResults[item.key] }}
              </p>
            </div>
          </div>

          <div v-if="connection.protocol === 'gemini-native'" class="grid gap-3 border rounded-md p-4">
            <p class="font-medium">
              Gemini 媒体识别
            </p>
            <Input :model-value="mediaPrompt" placeholder="描述任务，例如：请识别图片中的文字和主体" @update:model-value="value => mediaPrompt = String(value)" />
            <input type="file" accept="image/*" @change="handleMediaFileChange">
            <Button variant="outline" @click="runMediaRecognition">
              运行媒体识别
            </Button>
            <p v-if="mediaRecognitionResult" class="text-muted-foreground break-all text-xs">
              {{ mediaRecognitionResult }}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter class="flex justify-between">
        <Button variant="outline" @click="settingsDialogVisible = false">
          取消
        </Button>
        <Button @click="saveSettings">
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
