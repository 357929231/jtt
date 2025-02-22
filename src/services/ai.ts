export interface AIStreamOptions {
  prompt: string | Array<{ role: string, content: string }> | {
    system?: string
    user?: string
  }
  onToken?: (token: string) => void
  onError?: (error: Error) => void
  onFinish?: () => void
}

export async function getModelList(endpoint: string, token: string): Promise<string[]> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch model list: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()

    // 提取模型 ID 列表
    if (data && data.data && Array.isArray(data.data)) {
      return data.data.map((model: { id: string }) => model.id);
    } else {
      console.warn("Unexpected model list format:", data);
      return [];
    }
  }
  catch (error) {
    console.error(`Error fetching model list:`, error)
    return []
  }
}

export async function streamAIContent({
  prompt,
  onToken,
  onError,
  onFinish,
}: AIStreamOptions) {
  const aiStore = useAIStore()
  aiStore.setGenerating(true)

  try {
    const headers: HeadersInit = {
      'Content-Type': `application/json`,
      'Authorization': `Bearer ${aiStore.apiKey}`, // Default API key
    }

    const response = await fetch(`${aiStore.apiDomain}/v1/chat/completions`, {
      method: `POST`,
      headers,
      body: JSON.stringify({
        model: aiStore.customModel || aiStore.selectedModel,
        messages: [
          ...aiStore.presetWords.map(word => ({ role: `system` as const, content: word })),
          ...(typeof prompt === `string`
            ? [{ role: `user` as const, content: prompt }]
            : Array.isArray(prompt)
              ? prompt
              : [
                  { role: `system` as const, content: (prompt as { system?: string }).system || `` },
                  { role: `user` as const, content: (prompt as { user?: string }).user || `` },
                ]
          ).filter(msg => msg.content),
        ],
        temperature: aiStore.temperature,
        max_tokens: aiStore.maxLength,
        stream: true,
      }),
    })

    if (!response.ok) {
      aiStore.setGenerating(false)
      let errorMessage = ``

      switch (response.status) {
        case 401:
          errorMessage = `认证失败：API Key 无效。请先前往"AI助手 -> 天马座API"注册并获取 API Key，然后在"AI助手 -> OpenAI设置"中填写。注意 Key 应以 sk- 开头`
          break
        case 403:
          errorMessage = `API Key 无访问权限。请前往"AI助手 -> 天马座API"检查 Key 是否有效或额度是否用尽`
          break
        case 429:
          errorMessage = `请求过于频繁，请稍后再试。如需更高请求限制，请前往"AI助手 -> 天马座API"升级账户`
          break
        case 500:
          errorMessage = `AI 服务器错误，请稍后重试。如持续出现此问题，请前往"AI助手 -> 天马座API"查看服务状态`
          break
        default:
          errorMessage = `请求失败 (${response.status}): ${response.statusText}。如需帮助，请访问"AI助手 -> 天马座API"获取支持`
      }

      throw new Error(errorMessage)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error(`No reader available`)
    }

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        aiStore.setGenerating(false)
        onFinish?.()
        break
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split(`\n`)

      for (const line of lines) {
        if (line.startsWith(`data: `)) {
          const data = line.slice(6)
          if (data === `[DONE]`)
            continue

          try {
            const parsed = JSON.parse(data)
            const token = parsed.choices[0]?.delta?.content
            if (token) {
              onToken?.(token)
            }
          }
          catch (e) {
            console.error(`Error parsing SSE message:`, e)
          }
        }
      }
    }
  }
  catch (error) {
    aiStore.setGenerating(false)
    onError?.(error as Error)
  }
}

export function generateWithAI(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = ``

    streamAIContent({
      prompt,
      onToken: (token) => {
        content += token
      },
      onError: (error) => {
        reject(error)
      },
      onFinish: () => {
        resolve(content)
      },
    })
  })
}

// CSS改写相关的提示词模板
export const CSS_REWRITE_PROMPTS = {
  optimize: `优化CSS结构,使用更合理的选择器和层级`,
  readability: `提高代码可读性,添加适当的空行和缩进`,
  simplify: `精简代码,去除冗余的样式声明`,
  comment: `为重要的样式块添加注释说明`,
  selectors: `保持原有的选择器名称不变`,
  important: `保留所有!important声明`,
  media: `保留所有媒体查询`,
  animation: `保留所有动画相关代码`,
}

// 生成CSS改写提示词
export function generateCssRewritePrompt(options: {
  styles: string[]
  retains: string[]
  css: string
  customPrompt?: string
}) {
  const { styles, retains, css, customPrompt } = options

  // 基础提示词
  const basePrompt = [
    `你是一个专业的CSS优化专家。你的任务是根据以下要求优化CSS代码:`,
    ``,
    `优化要求:`,
  ]

  // 添加优化选项
  styles.forEach((style) => {
    if (CSS_REWRITE_PROMPTS[style as keyof typeof CSS_REWRITE_PROMPTS]) {
      basePrompt.push(`- ${CSS_REWRITE_PROMPTS[style as keyof typeof CSS_REWRITE_PROMPTS]}`)
    }
  })

  // 添加保留选项
  if (retains.length > 0) {
    basePrompt.push(``, `保留要求:`)
    retains.forEach((retain) => {
      if (CSS_REWRITE_PROMPTS[retain as keyof typeof CSS_REWRITE_PROMPTS]) {
        basePrompt.push(`- ${CSS_REWRITE_PROMPTS[retain as keyof typeof CSS_REWRITE_PROMPTS]}`)
      }
    })
  }

  // 添加自定义提示词
  if (customPrompt?.trim()) {
    basePrompt.push(
      ``,
      `自定义要求:`,
      customPrompt.trim(),
    )
  }

  // 添加处理说明
  basePrompt.push(
    ``,
    `请严格按照以下步骤处理:`,
    `1. 仔细阅读上述优化和保留要求`,
    `2. 分析CSS代码的结构和特点`,
    `3. 根据要求优化代码,同时确保保留指定的特性`,
    `4. 检查优化后的代码是否符合所有要求`,
    ``,
    `需要优化的CSS代码:`,
    ``,
    css,
    ``,
    `请开始优化:`,
  )

  return {
    system: basePrompt.join(`\n`),
    user: css,
  }
}

// AI 服务接口
export async function callAI(prompt: string): Promise<string> {
  const aiStore = useAIStore()
  try {
    const headers: HeadersInit = {
      'Content-Type': `application/json`,
      'Authorization': `Bearer ${aiStore.apiKey}`, // Default API key
    }

    const response = await fetch(`${aiStore.apiDomain}/v1/chat/completions`, {
      method: `POST`,
      headers,
      body: JSON.stringify({
        model: aiStore.customModel || aiStore.selectedModel,
        messages: [{ role: `user`, content: prompt }],
        temperature: aiStore.temperature,
        max_tokens: aiStore.maxLength,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI 服务请求失败: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ``
  }
  catch (error) {
    console.error(`调用 AI 服务失败:`, error)
    throw error
  }
}