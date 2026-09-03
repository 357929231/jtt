import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, `../../..`)

function readSource(path: string) {
  return readFileSync(resolve(root, path), `utf8`)
}

describe(`editor layout contract`, () => {
  const editor = readSource(`src/views/CodemirrorEditor.vue`)
  const header = readSource(`src/components/CodemirrorEditor/EditorHeader/index.vue`)
  const rightSlider = readSource(`src/components/CodemirrorEditor/RightSlider.vue`)

  it(`uses named workspace regions so desktop columns can be constrained`, () => {
    expect(editor).toContain(`editor-workspace-shell`)
    expect(editor).toContain(`editor-pane`)
    expect(editor).toContain(`preview-pane`)
    expect(editor).toContain(`settings-pane`)
  })

  it(`constrains preview, tables, and code blocks inside the preview column`, () => {
    expect(editor).toContain(`max-width: 100%`)
    expect(editor).toContain(`overflow-x: auto`)
    expect(editor).toContain(`:deep(.markdown-preview pre)`)
    expect(editor).toContain(`:deep(.markdown-preview table)`)
  })

  it(`keeps mobile header actions reachable without horizontal scrolling`, () => {
    expect(header).toContain(`header-menu-group`)
    expect(header).toContain(`header-action-group`)
    expect(header).toContain(`copy-action-group`)
    expect(header).toContain(`flex-wrap: wrap`)
    expect(header).not.toContain(`overflow-x: auto`)
  })

  it(`uses a fixed settings rail on desktop and hides it from mobile flow`, () => {
    expect(rightSlider).toContain(`settings-panel`)
    expect(rightSlider).toContain(`settings-panel__content`)
    expect(rightSlider).toContain(`--settings-panel-width`)
    expect(rightSlider).toContain(`@media (max-width: 768px)`)
  })

  it(`keeps the settings drawer available on mobile`, () => {
    expect(editor).toMatch(/\.content-rail,\s*\.css-editor-pane\s*\{\s*display: none;/)
    expect(editor).not.toMatch(/\.content-rail,\s*\.settings-pane,\s*\.css-editor-pane\s*\{\s*display: none;/)
    expect(rightSlider).toContain(`position: fixed`)
    expect(rightSlider).toContain(`settings-panel--open`)
  })
})
