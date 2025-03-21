<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/composables/useToast'
import { useStore } from '@/stores'
import { type Template, templates } from '@/templates'
import { useVirtualList } from '@vueuse/core'
import { BarChart, Code, Copy, Edit, FileText, Heading, Image, Layout, LayoutTemplate, Loader2, MessageSquare, Monitor, Plus, Search, Smartphone, Sparkles, Text, Type } from 'lucide-vue-next'
import { marked } from 'marked'
import { computed, ref, watch } from 'vue'
import TemplateEditor from './TemplateEditor.vue'

interface TemplateCategory {
  title: string
  items: Template[]
}

interface Templates {
  [key: string]: TemplateCategory
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits([`update:show`, `select`])

// 监听对话框状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    // 通知父组件隐藏控制按钮
    document.dispatchEvent(new CustomEvent(`dialog-state-change`, { detail: { isOpen: true } }))
  }
  else {
    document.dispatchEvent(new CustomEvent(`dialog-state-change`, { detail: { isOpen: false } }))
  }
})

const templatesData = templates as Templates

const store = useStore()
const activeTab = ref(`basic`)
const selectedTemplate = ref<Template | null>(null)
const searchQuery = ref(``)
const searchHistory = ref<string[]>([]) // 搜索历史
const recentTemplates = ref<Template[]>([]) // 最近使用的模板

const isLoading = ref(false)
const itemHeight = 100 // 每个模板项的高度

const showEditor = ref(false)
const editingTemplate = ref<Template | null>(null)

// 分词函数
function tokenize(text: string): string[] {
  // 将文本转换为小写并移除特殊字符
  const normalized = text.toLowerCase().replace(/[^\w\s\u4E00-\u9FA5]/g, ``)

  // 分词：按空格分割英文词，按字分割中文
  const tokens = normalized.split(``).reduce((acc, char) => {
    if (/[\u4E00-\u9FA5]/.test(char)) {
      // 中文字符，单独作为一个词
      acc.push(char)
    }
    else if (/\s/.test(char)) {
      // 空格，用于分割
      if (acc.length > 0 && !/\s/.test(acc[acc.length - 1])) {
        acc.push(` `)
      }
    }
    else {
      // 英文和数字，拼接到当前词
      if (acc.length === 0 || /\s/.test(acc[acc.length - 1])) {
        acc.push(char)
      }
      else {
        acc[acc.length - 1] += char
      }
    }
    return acc
  }, [] as string[])

  // 过滤空格并去重
  return [...new Set(tokens.filter(t => !/\s/.test(t)))]
}

// 计算两个字符串的相似度 (Levenshtein Distance)
function similarity(s1: string, s2: string): number {
  if (s1.length < s2.length)
    [s1, s2] = [s2, s1]

  // 创建距离矩阵
  const distances: number[][] = Array.from({ length: s2.length + 1 }, () =>
    Array.from({ length: s1.length + 1 }, () => 0))

  for (let i = 0; i <= s1.length; i++) distances[0][i] = i
  for (let j = 0; j <= s2.length; j++) distances[j][0] = j

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      if (s1[i - 1] === s2[j - 1]) {
        distances[j][i] = distances[j - 1][i - 1]
      }
      else {
        distances[j][i] = Math.min(
          distances[j - 1][i] + 1, // 删除
          distances[j][i - 1] + 1, // 插入
          distances[j - 1][i - 1] + 1, // 替换
        )
      }
    }
  }

  const maxLength = Math.max(s1.length, s2.length)
  return 1 - distances[s2.length][s1.length] / maxLength
}

// 计算推荐模板
const recommendedTemplates = computed(() => {
  if (!searchQuery.value && recentTemplates.value.length === 0)
    return []

  const currentTokens = tokenize(searchQuery.value)
  const historyTokens = searchHistory.value.flatMap(h => tokenize(h))

  // 获取所有模板
  const allTemplates = Object.values(templatesData).flatMap(category => category.items)

  // 计算每个模板的相关度分数
  const scoredTemplates = allTemplates.map((template) => {
    const nameTokens = tokenize(template.name)
    const contentTokens = tokenize(template.content)
    const templateTokens = [...nameTokens, ...contentTokens]

    // 计算相关度分数
    let score = 0

    // 当前搜索词的权重
    currentTokens.forEach((searchToken) => {
      templateTokens.forEach((token) => {
        const sim = similarity(searchToken, token)
        if (sim > 0.6) {
          score += sim * 2 // 当前搜索词权重加倍
        }
      })
    })

    // 历史搜索词的权重
    historyTokens.forEach((historyToken) => {
      templateTokens.forEach((token) => {
        const sim = similarity(historyToken, token)
        if (sim > 0.6) {
          score += sim
        }
      })
    })

    // 最近使用过的模板加分
    if (recentTemplates.value.some(t => t.name === template.name)) {
      score += 1
    }

    return { template, score }
  })

  // 按分数排序并返回前5个推荐
  return scoredTemplates
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.template)
})

// 记录搜索历史
watch(searchQuery, (newQuery) => {
  if (newQuery && !searchHistory.value.includes(newQuery)) {
    searchHistory.value = [newQuery, ...searchHistory.value].slice(0, 10)
  }
})

// 搜索过滤模板
const filteredTemplates = computed(() => {
  const result: Templates = {}

  // 如果没有搜索词，返回原始数据
  if (!searchQuery.value)
    return templatesData

  const searchTokens = tokenize(searchQuery.value)

  // 添加搜索结果
  Object.entries(templatesData).forEach(([key, category]) => {
    const filteredItems = category.items.filter((item) => {
      // 对模板名称和内容进行分词
      const nameTokens = tokenize(item.name)
      const contentTokens = tokenize(item.content)
      const allTokens = [...nameTokens, ...contentTokens]

      // 计算每个搜索词与模板词的最大相似度
      return searchTokens.every(searchToken =>
        allTokens.some((token) => {
          const sim = similarity(searchToken, token)
          return sim > 0.6 // 相似度阈值
        }),
      )
    })

    if (filteredItems.length > 0) {
      result[key] = {
        title: category.title,
        items: filteredItems,
      }
    }
  })

  // 添加推荐分类（仅在搜索时显示）
  if (recommendedTemplates.value.length > 0) {
    result.recommended = {
      title: `猜你喜欢`,
      items: recommendedTemplates.value,
    }
  }

  return result
})

// 自动切换到推荐分类（如果有）或第一个有结果的分类
watch([filteredTemplates, activeTab], ([templates, currentTab]) => {
  if (templates[currentTab] === undefined && Object.keys(templates).length > 0) {
    // 优先选择推荐分类
    if (templates.recommended) {
      activeTab.value = `recommended`
    }
    else {
      activeTab.value = Object.keys(templates)[0]
    }
  }
}, { immediate: true })

// 当前分类的模板列表
const currentCategoryTemplates = computed(() => {
  return filteredTemplates.value[activeTab.value]?.items || []
})

// 虚拟列表相关
const { list: virtualList, containerProps, wrapperProps } = useVirtualList(
  currentCategoryTemplates,
  {
    itemHeight,
    overscan: 5,
  },
)

// 监听搜索词变化，重置选中状态
watch(searchQuery, () => {
  selectedTemplate.value = null
  isLoading.value = false
})

// 计算预览 HTML
function enhancePreview(template: Template) {
  if (!template.content.includes(`<style>`)) {
    return template.content
  }

  // 为模板添加作用域前缀，避免样式冲突
  const scopeId = `template-${Date.now()}`
  const content = template.content.replace(/<style>/g, `<style scoped>`)

  // 为所有顶层元素添加作用域类名
  const wrapper = document.createElement(`div`)
  wrapper.innerHTML = content
  wrapper.querySelectorAll(`:scope > *:not(style)`).forEach((el) => {
    el.classList.add(scopeId)
  })

  // 更新样式选择器
  const styleTag = wrapper.querySelector(`style`)
  if (styleTag) {
    let cssText = styleTag.textContent || ``
    cssText = cssText.replace(/([^{}]+)\{/g, (match) => {
      return `.${scopeId} ${match}`
    })
    styleTag.textContent = cssText
  }

  return wrapper.innerHTML
}

const previewHtml = computed(() => {
  if (!selectedTemplate.value)
    return ``
  try {
    const content = enhancePreview(selectedTemplate.value)
    return marked.parse(content)
  }
  catch (error) {
    console.error(`Markdown解析错误:`, error)
    return `预览内容解析失败`
  }
})

// 记录使用过的模板
function handleTemplateSelect(template: Template) {
  selectedTemplate.value = template
  emit(`select`, template)

  // 更新最近使用的模板
  recentTemplates.value = [template, ...recentTemplates.value.filter(t => t.name !== template.name)].slice(0, 5)
}

// 处理模板悬停预览
function handleTemplateHover(template: Template) {
  if (!isLoading.value) {
    selectedTemplate.value = template
  }
}

// 插入模板内容
function insertTemplate() {
  if (!selectedTemplate.value || !store.editor)
    return

  const content = selectedTemplate.value.content
  store.editor.replaceSelection(content)
  emit(`update:show`, false)
  toast.success(`模板插入成功`)
}

// 获取分类图标
function getCategoryIcon(key: string): any {
  const icons: Record<string, any> = {
    recommended: Search,
    basic: Text,
    components: Layout,
    layouts: LayoutTemplate,
    animations: Sparkles,
    advanced: Code,
    wechat: MessageSquare,
    charts: BarChart,
    contentStyles: Type,
    titleStyles: Heading,
    imageContent: Image,
  }
  return icons[key] || FileText
}

// 在模板中使用时确保 key 是字符串
const getIconForKey = (key: string | number) => getCategoryIcon(String(key))

// 获取模板描述
function getTemplateDescription(template: Template) {
  // 从模板内容中提取第一段非空文本作为描述
  const firstParagraph = template.content
    .split(`\n`)
    .find(line => line.trim() && !line.startsWith(`#`))
  return firstParagraph?.trim() || `暂无描述`
}

// 复制模板内容
async function copyTemplate() {
  if (!selectedTemplate.value)
    return
  try {
    await navigator.clipboard.writeText(selectedTemplate.value.content)
    toast.success(`模板内容已复制到剪贴板`)
  }
  catch (error) {
    console.error(`复制失败:`, error)
    toast.error(`复制失败，请重试`)
  }
}

// 加载完整预览
async function loadFullPreview(template: Template) {
  isLoading.value = true
  try {
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    handleTemplateSelect(template)
  }
  catch (error) {
    console.error(`加载预览失败:`, error)
    toast.error(`预览加载失败，请重试`)
  }
  finally {
    isLoading.value = false
  }
}

// 添加实时响应式预览功能
const previewWidth = ref(`100%`)
const isResponsivePreview = ref(false)

function toggleResponsivePreview() {
  isResponsivePreview.value = !isResponsivePreview.value
  if (isResponsivePreview.value) {
    previewWidth.value = `375px` // 移动设备宽度
  }
  else {
    previewWidth.value = `100%`
  }
}

// 处理模板编辑
function handleTemplateEdit(template: Template) {
  editingTemplate.value = template
  showEditor.value = true
}

// 处理编辑完成
function handleEditComplete(template: Template) {
  // 更新模板内容
  const category = Object.entries(templatesData).find(([_, cat]) =>
    cat.items.some(item => item.name === template.name),
  )

  if (category) {
    const index = category[1].items.findIndex(item => item.name === template.name)
    if (index !== -1) {
      category[1].items[index] = template
    }
  }

  // 更新选中的模板
  selectedTemplate.value = template
}
</script>

<template>
  <Dialog :open="show" @update:open="$emit('update:show', $event)">
    <DialogContent class="max-w-[1100px] w-[90vw] p-2 md:p-4">
      <DialogHeader class="pb-1">
        <DialogTitle class="text-base md:text-lg">
          插入模板
        </DialogTitle>
        <div class="relative mt-1 md:mt-2">
          <Input
            v-model="searchQuery"
            placeholder="搜索模板..."
            class="h-7 w-full pl-7 text-sm md:h-8 md:pl-8"
          />
          <Search class="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 transform md:h-4 md:w-4 -translate-y-1/2" />
        </div>
      </DialogHeader>

      <div class="mt-1 flex flex-col gap-2 md:mt-2 md:gap-3">
        <!-- 分类和列表容器 -->
        <div class="flex flex-col gap-3 md:flex-row md:gap-4">
          <!-- 左侧分类列表 -->
          <Tabs v-model="activeTab" class="w-full md:w-[180px] md:border-r">
            <TabsList class="h-auto w-full flex-wrap justify-start bg-transparent md:h-[calc(70vh-8rem)] md:flex-col md:overflow-y-auto">
              <TabsTrigger
                v-for="(category, key) in filteredTemplates"
                :key="key"
                :value="key"
                class="data-[state=active]:bg-primary/10 flex-shrink-0 justify-start rounded px-2 py-1.5 text-left text-sm transition-all md:mb-1 md:w-full"
              >
                <div class="flex items-center gap-2">
                  <component
                    :is="getIconForKey(key)"
                    class="h-4 w-4"
                  />
                  <span class="truncate">{{ category.title }}</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <!-- 中间模板列表 -->
          <div class="w-full border-b md:w-[250px] md:border-b-0 md:border-r">
            <h3 class="text-muted-foreground mb-2 text-sm font-medium">
              {{ filteredTemplates[activeTab]?.title || '模板列表' }}
            </h3>
            <div
              v-bind="containerProps"
              class="custom-scrollbar h-[35vh] overflow-y-auto pr-2"
            >
              <div v-bind="wrapperProps">
                <!-- 推荐模板（仅在当前分类是推荐分类时显示） -->
                <div v-if="activeTab === 'recommended'" class="space-y-2">
                  <div
                    v-for="template in recommendedTemplates"
                    :key="template.name"
                    class="hover:bg-accent/50 cursor-pointer border rounded p-2 transition-all"
                    :class="{
                      'bg-primary/10 border-primary/30': selectedTemplate?.name === template.name,
                      'hover:border-primary/30': selectedTemplate?.name !== template.name,
                    }"
                    @mouseenter="handleTemplateHover(template)"
                    @click="loadFullPreview(template)"
                  >
                    <h4 class="mb-1 text-sm font-medium">
                      {{ template.name }}
                    </h4>
                    <p class="text-muted-foreground line-clamp-2 text-xs">
                      {{ getTemplateDescription(template) }}
                    </p>
                  </div>
                </div>

                <!-- 分类模板列表 -->
                <div v-else class="space-y-2">
                  <div
                    v-for="{ index, data: template } in virtualList"
                    :key="index"
                    class="hover:bg-accent/50 cursor-pointer border rounded p-2 transition-all"
                    :class="{
                      'bg-primary/10 border-primary/30': selectedTemplate?.name === template.name,
                      'hover:border-primary/30': selectedTemplate?.name !== template.name,
                    }"
                    @mouseenter="handleTemplateHover(template)"
                    @click="loadFullPreview(template)"
                  >
                    <h4 class="mb-1 text-sm font-medium">
                      {{ template.name }}
                    </h4>
                    <p class="text-muted-foreground line-clamp-2 text-xs">
                      {{ getTemplateDescription(template) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧预览区 -->
          <div class="flex-1 overflow-hidden">
            <div class="mb-1.5 flex items-center justify-between md:mb-2">
              <h3 class="text-muted-foreground text-sm font-medium">
                预览
              </h3>
              <div class="flex items-center gap-2">
                <Button
                  v-if="selectedTemplate"
                  variant="outline"
                  size="sm"
                  class="h-8 md:h-10"
                  @click="handleTemplateEdit(selectedTemplate)"
                >
                  <Edit class="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                  编辑模板
                </Button>
                <Button
                  v-if="selectedTemplate?.content.includes('<style>')"
                  variant="outline"
                  size="sm"
                  class="h-8 md:h-10"
                  @click="toggleResponsivePreview"
                >
                  <Smartphone v-if="isResponsivePreview" class="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                  <Monitor v-else class="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                  {{ isResponsivePreview ? '移动视图' : '桌面视图' }}
                </Button>
                <Button
                  v-if="selectedTemplate"
                  variant="outline"
                  size="sm"
                  class="h-8 md:h-10"
                  @click="copyTemplate"
                >
                  <Copy class="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                  复制模板
                </Button>
              </div>
            </div>
            <div
              class="preview-container h-[160px] overflow-y-auto border rounded-lg p-3 md:h-[35vh] md:p-4"
              :class="{ 'flex justify-center': isResponsivePreview }"
            >
              <div
                v-if="selectedTemplate && !isLoading"
                class="preview-content prose prose-sm md:prose-base dark:prose-invert max-w-none overflow-x-auto"
                :style="{ width: previewWidth, transition: 'width 0.3s ease' }"
                v-html="previewHtml"
              />
              <div v-else-if="isLoading" class="text-muted-foreground h-full flex items-center justify-center">
                <div class="text-center">
                  <Loader2 class="animate-spin mx-auto mb-3 h-8 w-8 opacity-50 md:mb-4 md:h-12 md:w-12" />
                  <p class="text-sm">
                    加载预览中...
                  </p>
                </div>
              </div>
              <div v-else class="text-muted-foreground h-full flex items-center justify-center">
                <div class="text-center">
                  <FileText class="mx-auto mb-3 h-8 w-8 opacity-50 md:mb-4 md:h-12 md:w-12" />
                  <p class="text-sm">
                    选择一个模板查看预览
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部按钮区域 -->
        <div class="flex items-center justify-between gap-3 border-t pt-3 md:gap-4 md:pt-4">
          <p class="text-muted-foreground text-xs md:text-sm">
            提示：选择一个模板快速创建专业的 Markdown 文档。
          </p>
          <div class="flex gap-2 md:gap-3">
            <Button
              variant="outline"
              size="sm"
              class="h-8 md:h-10"
              @click="$emit('update:show', false)"
            >
              取消
            </Button>
            <Button
              v-if="selectedTemplate"
              size="sm"
              class="h-8 md:h-10"
              @click="insertTemplate"
            >
              <Plus class="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
              插入模板
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- 模板编辑器 -->
  <TemplateEditor
    v-model:show="showEditor"
    v-model:template="editingTemplate"
    @confirm="handleEditComplete"
  />
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar) transparent;
  -webkit-overflow-scrolling: touch;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar);
  border-radius: 3px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-hover, var(--scrollbar));
}

/* 确保TabsList在移动端正确显示 */
@media (max-width: 768px) {
  :deep(.tabs-list) {
    flex-wrap: wrap;
    height: auto !important;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 8px;
  }
}

/* 确保分类列表在桌面端正确显示 */
@media (min-width: 769px) {
  :deep(.tabs-list) {
    display: flex;
    flex-direction: column;
    height: calc(70vh - 8rem);
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 8px;
  }
}

.prose {
  max-width: none;
}

.prose :deep(img) {
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}

:deep(.preview-table) {
  width: 100%;
  border-collapse: collapse;
}

:deep(.preview-table th),
:deep(.preview-table td) {
  border: 1px solid var(--border);
  padding: 0.5rem;
  text-align: left;
}

.preview-container {
  background: var(--background);
  transition: all 0.3s ease;
}

.preview-content {
  max-width: none;
  white-space: nowrap;
  overflow-x: auto;
}

.preview-content::-webkit-scrollbar {
  height: 6px;
}

.preview-content::-webkit-scrollbar-track {
  background: transparent;
}

.preview-content::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar);
  border-radius: 3px;
}

.preview-content:hover::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-hover, var(--scrollbar));
}

.preview-content > * {
  white-space: normal;
}

.preview-content pre,
.preview-content table {
  max-width: 100%;
  overflow-x: auto;
}

.dark .preview-content {
  color-scheme: dark;
}
</style>
