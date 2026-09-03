<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import {
  altSign,
  ctrlKey,
  ctrlSign,
  shiftSign,
} from '@/config'
import { useStore } from '@/stores'
import { addPrefix, processClipboardContent } from '@/utils'
import { ChevronDownIcon, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, Users, Wand2 } from 'lucide-vue-next'
import AboutDialog from './AboutDialog.vue'
import AIDropdown from './AIDropdown.vue'
import AIStyleDialog from './AIStyleDialog.vue'
import ExportImageDialog from './ExportImageDialog.vue'

const emit = defineEmits([`addFormat`, `formatContent`, `startCopy`, `endCopy`])

const formatItems = [
  {
    label: `加粗`,
    kbd: [ctrlSign, `B`],
    emitArgs: [`addFormat`, `${ctrlKey}-B`],
  },
  {
    label: `斜体`,
    kbd: [ctrlSign, `I`],
    emitArgs: [`addFormat`, `${ctrlKey}-I`],
  },
  {
    label: `删除线`,
    kbd: [ctrlSign, `D`],
    emitArgs: [`addFormat`, `${ctrlKey}-D`],
  },
  {
    label: `超链接`,
    kbd: [ctrlSign, `K`],
    emitArgs: [`addFormat`, `${ctrlKey}-K`],
  },
  {
    label: `行内代码`,
    kbd: [ctrlSign, `E`],
    emitArgs: [`addFormat`, `${ctrlKey}-E`],
  },
  {
    label: `格式化`,
    kbd: [altSign, shiftSign, `F`],
    emitArgs: [`formatContent`],
  },
] as const

const store = useStore()

const { isDark, isCiteStatus, isCountStatus, output, primaryColor, isOpenPostSlider } = storeToRefs(store)

const { toggleDark, citeStatusChanged, countStatusChanged } = store

const copyMode = useStorage(addPrefix(`copyMode`), `txt`)
const source = ref(``)
const { copy: copyContent } = useClipboard({ source })

const showExportImageDialog = ref(false)
const showAIStyleDialog = ref(false)
const showAboutDialog = ref(false)

// 复制到微信公众号
function copy() {
  emit(`startCopy`)
  setTimeout(() => {
    // 如果是深色模式，复制之前需要先切换到白天模式
    const isBeforeDark = isDark.value
    if (isBeforeDark) {
      toggleDark()
    }

    nextTick(async () => {
      const temp = processClipboardContent(output.value, primaryColor.value)
      if (copyMode.value === `txt`) {
        const clipboardDiv = document.createElement(`div`)
        clipboardDiv.contentEditable = `true`
        clipboardDiv.style.position = `fixed`
        clipboardDiv.style.left = `-9999px`
        clipboardDiv.style.top = `0`
        clipboardDiv.innerHTML = temp
        document.body.appendChild(clipboardDiv)
        clipboardDiv.focus()
        window.getSelection()!.removeAllRanges()
        const range = document.createRange()
        range.setStartBefore(clipboardDiv.firstChild!)
        range.setEndAfter(clipboardDiv.lastChild!)
        window.getSelection()!.addRange(range)
        document.execCommand(`copy`)
        window.getSelection()!.removeAllRanges()
        document.body.removeChild(clipboardDiv)
      }
      if (isBeforeDark) {
        nextTick(() => toggleDark())
      }
      if (copyMode.value === `html`) {
        await copyContent(temp)
      }

      // 输出提示
      toast.success(
        copyMode.value === `html`
          ? `已复制 HTML 源码，请进行下一步操作。`
          : `已复制渲染后的内容到剪贴板，可直接到公众号后台粘贴。`,
      )

      emit(`endCopy`)
    })
  }, 350)
}
</script>

<template>
  <header class="header-container h-15 flex items-center justify-between px-5">
    <div class="space-x-2 header-menu-group flex">
      <Menubar class="menubar">
        <FileDropdown />
        <AIDropdown />
        <MenubarMenu>
          <MenubarTrigger> 格式 </MenubarTrigger>
          <MenubarContent class="w-60" align="start">
            <MenubarCheckboxItem
              v-for="{ label, kbd, emitArgs } in formatItems" :key="label"
              @click="emitArgs[0] === 'addFormat' ? $emit(emitArgs[0], emitArgs[1]) : $emit(emitArgs[0])"
            >
              {{ label }}
              <MenubarShortcut>
                <kbd v-for="item in kbd" :key="item" class="mx-1 bg-gray-2 dark:bg-stone-9">
                  {{ item }}
                </kbd>
              </MenubarShortcut>
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarCheckboxItem :checked="isCiteStatus" @click="citeStatusChanged()">
              微信外链转底部引用
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarCheckboxItem
              :checked="isCountStatus"
              @click="countStatusChanged()"
            >
              统计字数和阅读时间
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
        <EditDropdown />
        <StyleDropdown />
        <HelpDropdown />
        <MenubarMenu>
          <MenubarTrigger @click="showAboutDialog = true">
            <Users class="mr-1 size-4" />
            项目群
          </MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    </div>

    <div class="space-x-2 header-action-group flex">
      <TooltipProvider :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              :aria-label="isOpenPostSlider ? '关闭内容管理' : '打开内容管理'"
              @click="isOpenPostSlider = !isOpenPostSlider"
            >
              <PanelLeftOpen v-show="!isOpenPostSlider" class="size-4" />
              <PanelLeftClose v-show="isOpenPostSlider" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {{ isOpenPostSlider ? "关闭" : "内容管理" }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="outline" :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleDark()">
        <Moon v-show="isDark" class="size-4" />
        <Sun v-show="!isDark" class="size-4" />
      </Button>

      <div class="bg-background copy-action-group space-x-1 text-background-foreground mx-2 flex items-center border rounded-md">
        <Button variant="ghost" class="shadow-none" @click="copy">
          复制
        </Button>
        <Separator orientation="vertical" class="h-5" />
        <DropdownMenu v-model="copyMode">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="px-2 shadow-none" aria-label="选择复制格式">
              <ChevronDownIcon class="text-secondary-foreground h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            :align-offset="-5"
            class="w-[200px]"
          >
            <DropdownMenuRadioGroup v-model="copyMode">
              <DropdownMenuRadioItem value="txt">
                公众号格式
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="html">
                HTML 格式
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PostInfo />

      <Button variant="outline" aria-label="打开样式设置" @click="store.isOpenRightSlider = !store.isOpenRightSlider">
        <Settings class="size-4" />
      </Button>

      <Button variant="outline" aria-label="AI 样式助手" @click="showAIStyleDialog = true">
        <Wand2 class="size-4" />
      </Button>

      <Toaster rich-colors position="top-center" />
    </div>

    <ExportImageDialog
      v-model:show="showExportImageDialog"
    />

    <AIStyleDialog
      v-model:show="showAIStyleDialog"
    />

    <AboutDialog
      :visible="showAboutDialog"
      @close="showAboutDialog = false"
    />
  </header>
</template>

<style lang="less" scoped>
.menubar {
  user-select: none;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.header-container {
  gap: 12px;
  min-width: 0;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.96);
  box-shadow: 0 1px 0 hsl(var(--background)) inset;
  position: relative;
  z-index: 10;
}

.header-menu-group {
  min-width: 0;
  overflow: hidden;
}

.header-action-group {
  align-items: center;
  justify-content: flex-end;
  min-width: max-content;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--muted) / 0.35);
  padding: 4px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.copy-action-group {
  flex-shrink: 0;
  border-color: hsl(var(--border));
  background: hsl(var(--background));
}

kbd {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #a8a8a8;
  padding: 1px 4px;
  border-radius: 2px;
}

@media (max-width: 768px) {
  .header-container {
    padding: 8px;
    height: auto;
    flex-wrap: wrap;
    gap: 8px;
    align-items: stretch;
  }

  .header-menu-group,
  .header-action-group {
    width: 100%;
  }

  .header-menu-group {
    overflow: hidden;
  }

  .header-action-group {
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    padding: 6px;
  }

  .menubar {
    display: flex;
    gap: 4px;
    padding: 0;
    width: 100%;
    overflow: hidden;

    :deep(.MenubarTrigger) {
      padding: 0 8px;
      height: 32px;
      font-size: 14px;
      white-space: nowrap;
    }
  }

  .header-action-group.space-x-2 {
    display: flex;
    gap: 4px;
    margin: 0;
  }

  .copy-action-group {
    margin: 0;
    flex: 1 1 auto;
    justify-content: center;
    min-width: 96px;
  }

  :deep(.Button) {
    height: 32px;
    padding: 0 8px;
    font-size: 14px;
    min-width: 32px;

    svg {
      width: 16px;
      height: 16px;
    }
  }

  :deep(.Separator) {
    height: 24px;
    margin: 0 2px;
  }

  :deep(.MenubarContent),
  :deep(.DropdownMenuContent) {
    max-height: 80vh;
    overflow-y: auto;
  }
}
</style>
