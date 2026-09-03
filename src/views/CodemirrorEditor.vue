<script setup lang="ts">
import type { MarkedOptions } from 'marked'
import type { ComponentPublicInstance } from 'vue'
import defaultMarkdown from '@/assets/example/markdown.md?raw'
import MarkdownTemplateDialog from '@/components/CodemirrorEditor/EditorHeader/MarkdownTemplateDialog.vue'
import RewriteDialog from '@/components/CodemirrorEditor/RewriteDialog.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { altKey, altSign, ctrlKey, shiftKey, shiftSign } from '@/config'
import { type AIStreamOptions, streamAIContent } from '@/services/ai'
import { useAIStore, useDisplayStore, useStore } from '@/stores'
import {
  checkImage,
  formatDoc,
  toBase64,
} from '@/utils'
import fileApi from '@/utils/file'
import { useThrottleFn } from '@vueuse/core'
import CodeMirror from 'codemirror'
import { BrainCircuit, Edit, Eye, LayoutTemplate, Sparkles, Trash2, Wand2 } from 'lucide-vue-next'
import { marked } from 'marked'
import 'highlight.js/styles/github.css'

const store = useStore()
const displayStore = useDisplayStore()
const aiStore = useAIStore()
const { isDark, output, editor, readingTime } = storeToRefs(store)

const {
  editorRefresh,
  exportEditorContent2HTML,
  exportEditorContent2MD,
  formatContent,
  importMarkdownContent,
  resetStyleConfirm,
} = store

const {
  toggleShowInsertFormDialog,
  toggleShowUploadImgDialog,
} = displayStore

// 添加状态
const showRewriteDialog = ref(false)
const rewriteSelection = ref(``)
const showTemplateDialog = ref(false)
const showControls = ref(true)
const isShowClearConfirmDialog = ref(false)
const imageActionPrompt = ref(``)
const imageActionFile = ref<{ base64: string, mimeType: string } | null>(null)
const isImageActionDialogOpen = ref(false)
const pendingImageAction = ref<`generate` | `edit` | `recognize` | ``>(``)

// 添加移动端视图控制
const isMobileView = ref(false)
const showPreview = ref(true)
const isTransitioning = ref(false)
const isEditorFocused = ref(false)
const preview = ref<HTMLDivElement | null>(null)
const tempContent = ref(``) // 添加临时存储变量
const touchStartX = ref(0)
const touchEndX = ref(0)
const MIN_SWIPE_DISTANCE = 50 // 最小滑动距离

// 添加触摸移动检测
const touchStartY = ref(0)
const lastTouchY = ref(0)
const MIN_SCROLL_DISTANCE = 10

// 配置 marked
const options: MarkedOptions = {
  breaks: true,
  gfm: true,
}
marked.setOptions(options)

// 添加滚动检测状态
const isScrolling = ref(false)
let scrollTimer: NodeJS.Timeout
let controlsTimer: NodeJS.Timeout

// 弹窗状态变化监听器
const dialogStateChangeHandler = ((event: CustomEvent) => {
  const { isOpen } = event.detail
  showControls.value = !isOpen
}) as EventListener

// 监听弹窗状态
watch(() => displayStore.isShowUploadImgDialog || displayStore.isShowInsertFormDialog || displayStore.isShowCssEditor || showTemplateDialog.value || showRewriteDialog.value || isShowClearConfirmDialog.value || aiStore.settingsDialogVisible, (isDialogOpen) => {
  if (isDialogOpen)
    showControls.value = false
  else
    showControls.value = true
})

// 添加性能优化相关的状态
const isPerformingAnimation = ref(false)

// 使用节流处理滚动
const throttledScroll = useThrottleFn(() => {
  if (isPerformingAnimation.value)
    return

  showControls.value = false
  clearTimeout(scrollTimer)
  clearTimeout(controlsTimer)

  scrollTimer = setTimeout(() => {
    isScrolling.value = false

    // 滚动停止2秒后显示控制按钮
    if (!isPerformingAnimation.value) {
      controlsTimer = setTimeout(() => {
        showControls.value = true
      }, 2000)
    }
  }, 150)
}, 100)

// 修改滚动处理函数
function handlePreviewScroll() {
  isScrolling.value = true
  throttledScroll()
}

// 检测移动端
function checkMobileView() {
  isMobileView.value = window.innerWidth <= 768
  if (isMobileView.value) {
    // 初始化时保存内容
    if (editor.value) {
      tempContent.value = editor.value.getValue()
    }
    // 在移动端默认显示编辑模式
    showPreview.value = false

    // 添加移动端特定的触摸事件处理
    const editorElement = document.querySelector(`.CodeMirror`)
    if (editorElement) {
      editorElement.addEventListener(`touchstart`, (_e) => {
        isEditorFocused.value = true
      })
      editorElement.addEventListener(`touchend`, (_e) => {
        setTimeout(() => {
          isEditorFocused.value = false
        }, 300)
      })
    }
  }
}

// 切换视图
async function toggleView(event?: Event) {
  // 判断是否是编辑器区域的点击
  const isEditorArea = event?.target instanceof HTMLElement
    && (event.target.closest(`.CodeMirror`) || event.target.classList.contains(`editor-area`))

  // 如果是在编辑器内容区域点击，且不是切换按钮，则不触发切换
  if (isEditorArea && !(event?.target instanceof HTMLElement && event.target.classList.contains(`toggle-btn`))) {
    return
  }

  // 如果正在输入（键盘弹出状态），不触发切换
  if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === `TEXTAREA`) {
    return
  }

  if (isTransitioning.value || isPerformingAnimation.value) {
    return
  }

  isTransitioning.value = true
  isPerformingAnimation.value = true
  showControls.value = false

  try {
    // 保存当前内容
    if (editor.value) {
      const content = editor.value.getValue()
      store.posts[store.currentPostIndex].content = content
      tempContent.value = content
    }

    // 切换显示状态
    showPreview.value = !showPreview.value
    await nextTick()

    if (!showPreview.value) {
      // 切换到编辑模式
      const editorDom = document.querySelector<HTMLTextAreaElement>(`#editor`)
      if (!editor.value && editorDom) {
        // 如果编辑器不存在，初始化它
        editorDom.value = tempContent.value || store.posts[store.currentPostIndex].content
        await initEditor()
      }
      else if (editor.value) {
        // 如果编辑器存在，刷新内容
        editor.value.setValue(tempContent.value || store.posts[store.currentPostIndex].content)
        editor.value.refresh()
        editor.value.focus()
      }
    }
    else {
      // 切换到预览模式
      await store.editorRefresh()
      await nextTick()

      // 移动端优化：滚动到顶部
      if (isMobileView.value && preview.value) {
        preview.value.scrollTop = 0
      }
    }
  }
  catch (error) {
    console.error(`视图切换错误:`, error)
    // 发生错误时恢复状态
    showPreview.value = !showPreview.value
  }
  finally {
    setTimeout(() => {
      isTransitioning.value = false
      isPerformingAnimation.value = false

      // 动画完成后显示控制按钮
      if (!isScrolling.value) {
        setTimeout(() => {
          showControls.value = true
        }, 500)
      }
    }, 300)
  }
}

// 监听窗口大小变化
onMounted(() => {
  checkMobileView()
  window.addEventListener(`resize`, checkMobileView)

  // 监听弹窗状态变化
  document.addEventListener(`dialog-state-change`, dialogStateChangeHandler)

  // 添加键盘事件监听
  if (isMobileView.value) {
    window.visualViewport?.addEventListener(`resize`, (_event) => {
      const isKeyboardVisible = window.visualViewport!.height < window.innerHeight
      if (isKeyboardVisible) {
        // 键盘弹出时，确保保持在编辑模式
        showPreview.value = false
        // 键盘弹出时隐藏控制按钮
        showControls.value = false
      }
      else {
        // 键盘收起时显示控制按钮
        showControls.value = true
      }
    })
  }

  // 初始化时保存内容
  nextTick(() => {
    if (editor.value) {
      tempContent.value = editor.value.getValue()
    }
  })

  const previewEl = document.getElementById(`preview`)
  if (previewEl) {
    previewEl.addEventListener(`scroll`, handlePreviewScroll)
  }
})

onUnmounted(() => {
  window.removeEventListener(`resize`, checkMobileView)

  // 移除弹窗状态变化监听
  document.removeEventListener(`dialog-state-change`, dialogStateChangeHandler)

  const previewEl = document.getElementById(`preview`)
  if (previewEl) {
    previewEl.removeEventListener(`scroll`, handlePreviewScroll)
  }
  clearTimeout(scrollTimer)
  clearTimeout(controlsTimer)
})

// 导入默认文章
function importDefaultMarkdown() {
  if (!editor.value)
    return

  try {
    // 获取当前内容
    const currentContent = editor.value.getValue()
    const cursor = editor.value.getCursor()

    // 计算插入位置的内容
    const beforeContent = currentContent.slice(0, editor.value.indexFromPos(cursor))
    const afterContent = currentContent.slice(editor.value.indexFromPos(cursor))

    // 组合新内容
    const newContent = beforeContent + defaultMarkdown + afterContent

    // 使用setValue设置全部内容
    editor.value.setValue(newContent)

    // 设置光标位置到插入内容之后
    const newCursorPos = editor.value.posFromIndex(beforeContent.length + defaultMarkdown.length)
    editor.value.setCursor(newCursorPos)

    // 刷新编辑器
    editorRefresh()
    // 重新聚焦
    editor.value.focus()

    // 显示成功提示
    toast.success(`默认文章导入成功`)
  }
  catch (error) {
    toast.error(`导入默认文章失败`)
    console.error(`Error importing default markdown:`, error)
  }
}

const isImgLoading = ref(false)
const timeout = ref<NodeJS.Timeout>()
const changeTimer = ref<NodeJS.Timeout>()

function previewScrollCB() {
  scrollCB(`preview`)
}

function editorScrollCB() {
  scrollCB(`editor`)
}

function scrollCB(text: string) {
  let source: HTMLElement
  let target: HTMLElement

  clearTimeout(timeout.value)
  if (text === `preview`) {
    source = preview.value!
    target = document.querySelector<HTMLElement>(`.CodeMirror-scroll`)!

    editor.value!.off(`scroll`, handleScroll)
    timeout.value = setTimeout(() => {
      editor.value!.on(`scroll`, handleScroll)
    }, 300)
  }
  else {
    source = document.querySelector<HTMLElement>(`.CodeMirror-scroll`)!
    target = preview.value!

    target.removeEventListener(`scroll`, previewScrollCB, false)
    timeout.value = setTimeout(() => {
      target.addEventListener(`scroll`, previewScrollCB, false)
    }, 300)
  }

  const percentage = source.scrollTop / (source.scrollHeight - source.offsetHeight)
  const height = percentage * (target.scrollHeight - target.offsetHeight)

  target.scrollTo(0, height)
}

async function handleChange(instance: CodeMirror.Editor, _changeObj: CodeMirror.EditorChange) {
  if (changeTimer.value) {
    clearTimeout(changeTimer.value)
  }

  changeTimer.value = setTimeout(async () => {
    try {
      const content = instance.getValue()
      store.posts[store.currentPostIndex].content = content

      // 强制更新预览内容
      await store.editorRefresh()
    }
    catch (error) {
      console.error(`更新预览内容时出错:`, error)
    }
  }, 300)
}

function handlePaste(_cm: CodeMirror.Editor, e: ClipboardEvent) {
  if (!(e.clipboardData && e.clipboardData.items) || isImgLoading.value) {
    return
  }
  for (let i = 0, len = e.clipboardData.items.length; i < len; ++i) {
    const item = e.clipboardData.items[i]
    if (item.kind === `file`) {
      const pasteFile = item.getAsFile()!
      const isValid = beforeUpload(pasteFile)
      if (!isValid) {
        continue
      }
      uploadImage(pasteFile)
    }
  }
}

function handleScroll(_instance: CodeMirror.Editor) {
  if (isMobileView.value) {
    isScrolling.value = true
    showControls.value = false

    clearTimeout(scrollTimer)
    clearTimeout(controlsTimer)

    scrollTimer = setTimeout(() => {
      isScrolling.value = false

      // 滚动停止2秒后显示控制按钮
      controlsTimer = setTimeout(() => {
        showControls.value = true
      }, 2000)
    }, 150)
  }
  editorScrollCB()
}

// 更新编辑器
function onEditorRefresh() {
  editorRefresh()
}

const backLight = ref(false)
const isCoping = ref(false)

function startCopy() {
  isCoping.value = true
  backLight.value = true
}

// 拷贝结束
function endCopy() {
  backLight.value = false
  setTimeout(() => {
    isCoping.value = false
  }, 800)
}

function beforeUpload(file: File) {
  // validate image
  const checkResult = checkImage(file)
  if (!checkResult.ok) {
    toast.error(checkResult.msg!)
    return false
  }

  // check image host
  const imgHost = localStorage.getItem(`imgHost`) || `default`
  localStorage.setItem(`imgHost`, imgHost)

  const config = localStorage.getItem(`${imgHost}Config`)
  const isValidHost = imgHost === `default` || config
  if (!isValidHost) {
    toast.error(`请先配置 ${imgHost} 图床参数`)
    return false
  }
  return true
}

// 图片上传结束
function uploaded(imageUrl: string) {
  if (!imageUrl) {
    toast.error(`上传图片未知异常`)
    return
  }
  toggleShowUploadImgDialog(false)
  // 上传成功，获取光标
  const cursor = editor.value!.getCursor()
  const markdownImage = `![](${imageUrl})`
  // 将 Markdown 形式的 URL 插入编辑框光标所在位置
  toRaw(store.editor!).replaceSelection(`\n${markdownImage}\n`, cursor as any)
  toast.success(`图片上传成功`)
}
function uploadImage(file: File, cb?: { (url: any): void, (arg0: unknown): void } | undefined) {
  isImgLoading.value = true

  toBase64(file)
    .then(base64Content => fileApi.fileUpload(base64Content, file))
    .then((url) => {
      if (cb) {
        cb(url)
      }
      else {
        uploaded(url)
      }
    })
    .catch((err) => {
      toast.error(err.message)
    })
    .finally(() => {
      isImgLoading.value = false
    })
}

async function readFileAsBase64(file: File) {
  return new Promise<{ base64: string, mimeType: string }>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === `string` ? reader.result : ``
      resolve({
        base64: result.split(`,`)[1] || ``,
        mimeType: file.type || `image/png`,
      })
    }
    reader.onerror = () => reject(new Error(`读取图片失败`))
    reader.readAsDataURL(file)
  })
}

async function chooseImageForAI() {
  return new Promise<{ base64: string, mimeType: string } | null>((resolve) => {
    const input = document.createElement(`input`)
    input.type = `file`
    input.accept = `image/*`
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      resolve(await readFileAsBase64(file))
    }
    input.click()
  })
}

async function generateImageWithAI() {
  imageActionPrompt.value = imageActionPrompt.value || `生成一张与文章内容匹配的配图`
  pendingImageAction.value = `generate`
  isImageActionDialogOpen.value = true
}

async function executeGenerateImageWithAI() {
  const payload = await aiStore.generateImage({ prompt: imageActionPrompt.value }) as any
  const image = payload.data?.[0]?.url || (payload.data?.[0]?.b64_json ? `data:image/png;base64,${payload.data[0].b64_json}` : ``)
  if (image) {
    uploaded(image)
  }
}

async function editImageWithAI() {
  const selected = await chooseImageForAI()
  if (!selected) {
    return
  }
  imageActionFile.value = selected
  imageActionPrompt.value = `优化这张图的视觉效果并保留主体`
  pendingImageAction.value = `edit`
  isImageActionDialogOpen.value = true
}

async function executeEditImageWithAI() {
  if (!imageActionFile.value) {
    return
  }
  const payload = await aiStore.editImage({
    prompt: imageActionPrompt.value,
    image: imageActionFile.value.base64,
    mimeType: imageActionFile.value.mimeType,
  }) as any
  const image = payload.data?.[0]?.url || (payload.data?.[0]?.b64_json ? `data:image/png;base64,${payload.data[0].b64_json}` : ``)
  if (image) {
    uploaded(image)
  }
}

async function recognizeImageWithAI() {
  const selected = await chooseImageForAI()
  if (!selected) {
    return
  }
  imageActionFile.value = selected
  imageActionPrompt.value = `请识别图片中的文字、主体和关键信息`
  pendingImageAction.value = `recognize`
  isImageActionDialogOpen.value = true
}

async function executeRecognizeImageWithAI() {
  if (!imageActionFile.value) {
    return
  }
  const payload = await aiStore.recognizeMedia({
    model: aiStore.getCapabilityModel(`mediaRecognition`) || aiStore.defaults.chatModel,
    inputText: imageActionPrompt.value,
    media: [{ mimeType: imageActionFile.value.mimeType, data: imageActionFile.value.base64 }],
  }) as any
  const text = payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join(``)
    || payload.choices?.[0]?.message?.content
    || ``
  if (text && editor.value) {
    editor.value.replaceSelection(`\n${text}\n`)
  }
}

async function confirmImageAction() {
  try {
    if (pendingImageAction.value === `generate`) {
      await executeGenerateImageWithAI()
    }
    else if (pendingImageAction.value === `edit`) {
      await executeEditImageWithAI()
    }
    else if (pendingImageAction.value === `recognize`) {
      await executeRecognizeImageWithAI()
    }
  }
  finally {
    isImageActionDialogOpen.value = false
    pendingImageAction.value = ``
  }
}

// 监听暗色模式并更新编辑器
watch(isDark, () => {
  const theme = isDark.value ? `darcula` : `xq-light`
  toRaw(editor.value)?.setOption?.(`theme`, theme)
})

// 初始化编辑器
function initEditor() {
  const editorDom = document.querySelector<HTMLTextAreaElement>(`#editor`)
  if (!editorDom) {
    console.warn(`找不到编辑器DOM元素`)
    return
  }

  // 确保清理旧的编辑器实例
  if (editor.value) {
    try {
      // 保存当前内容
      const content = editor.value.getValue()
      store.posts[store.currentPostIndex].content = content

      // 移除所有事件监听器
      editor.value.off(`change`, handleChange)
      editor.value.off(`paste`, handlePaste)
      editor.value.off(`scroll`, handleScroll)

      // 清理DOM
      const wrapper = editor.value.getWrapperElement()
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper)
      }

      // 清空引用
      editor.value = null
    }
    catch (err) {
      console.error(`清理编辑器失败:`, err)
    }
  }

  // 设置初始内容
  if (!editorDom.value) {
    editorDom.value = store.posts[store.currentPostIndex].content
  }

  // 创建新的编辑器实例
  editor.value = markRaw(CodeMirror.fromTextArea(editorDom, {
    mode: `text/x-markdown`,
    theme: isDark.value ? `darcula` : `xq-light`,
    lineNumbers: false,
    lineWrapping: true,
    styleActiveLine: true,
    autoCloseBrackets: true,
    viewportMargin: Infinity,
    autofocus: true,
    dragDrop: false,
    inputStyle: isMobileView.value ? `textarea` : `contenteditable`,
    spellcheck: false,
    value: store.posts[store.currentPostIndex].content,
    extraKeys: {
      [`${shiftKey}-${altKey}-F`]: function autoFormat(editor) {
        formatDoc(editor.getValue()).then((doc) => {
          editor.setValue(doc)
        })
      },
      [`${ctrlKey}-B`]: function bold(editor) {
        const selected = editor.getSelection()
        editor.replaceSelection(`**${selected}**`)
      },
      [`${ctrlKey}-I`]: function italic(editor) {
        const selected = editor.getSelection()
        editor.replaceSelection(`*${selected}*`)
      },
      [`${ctrlKey}-D`]: function del(editor) {
        const selected = editor.getSelection()
        editor.replaceSelection(`~~${selected}~~`)
      },
      [`${ctrlKey}-K`]: function italic(editor) {
        const selected = editor.getSelection()
        editor.replaceSelection(`[${selected}]()`)
      },
      [`${ctrlKey}-E`]: function code(editor) {
        const selected = editor.getSelection()
        editor.replaceSelection(`\`${selected}\``)
      },
    },
  }))

  // 添加移动端触摸事件处理
  if (isMobileView.value) {
    const editorWrapper = editor.value.getWrapperElement()
    let touchStartTime = 0
    let hasMoved = false

    editorWrapper.addEventListener(`touchstart`, (e: TouchEvent) => {
      isEditorFocused.value = true
      touchStartTime = Date.now()
      hasMoved = false

      // 获取触摸位置的坐标
      const touch = e.touches[0]
      const pos = editor.value!.coordsChar({
        left: touch.clientX,
        top: touch.clientY,
      })

      // 获取当前行的内容
      const line = editor.value!.getLine(pos.line)
      if (!line?.trim())
        return // 如果是空行则不处理

      // 设置选区为当前行
      editor.value!.setSelection(
        { line: pos.line, ch: 0 },
        { line: pos.line, ch: line.length },
      )
    })

    editorWrapper.addEventListener(`touchmove`, () => {
      hasMoved = true
    })

    editorWrapper.addEventListener(`touchend`, (_e: TouchEvent) => {
      const touchDuration = Date.now() - touchStartTime

      // 如果触摸时间短且没有移动，保持选区
      if (touchDuration < 300 && !hasMoved) {
        // 保持选区
      }
      else {
        // 延迟清除选区状态，以便有时间触发操作
        setTimeout(() => {
          isEditorFocused.value = false
        }, 300)
      }
    })
  }

  // 确保编辑器已经完全初始化后再添加事件监听
  nextTick(() => {
    if (!editor.value)
      return

    // 添加事件监听器
    editor.value.on(`change`, handleChange)
    editor.value.on(`paste`, handlePaste)
    editor.value.on(`scroll`, handleScroll)

    // 刷新编辑器
    editor.value.refresh()
    editor.value.focus()
  })
}

// 组件卸载时的清理
onBeforeUnmount(() => {
  if (editor.value) {
    try {
      // 保存最后的内容
      const content = editor.value.getValue()
      store.posts[store.currentPostIndex].content = content

      // 移除所有事件监听器
      editor.value.off(`change`, handleChange)
      editor.value.off(`paste`, handlePaste)
      editor.value.off(`scroll`, handleScroll)

      // 移除DOM元素
      const wrapper = editor.value.getWrapperElement()
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper)
      }

      // 清空引用
      editor.value = null
    }
    catch (err) {
      console.error(`清理编辑器失败:`, err)
    }
  }

  // 清理定时器
  if (changeTimer.value) {
    clearTimeout(changeTimer.value)
  }

  // 移除键盘事件监听
  window.removeEventListener(`keydown`, handleKeyDown)
})

// 修改组件挂载逻辑
onMounted(() => {
  nextTick(() => {
    initEditor()
    onEditorRefresh()
    mdLocalToRemote()
    window.addEventListener(`keydown`, handleKeyDown)

    // 延迟设置滚动同步
    setTimeout(() => {
      if (preview.value && editor.value) {
        preview.value.addEventListener(`scroll`, previewScrollCB, false)
        editor.value.on(`scroll`, handleScroll)
      }
    }, 300)
  })
})

const container = ref(null)

// 工具函数，添加格式
function addFormat(cmd: string) {
  const editorInstance = editor.value
  if (!editorInstance)
    return

  // 使用类型断言访问 extraKeys
  const extraKeys = (editorInstance as any).options?.extraKeys
  if (!extraKeys?.[cmd])
    return

  try {
    extraKeys[cmd](editorInstance)
  }
  catch (error) {
    console.error(`执行格式化命令失败:`, error)
  }
}

const codeMirrorWrapper = ref<ComponentPublicInstance<HTMLDivElement> | null>(null)

// 转换 markdown 中的本地图片为线上图片
// todo 处理事件覆盖
function mdLocalToRemote() {
  const dom = codeMirrorWrapper.value!

  // 上传 md 中的图片
  const uploadMdImg = async ({ md, list }: { md: { str: string, path: string, file: File }, list: { path: string, file: File }[] }) => {
    const mdImgList = [
      ...(md.str.matchAll(/!\[(.*?)\]\((.*?)\)/g) || []),
    ].filter((item) => {
      return item // 获取所有相对地址的图片
    })
    const root = md.path.match(/.+?\//)![0]
    const resList = await Promise.all<{ matchStr: string, url: string }>(
      mdImgList.map((item) => {
        return new Promise((resolve) => {
          let [, , matchStr] = item
          matchStr = matchStr.replace(/^.\//, ``) // 处理 ./img/ 为 img/ 统一相对路径风格
          const { file }
            = list.find(f => f.path === `${root}${matchStr}`) || {}
          uploadImage(file!, (url) => {
            resolve({ matchStr, url })
          })
        })
      }),
    )
    resList.forEach((item) => {
      md.str = md.str
        .replace(`](./${item.matchStr})`, `](${item.url})`)
        .replace(`](${item.matchStr})`, `](${item.url})`)
    })
    editor.value!.setValue(md.str)
  }

  dom.ondragover = evt => evt.preventDefault()
  dom.ondrop = async (evt: any) => {
    evt.preventDefault()
    for (const item of evt.dataTransfer.items) {
      item.getAsFileSystemHandle().then(async (handle: { kind: string, getFile: () => any }) => {
        if (handle.kind === `directory`) {
          const list = await showFileStructure(handle) as { path: string, file: File }[]
          const md = await getMd({ list })
          uploadMdImg({ md, list })
        }
        else {
          const file = await handle.getFile()
          console.log(`file`, file)
        }
      })
    }
  }

  // 从文件列表中查找一个 md 文件并解析
  async function getMd({ list }: { list: { path: string, file: File }[] }) {
    return new Promise<{ str: string, file: File, path: string }>((resolve) => {
      const { path, file } = list.find(item => item.path.match(/\.md$/))!
      const reader = new FileReader()
      reader.readAsText(file!, `UTF-8`)
      reader.onload = (evt) => {
        resolve({
          str: evt.target!.result as string,
          file,
          path,
        })
      }
    })
  }

  // 转换文件系统句柄中的文件为文件列表
  async function showFileStructure(root: any) {
    const result = []
    let cwd = ``
    try {
      const dirs = [root]
      for (const dir of dirs) {
        cwd += `${dir.name}/`
        for await (const [, handle] of dir) {
          if (handle.kind === `file`) {
            result.push({
              path: cwd + handle.name,
              file: await handle.getFile(),
            })
          }
          else {
            result.push({
              path: `${cwd + handle.name}/`,
            })
            dirs.push(handle)
          }
        }
      }
    }
    catch (err) {
      console.error(err)
    }
    return result
  }
}

// 添加 AI 继续编写功能
async function continueWithAI() {
  if (!editor.value)
    return

  let selection = editor.value.getSelection()
  if (!selection) {
    // 如果没有选区，尝试获取当前光标所在的段落
    const cursor = editor.value.getCursor()
    const line = editor.value.getLine(cursor.line)
    if (!line?.trim()) {
      toast.error(`请先选择一段文本`)
      return
    }

    // 向上查找段落起始
    let startLine = cursor.line
    while (startLine > 0) {
      const prevLine = editor.value.getLine(startLine - 1)
      if (!prevLine || !prevLine.trim())
        break
      startLine--
    }

    // 向下查找段落结束
    let endLine = cursor.line
    const totalLines = editor.value.lineCount()
    while (endLine < totalLines - 1) {
      const nextLine = editor.value.getLine(endLine + 1)
      if (!nextLine || !nextLine.trim())
        break
      endLine++
    }

    // 设置选区
    editor.value.setSelection(
      { line: startLine, ch: 0 },
      { line: endLine, ch: editor.value.getLine(endLine).length },
    )
    selection = editor.value.getSelection()
  }

  try {
    const prompt = `请继续编写以下内容：\n${selection}`
    const cursor = editor.value.getCursor()

    // 在当前行末尾添加换行和标记
    editor.value.replaceRange(`\n\n---\n【以下是AI继续编写的版本】：\n\n`, { line: cursor.line, ch: editor.value.getLine(cursor.line).length })

    // 更新光标位置到新行
    const newPosition = {
      line: cursor.line + 5, // 跳过分隔线和标记
      ch: 0,
    }
    editor.value.setCursor(newPosition)

    // 使用streamAIContent来实现流式输出
    let hasGeneratedContent = false
    streamAIContent({
      prompt,
      onToken: (token: string) => {
        hasGeneratedContent = true
        // 每收到一个token就立即更新编辑器
        editor.value?.replaceRange(token, newPosition)
        // 更新插入位置
        const lines = token.split(`\n`)
        if (lines.length > 1) {
          // 如果token包含换行符，需要更新行号
          newPosition.line += lines.length - 1
          newPosition.ch = lines[lines.length - 1].length
        }
        else {
          // 如果是同一行，只需要更新字符位置
          newPosition.ch += token.length
        }
      },
      onError: (error: Error) => {
        toast.error(error.message)
        if (!hasGeneratedContent) {
          const fallbackText = `\n【AI 续写失败：${error.message}】\n请在 AI 提供商设置中切换到当前 Key 可用的模型后重试。\n`
          editor.value?.replaceRange(fallbackText, newPosition)
        }
      },
      onFinish: () => {
        // 完成后添加完成标记
        if (hasGeneratedContent) {
          editor.value?.replaceRange(`\n\n【内容编写完成】\n`, newPosition)
        }
      },
    } satisfies AIStreamOptions)
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : `生成内容时出错`)
  }
}

// 添加 AI 优化表达功能
async function optimizeWithAI() {
  if (!editor.value)
    return

  let selection = editor.value.getSelection()
  if (!selection) {
    // 如果没有选区，尝试获取当前光标所在的段落
    const cursor = editor.value.getCursor()
    const line = editor.value.getLine(cursor.line)
    if (!line?.trim()) {
      toast.error(`请先选择一段文本`)
      return
    }

    // 向上查找段落起始
    let startLine = cursor.line
    while (startLine > 0) {
      const prevLine = editor.value.getLine(startLine - 1)
      if (!prevLine || !prevLine.trim())
        break
      startLine--
    }

    // 向下查找段落结束
    let endLine = cursor.line
    const totalLines = editor.value.lineCount()
    while (endLine < totalLines - 1) {
      const nextLine = editor.value.getLine(endLine + 1)
      if (!nextLine || !nextLine.trim())
        break
      endLine++
    }

    // 设置选区
    editor.value.setSelection(
      { line: startLine, ch: 0 },
      { line: endLine, ch: editor.value.getLine(endLine).length },
    )
    selection = editor.value.getSelection()
  }

  try {
    // 分段处理长文本
    const maxChunkLength = 2000
    const text = selection

    // 首先按段落分割
    const paragraphs = text.split(/\n\s*\n/)
    const chunks: string[] = []

    let currentChunk = ``
    let currentLength = 0

    // 智能分段处理
    for (const paragraph of paragraphs) {
      const paragraphLength = paragraph.length

      // 如果当前段落本身就超过最大长度
      if (paragraphLength > maxChunkLength) {
        // 如果当前chunk不为空，先保存
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = ``
          currentLength = 0
        }

        // 按句子分割长段落
        const sentences = paragraph.split(/([。！？.!?]+)/).filter(Boolean)
        let tempChunk = ``
        let tempLength = 0

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i]
          const sentenceLength = sentence.length

          if (tempLength + sentenceLength > maxChunkLength) {
            if (tempChunk) {
              chunks.push(tempChunk.trim())
              tempChunk = sentence
              tempLength = sentenceLength
            }
            else {
              // 如果单个句子超过最大长度，强制分割
              const forcedChunks = sentence.match(new RegExp(`.{1,${maxChunkLength}}`, `g`)) || []
              chunks.push(...forcedChunks.map(chunk => chunk.trim()))
            }
          }
          else {
            tempChunk += sentence
            tempLength += sentenceLength
          }
        }

        if (tempChunk) {
          currentChunk = tempChunk
          currentLength = tempLength
        }
      }
      // 如果添加当前段落会超过最大长度
      else if (currentLength + paragraphLength + 2 > maxChunkLength) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph
        currentLength = paragraphLength
      }
      // 可以将段落添加到当前chunk
      else {
        currentChunk += (currentChunk ? `\n\n` : ``) + paragraph
        currentLength += paragraphLength + 2
      }
    }

    // 保存最后一个chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    const endCursor = editor.value.getCursor(`to`)
    // 在原文后插入分隔线和说明
    editor.value!.replaceRange(`\n\n---\n【以下是AI优化的版本】：\n\n`, endCursor)

    // 更新插入位置到新行
    const currentPosition = {
      line: endCursor.line + 5, // 跳过分隔线和说明
      ch: 0,
    }

    // 逐段处理并添加进度提示
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const isLastChunk = i === chunks.length - 1

      // 添加进度提示
      if (chunks.length > 1) {
        const progressText = `\n【正在处理第 ${i + 1}/${chunks.length} 段...】\n\n`
        editor.value!.replaceRange(progressText, currentPosition)
        currentPosition.line += 3
      }

      const prompt = `请优化以下文本的表达，要求：
1. 使其更加专业、流畅
2. 保持原文的核心意思不变
3. 调整段落组织，使逻辑更加清晰
4. 增加必要的过渡词，提高文章连贯性
${chunks.length > 1 ? `5. 这是分段处理的第 ${i + 1}/${chunks.length} 段，请确保优化后的内容与其他段落保持连贯性和过渡性` : ``}

原文内容：
${chunk}`

      // 添加重试机制
      let retryCount = 0
      const maxRetries = 3
      let lastError: Error | null = null

      while (retryCount < maxRetries) {
        try {
          await new Promise<void>((resolve, reject) => {
            let hasStartedResponse = false

            streamAIContent({
              prompt,
              onToken: (token: string) => {
                hasStartedResponse = true
                editor.value?.replaceRange(token, currentPosition)
                const lines = token.split(`\n`)
                if (lines.length > 1) {
                  currentPosition.line += lines.length - 1
                  currentPosition.ch = lines[lines.length - 1].length
                }
                else {
                  currentPosition.ch += token.length
                }
              },
              onError: (error: Error) => {
                // 如果已经开始接收响应，则认为是成功的
                if (hasStartedResponse) {
                  resolve()
                }
                else {
                  reject(error)
                }
              },
              onFinish: () => {
                if (!isLastChunk) {
                  editor.value?.replaceRange(`\n\n`, currentPosition)
                  currentPosition.line += 2
                  currentPosition.ch = 0
                }
                resolve()
              },
            } satisfies AIStreamOptions)
          })

          // 如果成功处理，跳出重试循环
          break
        }
        catch (error) {
          lastError = error as Error
          retryCount++

          // 如果还有重试机会，添加重试提示
          if (retryCount < maxRetries) {
            const retryText = `\n【请求失败，正在进行第 ${retryCount + 1} 次重试...】\n`
            editor.value!.replaceRange(retryText, currentPosition)
            currentPosition.line += 2
            currentPosition.ch = 0

            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount))
          }
        }
      }

      // 如果所有重试都失败了
      if (retryCount === maxRetries && lastError) {
        throw new Error(`处理失败，已重试 ${maxRetries} 次：${lastError.message}`)
      }

      // 如果不是最后一段，删除进度提示
      if (!isLastChunk && chunks.length > 1) {
        const progressLineStart = currentPosition.line - 3
        editor.value!.replaceRange(``, { line: progressLineStart, ch: 0 }, { line: progressLineStart + 1, ch: 0 },
        )
        currentPosition.line -= 1
      }
    }

    // 处理完成后的提示
    editor.value!.replaceRange(`\n\n【内容优化完成】\n`, currentPosition)
  }
  catch (error) {
    // 添加更详细的错误信息
    console.error(`优化失败:`, error)
    const errorMessage = error instanceof Error
      ? `优化失败: ${error.message}`
      : `优化内容时出错`
    toast.error(errorMessage)

    // 添加恢复提示
    if (editor.value) {
      const cursor = editor.value.getCursor()
      editor.value.replaceRange(`\n\n【处理失败，请重试或减少文本长度】\n`, cursor)
    }
  }
}

// 添加 AI 伪原创功能
async function rewriteWithAI() {
  if (!editor.value)
    return

  let selection = editor.value.getSelection()
  if (!selection) {
    // 如果没有选区，尝试获取当前光标所在的段落
    const cursor = editor.value.getCursor()
    const line = editor.value.getLine(cursor.line)
    if (!line?.trim()) {
      toast.error(`请先选择一段文本`)
      return
    }

    // 向上查找段落起始
    let startLine = cursor.line
    while (startLine > 0) {
      const prevLine = editor.value.getLine(startLine - 1)
      if (!prevLine || !prevLine.trim())
        break
      startLine--
    }

    // 向下查找段落结束
    let endLine = cursor.line
    const totalLines = editor.value.lineCount()
    while (endLine < totalLines - 1) {
      const nextLine = editor.value.getLine(endLine + 1)
      if (!nextLine || !nextLine.trim())
        break
      endLine++
    }

    // 设置选区
    editor.value.setSelection(
      { line: startLine, ch: 0 },
      { line: endLine, ch: editor.value.getLine(endLine).length },
    )
    selection = editor.value.getSelection()
  }

  // 保存选中的文本并显示设置对话框
  rewriteSelection.value = selection
  showRewriteDialog.value = true
}

interface RewriteConfig {
  level: string
  styles: string[]
  retains: string[]
  extras: string[]
}

async function handleRewriteConfirm(config: RewriteConfig) {
  try {
    const stylePrompts = {
      academic: `使用学术性的语言和表达方式，包含专业术语，保持严谨的学术风格`,
      news: `采用新闻报道的写作方式，客观陈述，突出重点信息`,
      popular: `使用通俗易懂的语言，适当增加比喻和例子，让内容更容易理解`,
    }

    const levelPrompts = {
      low: `轻微改写，保持大部分原文内容`,
      medium: `中度改写，保持核心内容`,
      high: `深度改写，只保留主要观点`,
    }

    // 分段处理长文本
    const maxChunkLength = 2000 // 增加每段最大字符数
    const text = rewriteSelection.value

    // 首先按段落分割
    const paragraphs = text.split(/\n\s*\n/)
    const chunks: string[] = []

    let currentChunk = ``
    let currentLength = 0

    // 智能分段处理
    for (const paragraph of paragraphs) {
      const paragraphLength = paragraph.length

      // 如果当前段落本身就超过最大长度
      if (paragraphLength > maxChunkLength) {
        // 如果当前chunk不为空，先保存
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = ``
          currentLength = 0
        }

        // 按句子分割长段落
        const sentences = paragraph.split(/([。！？.!?]+)/).filter(Boolean)
        let tempChunk = ``
        let tempLength = 0

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i]
          const sentenceLength = sentence.length

          if (tempLength + sentenceLength > maxChunkLength) {
            if (tempChunk) {
              chunks.push(tempChunk.trim())
              tempChunk = sentence
              tempLength = sentenceLength
            }
            else {
              // 如果单个句子超过最大长度，强制分割
              const forcedChunks = sentence.match(new RegExp(`.{1,${maxChunkLength}}`, `g`)) || []
              chunks.push(...forcedChunks.map(chunk => chunk.trim()))
            }
          }
          else {
            tempChunk += sentence
            tempLength += sentenceLength
          }
        }

        if (tempChunk) {
          currentChunk = tempChunk
          currentLength = tempLength
        }
      }
      // 如果添加当前段落会超过最大长度
      else if (currentLength + paragraphLength + 2 > maxChunkLength) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph
        currentLength = paragraphLength
      }
      // 可以将段落添加到当前chunk
      else {
        currentChunk += (currentChunk ? `\n\n` : ``) + paragraph
        currentLength += paragraphLength + 2
      }
    }

    // 保存最后一个chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    const endCursor = editor.value!.getCursor(`to`)
    // 在原文后插入分隔线和说明
    editor.value!.replaceRange(`\n\n---\n【以下是AI改写的版本】：\n\n`, endCursor)

    // 更新插入位置到新行
    const currentPosition = {
      line: endCursor.line + 5, // 跳过分隔线和说明
      ch: 0,
    }

    // 逐段处理并添加进度提示
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const isLastChunk = i === chunks.length - 1

      // 添加进度提示
      if (chunks.length > 1) {
        const progressText = `\n【正在处理第 ${i + 1}/${chunks.length} 段...】\n\n`
        editor.value!.replaceRange(progressText, currentPosition)
        currentPosition.line += 3
      }

      const prompt = `请对以下内容进行改写，要求：
1. ${config.styles.map(style => stylePrompts[style as keyof typeof stylePrompts]).join(`\n`)}
2. ${levelPrompts[config.level as keyof typeof levelPrompts]}
3. 保持原文的核心意思不变
4. 调整段落组织，但确保逻辑连贯
${config.retains.length > 0 ? `5. 保留以下内容：${config.retains.join(`、`)}` : ``}
${config.extras.length > 0 ? `6. 额外要求：${config.extras.join(`、`)}` : ``}
${chunks.length > 1 ? `7. 这是分段处理的第 ${i + 1}/${chunks.length} 段，请确保改写后的内容与其他段落保持连贯性和过渡性` : ``}

原文内容：
${chunk}`

      // 添加重试机制
      let retryCount = 0
      const maxRetries = 3
      let lastError: Error | null = null

      while (retryCount < maxRetries) {
        try {
          await new Promise<void>((resolve, reject) => {
            let hasStartedResponse = false

            streamAIContent({
              prompt,
              onToken: (token: string) => {
                hasStartedResponse = true
                editor.value?.replaceRange(token, currentPosition)
                const lines = token.split(`\n`)
                if (lines.length > 1) {
                  currentPosition.line += lines.length - 1
                  currentPosition.ch = lines[lines.length - 1].length
                }
                else {
                  currentPosition.ch += token.length
                }
              },
              onError: (error: Error) => {
                // 如果已经开始接收响应，则认为是成功的
                if (hasStartedResponse) {
                  resolve()
                }
                else {
                  reject(error)
                }
              },
              onFinish: () => {
                if (!isLastChunk) {
                  editor.value?.replaceRange(`\n\n`, currentPosition)
                  currentPosition.line += 2
                  currentPosition.ch = 0
                }
                resolve()
              },
            } satisfies AIStreamOptions)
          })

          // 如果成功处理，跳出重试循环
          break
        }
        catch (error) {
          lastError = error as Error
          retryCount++

          // 如果还有重试机会，添加重试提示
          if (retryCount < maxRetries) {
            const retryText = `\n【请求失败，正在进行第 ${retryCount + 1} 次重试...】\n`
            editor.value!.replaceRange(retryText, currentPosition)
            currentPosition.line += 2
            currentPosition.ch = 0

            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount))
          }
        }
      }

      // 如果所有重试都失败了
      if (retryCount === maxRetries && lastError) {
        throw new Error(`处理失败，已重试 ${maxRetries} 次：${lastError.message}`)
      }

      // 如果不是最后一段，删除进度提示
      if (!isLastChunk && chunks.length > 1) {
        const progressLineStart = currentPosition.line - 3
        editor.value!.replaceRange(``, { line: progressLineStart, ch: 0 }, { line: progressLineStart + 1, ch: 0 },
        )
        currentPosition.line -= 1
      }
    }

    // 处理完成后的提示
    editor.value!.replaceRange(`\n\n【内容改写完成】\n`, currentPosition)
  }
  catch (error) {
    // 添加更详细的错误信息
    console.error(`改写失败:`, error)
    const errorMessage = error instanceof Error
      ? `改写失败: ${error.message}`
      : `改写内容时出错`
    toast.error(errorMessage)

    // 添加恢复提示
    if (editor.value) {
      const cursor = editor.value.getCursor()
      editor.value.replaceRange(`\n\n【处理失败，请重试或减少文本长度】\n`, cursor)
    }
  }
}

// 在需要保存的地方，使用 getValue 替代 save
function handleSave() {
  if (!editor.value)
    return
  const content = editor.value.getValue()
  // 处理保存逻辑
  store.posts[store.currentPostIndex].content = content
  store.editorRefresh()
}

// 替换原来使用 save() 的地方
function handleKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === `s`) {
    e.preventDefault()
    handleSave()
  }
}

onMounted(() => {
  initEditor()
  onEditorRefresh()
  mdLocalToRemote()
  window.addEventListener(`keydown`, handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener(`keydown`, handleKeyDown)
})

// 修改手势处理函数
function handleTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
  lastTouchY.value = touchStartY.value
}

function handleTouchMove(e: TouchEvent) {
  const currentY = e.touches[0].clientY
  const deltaY = Math.abs(currentY - lastTouchY.value)

  if (deltaY > MIN_SCROLL_DISTANCE) {
    showControls.value = false
    clearTimeout(scrollTimer)
    clearTimeout(controlsTimer)
  }

  lastTouchY.value = currentY
}

function handleTouchEnd(e: TouchEvent) {
  touchEndX.value = e.changedTouches[0].clientX
  const swipeDistance = touchEndX.value - touchStartX.value

  // 处理水平滑动
  if (Math.abs(swipeDistance) >= MIN_SWIPE_DISTANCE) {
    if (swipeDistance > 0 && showPreview.value) {
      // 向右滑动，切换到编辑模式
      toggleView()
    }
    else if (swipeDistance < 0 && !showPreview.value) {
      // 向左滑动，切换到预览模式
      toggleView()
    }
  }

  // 如果不是在滚动，则启动计时器显示控制按钮
  if (!isScrolling.value) {
    clearTimeout(controlsTimer)
    controlsTimer = setTimeout(() => {
      showControls.value = true
    }, 2000)
  }
}

// 添加编辑状态
const isPreviewEditing = ref(false)

// 添加预览区域的输入处理函数
function handlePreviewInput(e: Event) {
  // 获取当前编辑的元素
  const target = e.target as HTMLElement
  if (!target)
    return

  // 保存当前元素的样式
  const styles = window.getComputedStyle(target)
  const originalStyles = {
    color: styles.color,
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    background: styles.background,
    // 添加其他需要保持的样式...
  }

  // 获取纯文本内容
  const content = target.textContent || ``

  if (editor.value) {
    // 将预览区域的纯文本内容转换回Markdown
    const markdownContent = content
      .split(`\n`)
      .map(line => line.trim())
      .join(`\n\n`)

    // 保存当前滚动位置
    const scrollInfo = editor.value.getScrollInfo()

    editor.value.setValue(markdownContent)
    store.posts[store.currentPostIndex].content = markdownContent

    // 恢复滚动位置
    editor.value.scrollTo(scrollInfo.left, scrollInfo.top)

    // 恢复元素的原始样式
    Object.assign(target.style, originalStyles)
  }
}

// 处理预览区域的粘贴事件，保持样式
function handlePreviewPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData(`text/plain`) || ``
  const selection = window.getSelection()
  if (!selection?.rangeCount)
    return

  const range = selection.getRangeAt(0)
  const textNode = document.createTextNode(text)
  range.deleteContents()
  range.insertNode(textNode)

  // 设置光标位置到插入文本的末尾
  range.setStartAfter(textNode)
  range.setEndAfter(textNode)
  selection.removeAllRanges()
  selection.addRange(range)
}

// 处理预览区域的焦点事件
function handlePreviewFocus() {
  isPreviewEditing.value = true
}

function handlePreviewBlur() {
  isPreviewEditing.value = false
}
</script>

<template>
  <div
    ref="container"
    class="container flex flex-col"
    @touchstart="isMobileView && handleTouchStart"
    @touchmove="isMobileView && handleTouchMove"
    @touchend="isMobileView && handleTouchEnd"
  >
    <EditorHeader
      @add-format="addFormat"
      @format-content="formatContent"
      @start-copy="startCopy"
      @end-copy="endCopy"
    />
    <main class="container-main flex flex-1 flex-col">
      <div class="editor-workspace-shell container-main-section border-radius-10 relative flex flex-1 overflow-hidden border-1">
        <PostSlider class="content-rail" />
        <div
          ref="codeMirrorWrapper"
          class="editor-pane codeMirror-wrapper"
          :class="{
            'order-1': !store.isEditOnLeft && !isMobileView,
            'border-r': store.isEditOnLeft && !isMobileView,
            'border-l': !store.isEditOnLeft && !isMobileView,
            'hidden': isMobileView && showPreview,
            'flex-1': !isMobileView || !showPreview,
            'is-transitioning': isTransitioning,
          }"
        >
          <ContextMenu modal>
            <ContextMenuTrigger>
              <textarea
                id="editor"
                type="textarea"
                placeholder="Your markdown text here."
                @focus="isEditorFocused = true"
                @blur="isEditorFocused = false"
              />
            </ContextMenuTrigger>
            <ContextMenuContent
              :class="{ 'mobile-context-menu': isMobileView }"
              class="context-menu-content"
            >
              <ContextMenuItem inset @click="continueWithAI">
                <BrainCircuit class="mr-2 size-4" />
                AI继续编写
              </ContextMenuItem>
              <ContextMenuItem inset @click="optimizeWithAI">
                <BrainCircuit class="mr-2 size-4" />
                AI优化表达
              </ContextMenuItem>
              <ContextMenuItem inset @click="rewriteWithAI">
                <BrainCircuit class="mr-2 size-4" />
                AI伪原创
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem inset @click="showTemplateDialog = true">
                插入模板
              </ContextMenuItem>
              <ContextMenuItem inset @click="importDefaultMarkdown">
                导入默认文章
              </ContextMenuItem>
              <ContextMenuItem inset @click="toggleShowUploadImgDialog()">
                上传图片
              </ContextMenuItem>
              <ContextMenuItem inset @click="generateImageWithAI">
                AI生成配图
              </ContextMenuItem>
              <ContextMenuItem inset @click="editImageWithAI">
                AI编辑图片
              </ContextMenuItem>
              <ContextMenuItem inset @click="recognizeImageWithAI">
                AI识别图片
              </ContextMenuItem>
              <ContextMenuItem inset @click="toggleShowInsertFormDialog()">
                插入表格
              </ContextMenuItem>
              <ContextMenuItem inset @click="resetStyleConfirm()">
                恢复默认样式
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem inset @click="importMarkdownContent()">
                导入 .md 文档
              </ContextMenuItem>
              <ContextMenuItem inset @click="exportEditorContent2MD()">
                导出 .md 文档
              </ContextMenuItem>
              <ContextMenuItem inset @click="exportEditorContent2HTML()">
                导出 .html
              </ContextMenuItem>
              <ContextMenuItem inset @click="formatContent()">
                格式化
                <ContextMenuShortcut>{{ altSign }} + {{ shiftSign }} + F</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>

        <div
          id="preview"
          ref="preview"
          class="preview-pane preview-wrapper flex-1 p-5"
          :class="{
            'hidden': isMobileView && !showPreview,
            'is-transitioning': isTransitioning,
          }"
        >
          <div id="output-wrapper" :class="{ output_night: !backLight }">
            <div class="preview border-x-1 shadow-xl">
              <section
                id="output"
                :key="output"
                class="markdown-preview"
                :class="{ 'is-editing': isPreviewEditing }"
                @input="handlePreviewInput"
                @paste="handlePreviewPaste"
                @focus="handlePreviewFocus"
                @blur="handlePreviewBlur"
                v-html="output"
              />
              <div v-if="isCoping" class="loading-mask">
                <div class="loading-mask-box">
                  <div class="loading__img" />
                  <span>正在生成</span>
                </div>
              </div>
            </div>
          </div>
          <BackTop target="preview" :right="40" :bottom="40" />
        </div>
        <CssEditor class="css-editor-pane order-2 flex-1" />
        <RightSlider class="settings-pane order-2" />
      </div>
      <footer
        class="text-muted-foreground h-[30px] flex select-none items-center justify-end text-[12px]"
        :class="{ hidden: displayStore.isShowUploadImgDialog || displayStore.isShowInsertFormDialog || displayStore.isShowCssEditor || showTemplateDialog || showRewriteDialog || isShowClearConfirmDialog || aiStore.settingsDialogVisible }"
      >
        字数 {{ readingTime?.words }}， 阅读大约需 {{ Math.ceil(readingTime?.minutes ?? 0) }} 分钟
      </footer>

      <UploadImgDialog @upload-image="uploadImage" />

      <InsertFormDialog />

      <RunLoading />

      <AlertDialog v-model:open="store.isOpenConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提示</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将丢失本地自定义样式，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction @click="store.resetStyle()">
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RewriteDialog
        v-model:open="showRewriteDialog"
        @confirm="handleRewriteConfirm"
      />

      <MarkdownTemplateDialog
        v-model:show="showTemplateDialog"
      />

      <Dialog v-model:open="isImageActionDialogOpen">
        <DialogContent class="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {{ pendingImageAction === 'generate' ? 'AI生成配图' : pendingImageAction === 'edit' ? 'AI编辑图片' : 'AI识别图片' }}
            </DialogTitle>
            <DialogDescription>
              {{ pendingImageAction === 'generate' ? '输入图片生成提示词。' : pendingImageAction === 'edit' ? '输入图片编辑提示词。' : '输入图片识别提示词。' }}
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-3">
            <Input v-model="imageActionPrompt" placeholder="请输入提示词" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isImageActionDialogOpen = false">
              取消
            </Button>
            <Button @click="confirmImageAction">
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        v-if="isMobileView && showControls"
        class="mobile-controls"
        :class="{ 'controls-hidden': !showControls }"
      >
        <div class="mode-buttons">
          <Button
            class="mode-btn"
            :class="{ active: !showPreview }"
            @click="showPreview = false"
          >
            <Edit class="h-4 w-4" />
          </Button>
          <Button
            class="mode-btn"
            :class="{ active: showPreview }"
            @click="showPreview = true"
          >
            <Eye class="h-4 w-4" />
          </Button>
          <Button
            class="mode-btn"
            @click="isShowClearConfirmDialog = true"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog v-model:open="isShowClearConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将清空当前编辑器的所有内容，是否确认？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction @click="store.clearCurrentContent()">
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        v-if="isMobileView"
        class="mobile-bottom-menu"
      >
        <div class="menu-items">
          <Button
            class="menu-item"
            variant="ghost"
            @click="continueWithAI"
          >
            <BrainCircuit class="menu-icon" />
            <span class="menu-text">续写</span>
          </Button>
          <Button
            class="menu-item"
            variant="ghost"
            @click="optimizeWithAI"
          >
            <Sparkles class="menu-icon" />
            <span class="menu-text">优化</span>
          </Button>
          <Button
            class="menu-item"
            variant="ghost"
            @click="rewriteWithAI"
          >
            <Wand2 class="menu-icon" />
            <span class="menu-text">伪原创</span>
          </Button>
          <Button
            class="menu-item"
            variant="ghost"
            @click="showTemplateDialog = true"
          >
            <LayoutTemplate class="menu-icon" />
            <span class="menu-text">模板</span>
          </Button>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="less" scoped>
@import url('../assets/less/app.less');
</style>

<style lang="less" scoped>
.container {
  height: 100vh;
  min-width: 100%;
  padding: 0;
}

.container-main {
  overflow: hidden;
  padding: 0 20px 12px;
  min-width: 0;
  background: hsl(var(--muted) / 0.28);
}

#output-wrapper {
  position: relative;
  user-select: text;
  height: 100%;
  width: 100%;
  min-width: 0;
}

.loading-mask {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  color: hsl(var(--foreground));
  background-color: hsl(var(--background));

  .loading-mask-box {
    position: sticky;
    top: 50%;
    transform: translateY(-50%);

    .loading__img {
      width: 75px;
      height: 75px;
      background: url('../assets/images/favicon.png') no-repeat;
      margin: 1em auto;
      background-size: cover;
    }
  }
}

:deep(.preview-table) {
  border-spacing: 0;
}

.codeMirror-wrapper,
.preview-wrapper {
  height: 100%;
  min-width: 0;
  will-change: transform, opacity;
}

.editor-workspace-shell {
  min-width: 0;
  gap: 1px;
  border-color: hsl(var(--border));
  background: hsl(var(--border));
  box-shadow:
    0 18px 48px rgba(15, 23, 42, 0.08),
    0 1px 0 hsl(var(--background) / 0.8) inset;
}

.editor-pane,
.preview-pane {
  position: relative;
  flex: 1 1 0;
  min-width: 320px;
  background: hsl(var(--background));
}

.editor-pane::before,
.preview-pane::before {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 3;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--background) / 0.92);
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 8px;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
}

.editor-pane::before {
  content: '编辑';
}

.preview-pane::before {
  content: '预览';
}

.css-editor-pane {
  background: hsl(var(--background));
}

.content-rail,
.settings-pane,
.css-editor-pane {
  flex: 0 0 auto;
  min-width: 0;
}

.codeMirror-wrapper {
  overflow: hidden;
  position: relative;

  &.prevent-touch {
    touch-action: pan-x pan-y;

    :deep(.CodeMirror) {
      touch-action: pan-x pan-y;
    }
  }

  :deep(.CodeMirror) {
    height: 100%;
    width: 100%;
    font-size: 15px;
    line-height: 1.6;
  }

  :deep(.CodeMirror-focused) {
    z-index: 2;
  }

  :deep(.context-menu) {
    @media (max-width: 768px) {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: calc(100% - 32px) !important;
      max-height: 80vh !important;
      overflow-y: auto !important;
      margin: 0 !important;
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
      background: hsl(var(--background) / 0.95) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border: 1px solid hsl(var(--border)) !important;
      z-index: 1001 !important;

      .context-menu-content {
        width: 100% !important;
        padding: 8px !important;

        .context-menu-item {
          padding: 12px 16px !important;
          font-size: 16px !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;

          &:not(:last-child) {
            border-bottom: 1px solid hsl(var(--border) / 0.1) !important;
          }

          .context-menu-shortcut {
            margin-left: auto !important;
            font-size: 14px !important;
            opacity: 0.5 !important;
          }
        }

        .context-menu-separator {
          margin: 8px -8px !important;
          background: hsl(var(--border)) !important;
        }
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(20px, -50%) scale(0.9);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translate(0, -50%) scale(1);
}

.preview-wrapper {
  height: 100%;
  overflow: auto;
  background: hsl(var(--muted) / 0.26);
  width: 100%;
  padding: 0;
  box-sizing: border-box;
  border: none;

  .preview {
    width: min(100%, 677px);
    max-width: 100%;
    height: 100%;
    margin: 0 auto;
    background-color: hsl(var(--background));
    box-shadow: 0 0 0 1px hsl(var(--border));
    border: none;

    #output {
      width: 100%;
      max-width: 100%;
      min-height: 100%;
      height: auto;
      padding: 20px;
      box-sizing: border-box;
      border: none;
      background-color: hsl(var(--background));
      color: var(--foreground);
    }
  }
}

.markdown-preview {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  height: auto;
  overflow: visible;
  word-break: break-word;
  overflow-wrap: break-word;

  /* 允许文本选择和编辑，但保持样式 */
  cursor: text;
  caret-color: currentColor;

  /* 编辑状态的视觉反馈 */
  &.is-editing {
    outline: none;
  }

  /* 确保编辑时不会影响布局 */
  &:focus {
    outline: none;
  }

  /* 保持所有元素的样式和事件 */
  section,
  div,
  p,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  span {
    position: relative;

    &[contenteditable='true'] {
      cursor: text;
      -webkit-user-modify: read-write;
      user-modify: read-write;
      -moz-user-modify: read-write;
    }
  }
}

:deep(.markdown-preview img),
:deep(.markdown-preview video),
:deep(.markdown-preview canvas),
:deep(.markdown-preview svg) {
  max-width: 100%;
  height: auto;
}

:deep(.markdown-preview section) {
  max-width: 100%;
}

:deep(.markdown-preview pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre;
}

:deep(.markdown-preview pre code) {
  display: block;
  width: max-content;
  min-width: 100%;
  max-width: none;
  overflow-x: visible;
  white-space: pre;
}

:deep(.markdown-preview table) {
  width: max-content !important;
  min-width: 100%;
  max-width: none;
}

:deep(.markdown-preview .preview-table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

.mobile-controls {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 1;
  touch-action: none; // 防止触摸事件影响页面滚动

  &.controls-hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%) translateX(20px);
  }

  .mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: hsl(var(--background) / 0.8);
    padding: 8px;
    border-radius: 16px;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.1),
      0 0 0 1px hsl(var(--border) / 0.2);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);

    .mode-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border-radius: 12px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background-color: hsl(var(--background));
      color: hsl(var(--muted-foreground));
      border: 1px solid hsl(var(--border));
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      touch-action: manipulation;

      &:active {
        transform: scale(0.95);
      }

      &.active {
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        border-color: transparent;
        box-shadow:
          0 0 0 2px hsl(var(--background)),
          0 0 0 4px hsl(var(--primary) / 0.4);
      }

      &:hover:not(.active) {
        background: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
      }
    }
  }
}

.mobile-context-menu {
  @media (max-width: 768px) {
    animation: mobileMenuIn 0.2s ease-out;
  }
}

@keyframes mobileMenuIn {
  from {
    opacity: 0;
    transform: translate(-50%, -45%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

// 添加遮罩层样式
:deep(.context-menu-overlay) {
  @media (max-width: 768px) {
    background-color: rgba(0, 0, 0, 0.4) !important;
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
  }
}

.mobile-bottom-menu {
  position: fixed;
  bottom: 5px;
  left: 0;
  right: 0;
  background: hsl(var(--background) / 0.95);
  border-top: 1px solid hsl(var(--border));
  padding: 8px 16px;
  z-index: 1001;
  height: auto;
  border-radius: 16px 16px 0 0;
  margin: 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  border: none;
  transition: all 0.3s ease;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.menu-items {
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 1px;
  padding: 1px 1px;
  border-radius: 8px;
  flex: 1;
  min-width: 0;
  height: 100%;
  background: transparent;
  color: hsl(var(--foreground));

  &:active {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
    transform: scale(0.95);
  }

  .menu-icon {
    width: 16px;
    height: 16px;
    margin-top: 1px;
  }

  .menu-text {
    font-size: 10px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1;
    margin-top: 1px;
    padding: 0 2px;
  }
}

@media (max-width: 768px) {
  .container-main {
    padding: 0 8px;
  }

  .container-main-section {
    flex-direction: column;
    position: relative;
    height: calc(100vh - 176px);
    padding-bottom: 80px;
  }

  .content-rail,
  .css-editor-pane {
    display: none;
  }

  .settings-pane {
    display: block;
  }

  .codeMirror-wrapper,
  .preview-wrapper {
    width: 100%;
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    box-sizing: border-box;
    overflow-x: hidden;
    margin: 0;
    transition:
      transform 0.3s ease-in-out,
      opacity 0.3s ease-in-out;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    perspective: 1000;
    -webkit-perspective: 1000;
  }

  .codeMirror-wrapper {
    padding: 0;
    transform: translateX(0);
    opacity: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;

    &.hidden {
      transform: translateX(-100%);
      opacity: 0;
      pointer-events: none;
    }

    :deep(.CodeMirror) {
      height: auto !important;
      min-height: 100% !important;
      width: 100% !important;
      font-size: 15px;
      padding: 34px 12px 12px;
      background-color: hsl(var(--background));
      overflow-x: hidden;
      touch-action: pan-y;
      position: relative;
      z-index: 1;
    }

    :deep(.CodeMirror-focused) {
      z-index: 2;
    }
  }

  .preview-wrapper {
    padding: 34px 12px 12px;
    overflow-y: auto;
    margin-left: 0;
    transform: translateX(0);
    opacity: 1;
    -webkit-overflow-scrolling: touch;

    &.hidden {
      transform: translateX(100%);
      opacity: 0;
      pointer-events: none;
    }

    .preview {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      background-color: hsl(var(--background));
      min-height: 100%;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
  }

  #output-wrapper {
    height: auto;
    min-height: 100%;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  footer {
    padding: 0 12px;
    height: 40px;
    font-size: 12px;
    margin-bottom: 62px;
    position: relative;
    z-index: 1001;
    background: hsl(var(--background));
  }

  .is-transitioning {
    transition:
      transform 0.3s ease-in-out,
      opacity 0.3s ease-in-out;
  }

  .mobile-bottom-menu {
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    width: calc(100% - 16px);
    left: 8px;
    right: 8px;
    padding-left: 8px;
    padding-right: 8px;
  }
}

.dark {
  .preview-wrapper {
    background-color: transparent;

    .preview {
      background-color: transparent;
      box-shadow: none;
      border: none;

      #output {
        background-color: transparent;
        color: hsl(var(--foreground));
      }
    }
  }
}
</style>
