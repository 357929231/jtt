<script setup lang="ts">
import type { Template } from '@/templates'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bold, Code, Heading1, Heading2, Image, Italic, Link, List, ListOrdered, Quote, Strikethrough, Table } from 'lucide-vue-next'
import { marked } from 'marked'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  template: Template | null
}>()

const emit = defineEmits([`update:show`, `update:template`, `confirm`])

const editedContent = ref(``)
const editedName = ref(``)

// 当模板改变时更新编辑内容
watch(() => props.template, (newTemplate) => {
  if (newTemplate) {
    editedContent.value = newTemplate.content
    editedName.value = newTemplate.name
  }
}, { immediate: true })

// 预览HTML
const previewHtml = computed(() => {
  try {
    return marked.parse(editedContent.value)
  }
  catch (error) {
    console.error(`Markdown解析错误:`, error)
    return `预览内容解析失败`
  }
})

// 修改视图模式控制名称
const isEditableMode = ref(false)

interface EditableItem {
  text: string
  start: number
  end: number
  type: string
}

// 提取可编辑内容
const editableContent = computed(() => {
  if (!editedContent.value)
    return [] as EditableItem[]

  const patterns = [
    { regex: /^#+ (.+)$/gm, type: `标题` },
    { regex: /[\u4E00-\u9FA5][\u4E00-\u9FA5\s]*[\u4E00-\u9FA5]/g, type: `文本` },
    { regex: /\[([^\]]+)\]/g, type: `链接文本` },
    { regex: /!\[([^\]]+)\]/g, type: `图片描述` },
  ]

  const results: EditableItem[] = []
  patterns.forEach(({ regex, type }) => {
    const content = editedContent.value
    const regExp = new RegExp(regex)
    let match: RegExpExecArray | null = regExp.exec(content)

    while (match !== null) {
      const text = match[1] || match[0]
      if (!/^[\d,.\s]+$/.test(text)
        && !/^rgba?\(/.test(text)
        && !/^#[0-9a-f]{3,6}$/i.test(text)) {
        results.push({
          text,
          start: match.index + (match[1] ? match[0].indexOf(match[1]) : 0),
          end: match.index + (match[1] ? match[0].indexOf(match[1]) + match[1].length : match[0].length),
          type,
        })
      }
      match = regExp.exec(content)
    }
  })

  return results.sort((a, b) => a.start - b.start)
})

// 更新编辑内容
function updateEditableContent(index: number, newText: string) {
  const item = editableContent.value[index]
  if (!item)
    return

  const before = editedContent.value.slice(0, item.start)
  const after = editedContent.value.slice(item.end)
  editedContent.value = before + newText + after
}

// 工具栏按钮配置
const toolbarButtons = [
  { icon: Bold, title: `粗体`, action: () => insertText(`**粗体文本**`, 2, 4) },
  { icon: Italic, title: `斜体`, action: () => insertText(`*斜体文本*`, 1, 3) },
  { icon: Strikethrough, title: `删除线`, action: () => insertText(`~~删除线文本~~`, 2, 4) },
  { icon: Heading1, title: `一级标题`, action: () => insertText(`# 一级标题\n`, 2) },
  { icon: Heading2, title: `二级标题`, action: () => insertText(`## 二级标题\n`, 3) },
  { icon: List, title: `无序列表`, action: () => insertText(`- 列表项\n`, 2) },
  { icon: ListOrdered, title: `有序列表`, action: () => insertText(`1. 列表项\n`, 3) },
  { icon: Link, title: `链接`, action: () => insertText(`[链接文本](URL)`, 1, 5) },
  { icon: Image, title: `图片`, action: () => insertText(`![图片描述](图片URL)`, 2, 6) },
  { icon: Table, title: `表格`, action: insertTable },
  { icon: Code, title: `代码块`, action: () => insertText(`\`\`\`\n代码块\n\`\`\``, 4, 7) },
  { icon: Quote, title: `引用`, action: () => insertText(`> 引用文本\n`, 2) },
]

// 确认修改
function handleConfirm() {
  if (!props.template)
    return

  emit(`update:template`, {
    ...props.template,
    name: editedName.value,
    content: editedContent.value,
  })
  emit(`confirm`)
  emit(`update:show`, false)
}

// 在光标位置插入文本
function insertText(text: string, selectionStart = 0, selectionEnd = 0) {
  const textarea = document.querySelector(`textarea`)
  if (!textarea)
    return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const content = editedContent.value

  editedContent.value = content.substring(0, start) + text + content.substring(end)

  // 设置光标位置
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start + selectionStart, start + (selectionEnd || text.length))
  })
}

// 插入表格
function insertTable() {
  const tableTemplate = `
| 表头1 | 表头2 | 表头3 |
|-------|-------|-------|
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |
`
  insertText(tableTemplate)
}
</script>

<template>
  <Dialog :open="show" @update:open="$emit('update:show', $event)">
    <DialogContent class="max-w-[1000px] w-[90vw]">
      <DialogHeader>
        <DialogTitle>编辑模板</DialogTitle>
      </DialogHeader>

      <div class="grid gap-4">
        <!-- 模板名称 -->
        <div class="space-y-2">
          <label class="text-sm font-medium">模板名称</label>
          <Input v-model="editedName" placeholder="输入模板名称" />
        </div>

        <!-- 编辑和预览区域 -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- 编辑区域 -->
          <div class="space-y-2">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-1">
              <div class="flex flex-wrap items-center gap-1">
                <TooltipProvider>
                  <template v-for="button in toolbarButtons" :key="button.title">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-8 w-8 p-0"
                          @click="button.action"
                        >
                          <component :is="button.icon" class="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{{ button.title }}</p>
                      </TooltipContent>
                    </Tooltip>
                  </template>
                </TooltipProvider>
              </div>

              <!-- 添加视图切换按钮 -->
              <Button
                variant="outline"
                size="sm"
                class="h-8"
                @click="isEditableMode = !isEditableMode"
              >
                {{ isEditableMode ? '显示完整内容' : '只看修改内容' }}
              </Button>
            </div>

            <!-- 编辑器区域 -->
            <div class="relative">
              <textarea
                v-show="!isEditableMode"
                v-model="editedContent"
                class="bg-background text-foreground h-[400px] w-full border rounded-md p-2 text-sm font-mono"
                placeholder="输入模板内容..."
                @input="(e) => editedContent = (e.target as HTMLTextAreaElement).value"
              />
              <div
                v-show="isEditableMode"
                class="bg-background text-foreground h-[400px] w-full overflow-auto border rounded-md p-2 text-sm"
              >
                <div v-if="editableContent.length > 0" class="space-y-2">
                  <div
                    v-for="(item, index) in editableContent"
                    :key="index"
                    class="group hover:border-primary/50 relative border rounded p-2"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground text-xs">{{ item.type }}:</span>
                      <input
                        :value="item.text"
                        class="flex-1 bg-transparent outline-none"
                        @input="(e) => updateEditableContent(index, (e.target as HTMLInputElement).value)"
                      >
                    </div>
                    <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100">
                      <small class="text-muted-foreground text-xs">#{{ index + 1 }}</small>
                    </div>
                  </div>
                </div>
                <div v-else class="text-muted-foreground h-full flex items-center justify-center">
                  未找到可编辑内容
                </div>
              </div>
            </div>
          </div>

          <!-- 预览区域 -->
          <div class="space-y-2">
            <label class="text-sm font-medium">实时预览</label>
            <div
              class="h-[400px] w-full overflow-auto border rounded-md bg-white p-4 dark:bg-gray-800"
              v-html="previewHtml"
            />
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="$emit('update:show', false)">
            取消
          </Button>
          <Button @click="handleConfirm">
            确认修改
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.preview-content {
  max-height: 400px;
  overflow-y: auto;
}

/* 高亮中文字符 */
textarea {
  /* 使用正则表达式匹配中文字符并添加背景色 */
  -webkit-text-emphasis: dot;
  text-emphasis: dot;
  -webkit-text-emphasis-position: under left;
  text-emphasis-position: under left;
}

/* 中文字符特殊样式 */
textarea::-webkit-input-placeholder {
  color: rgba(var(--foreground), 0.5);
}

/* 确保暗色模式下中文字符清晰可见 */
.dark textarea {
  -webkit-text-emphasis-color: rgba(255, 255, 255, 0.7);
  text-emphasis-color: rgba(255, 255, 255, 0.7);
}

/* 亮色模式下中文字符样式 */
textarea {
  -webkit-text-emphasis-color: rgba(0, 0, 0, 0.7);
  text-emphasis-color: rgba(0, 0, 0, 0.7);
}

/* 移除之前的中文强调样式 */
textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

/* 中文内容视图样式 */
.chinese-text {
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  line-height: 1.6;
}

/* 可编辑内容样式 */
.editable-content input {
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  line-height: 1.6;
}

/* 移除之前的样式 */
textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
