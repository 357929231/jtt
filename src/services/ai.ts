import { useAIStore } from '@/stores/ai'
import { AIClient } from './aiClient'

// 添加检查和纠正模型的函数
function validateAndFixModel(model: string): string {
  console.log(`用户选择的模型: ${model}`)
  return model
}

// 处理流式响应的函数
async function processStreamResponse(
  response: Response,
  protocol: string,
  onToken?: (token: string) => void,
  onFinish?: () => void,
) {
  const aiStore = useAIStore()
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  let hasContent = false

  if (!reader) {
    throw new Error(`无法读取响应数据流`)
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      aiStore.setGenerating(false)
      if (!hasContent) {
        throw new Error(`AI 返回内容为空，请检查模型或接口响应`)
      }
      onFinish?.()
      break
    }

    const chunk = decoder.decode(value)
    const lines = chunk.split(`\n`)

    for (const line of lines) {
      if (line.startsWith(`data: `)) {
        const data = line.slice(6).trim()
        if (data === `[DONE]`)
          continue

        try {
          const parsed = JSON.parse(data)
          const token = extractAIText(parsed, protocol, true)
          if (token) {
            hasContent = true
            onToken?.(token)
          }
        }
        catch (e) {
          console.error(`解析响应数据失败:`, e)
        }
      }
    }
  }
}

function extractAIText(payload: any, protocol: string, streaming = false) {
  if (protocol === `openai-responses`) {
    return payload.output?.flatMap((item: any) => item.content || [])
      ?.map((part: any) => part.text)
      ?.filter(Boolean)
      ?.join(``)
      || payload.output_text
      || payload.delta
      || payload.response?.output_text
      || ``
  }

  if (protocol === `anthropic-native`) {
    return payload.content?.map((part: any) => part.text).filter(Boolean).join(``)
      || payload.delta?.text
      || payload.content_block?.text
      || payload.content_block_delta?.delta?.text
      || ``
  }

  return payload.choices?.[0]?.message?.content
    || (streaming ? payload.choices?.[0]?.delta?.content : ``)
    || payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join(``)
    || payload.content?.[0]?.text
    || ``
}

async function emitJsonResponseText(response: Response, protocol: string, onToken?: (token: string) => void) {
  const payload = await response.json() as any
  const text = extractAIText(payload, protocol)
  if (!text) {
    throw new Error(`AI 返回内容为空，请检查模型或接口响应`)
  }
  onToken?.(text)
}

function shouldRetryWithoutStream(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /API请求失败 \((?:400|404|405|422|503)\)/.test(message)
    || /stream|流式|无可用渠道|No available channel|model_not_found/i.test(message)
}

export interface AIStreamOptions {
  prompt: string | Array<{ role: string, content: string }> | {
    system?: string
    user?: string
  }
  onToken?: (token: string) => void
  onError?: (error: Error) => void
  onFinish?: () => void
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
    if (!aiStore.apiKey && aiStore.connection.mode !== `worker-proxy`) {
      throw new Error(`请先设置 API Key`)
    }

    if (!aiStore.apiDomain || aiStore.apiDomain === `YOUR_API_BASE_URL`) {
      throw new Error(`请先设置 API 地址`)
    }

    console.log(`AI Store中的模型状态:`, {
      selectedModel: aiStore.selectedModel,
      customModel: aiStore.customModel,
    })

    const selectedModel = aiStore.selectedModel
    console.log(`发送请求前使用的模型：${selectedModel}`)

    const validatedModel = validateAndFixModel(selectedModel)
    console.log(`验证后使用的模型：${validatedModel}`)

    const client = new AIClient(aiStore.apiDomain, aiStore.apiKey, aiStore.connection.protocol)
    const streamEnabled = aiStore.connection.protocol === `openai-chat-completions`
    const requestPayload = {
      model: validatedModel,
      messages: [
        ...aiStore.presetWords.map(word => ({ role: `system`, content: word })),
        ...(typeof prompt === `string`
          ? [{ role: `user`, content: prompt }]
          : Array.isArray(prompt)
            ? prompt
            : [
                { role: `system`, content: (prompt as { system?: string }).system || `` },
                { role: `user`, content: (prompt as { user?: string }).user || `` },
              ]
        ).filter(msg => msg.content),
      ],
      parameters: aiStore.parameters,
      stream: streamEnabled,
    }
    let response: Response
    let useStreamResponse = streamEnabled
    try {
      response = await client.createChatCompletion(requestPayload)
    }
    catch (error) {
      if (!streamEnabled || !shouldRetryWithoutStream(error)) {
        throw error
      }
      console.warn(`流式 AI 请求失败，已自动降级为非流式请求:`, error)
      useStreamResponse = false
      response = await client.createChatCompletion({
        ...requestPayload,
        stream: false,
      })
    }

    if (!useStreamResponse || response.headers.get(`Content-Type`)?.includes(`application/json`)) {
      await emitJsonResponseText(response, aiStore.connection.protocol, onToken)
      aiStore.setGenerating(false)
      onFinish?.()
      return
    }

    await processStreamResponse(response, aiStore.connection.protocol, onToken, onFinish)
  }
  catch (error) {
    aiStore.setGenerating(false)
    console.error(`AI 请求失败:`, {
      错误信息: error instanceof Error ? error.message : String(error),
      API地址: aiStore.apiDomain,
      模型: aiStore.selectedModel,
    })
    onError?.(error instanceof Error ? error : new Error(String(error)))
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
    // 添加日志记录，显示callAI中使用的模型
    console.log(`callAI函数 - AI Store中的模型状态:`, {
      selectedModel: aiStore.selectedModel,
      customModel: aiStore.customModel,
    })

    const selectedModel = aiStore.selectedModel
    console.log(`callAI函数 - 使用模型：${selectedModel}`)

    const validatedModel = validateAndFixModel(selectedModel)
    console.log(`callAI函数 - 验证后的模型：${validatedModel}`)

    const client = new AIClient(aiStore.apiDomain, aiStore.apiKey, aiStore.connection.protocol)
    const response = await client.createChatCompletion({
      model: validatedModel,
      messages: [{ role: `user`, content: prompt }],
      parameters: aiStore.parameters,
    })

    const data = await response.json() as any
    return extractAIText(data, aiStore.connection.protocol)
  }
  catch (error) {
    console.error(`调用 AI 服务失败:`, error)
    throw error
  }
}
