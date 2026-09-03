# DeepSeek大模型+微信公众号编辑器 = 内容生产革命+使用全免费，不用登录不注册。

## 部署说明

## AI 协议支持

当前版本不再只支持单一 `openai-compatible` 聊天格式，而是已经扩展为多协议 AI 提供商模式。

目前支持的协议包括：

- `OpenAI ChatCompletions`
- `OpenAI Responses`
- `Claude 原生格式`
- `Gemini 原生格式`
- `Gemini 媒体识别`

### 已真正接入主流程的能力

- 多协议文本聊天生成
- 编辑器主 AI 生成流程按协议切换真实请求格式
- Gemini 媒体识别入口

### 当前主要作为能力测试入口保留的能力

- `embeddings`
- `rerank`
- `moderations`
- `image`
- `speech`
- `transcription`
- `video`
- `realtime`

### 图床上传说明

为了避免浏览器构建阶段把 Node 侧 `minio` SDK 打进前端主包，当前版本已经移除了浏览器直连 `MinIO` 上传选项。

目前建议使用以下图床/对象存储方式：

- `GitHub`
- `阿里云 OSS`
- `腾讯云 COS`
- `七牛云`
- `Cloudflare R2`
- `公众号图床`
- `自定义代码`

如果你后续一定要接 `MinIO`，推荐改成：

1. `Worker / 服务端代理上传`
2. `预签名 URL 上传`

而不是继续在浏览器里直接引入 `minio` Node SDK。

这表示：

- 这些能力已经有真实请求实现和设置页测试入口
- 但它们还没有全部都像“正文 AI 生成”那样完整融入编辑器业务流程

### 协议与能力关系

- `OpenAI ChatCompletions`
  - 适合标准 OpenAI 兼容聊天与多能力接口
- `OpenAI Responses`
  - 适合走 `/v1/responses` 的新式响应协议
- `Claude 原生格式`
  - 适合直接对接原生 Claude 风格聊天接口
- `Gemini 原生格式`
  - 适合 Gemini 文本聊天
- `Gemini 媒体识别`
  - 适合图片/媒体理解类输入

### 设置页现在会真实影响什么

AI 设置页中的“协议格式”不是展示字段，当前会真实影响：

- 请求 endpoint
- 请求 body 结构
- 主聊天生成流程
- 能力测试卡片显示范围
- Gemini 媒体识别入口显示
- 协议支持的模型映射范围

### 能力配置现在支持两种模式

当前每个能力都支持两种工作方式：

1. 跟随全局连接协议
2. 单独覆盖协议 / 端点 / 模型

这意味着你可以这样配：

- 聊天能力跟随全局 `Claude` 或 `Responses`
- 图像生成单独走 `OpenAI Images`
- 图片识别单独走 `Gemini 原生`

当前第一批支持独立覆盖的能力包括：

- `聊天`
- `图像生成`
- `图像编辑`
- `媒体识别`

在 AI 设置页的 `能力` 页签中，你可以为这些能力单独设置：

- 是否跟随全局协议
- 单独模型
- 单独端点

如果端点留空，则自动使用当前协议默认端点。

### 写文章入口中的 AI 能力

现在“写文章”右键菜单里，除了原有的：

- `AI继续编写`
- `AI优化表达`
- `AI伪原创`

还新增了真实可调用的图像/识别能力入口：

- `AI生成配图`
- `AI编辑图片`
- `AI识别图片`

用途如下：

- `AI生成配图`
  - 输入提示词
  - 调用图像生成接口
  - 直接把生成结果插入文章
- `AI编辑图片`
  - 选择一张图片
  - 输入编辑提示词
  - 生成编辑后的图片并插回文章
- `AI识别图片`
  - 选择图片
  - 调用 Gemini 媒体识别
  - 把识别结果直接插入编辑器

### 什么时候选哪个协议

- 如果你的网关兼容传统 OpenAI 聊天接口：选 `OpenAI ChatCompletions`
- 如果你的网关更推荐 `/v1/responses`：选 `OpenAI Responses`
- 如果你直连 Claude 原生风格接口：选 `Claude 原生格式`
- 如果你直连 Gemini 原生文本或图像识别接口：选 `Gemini 原生格式`

当前项目已经适配以下部署方式：

- `Vercel`
- `Cloudflare Pages`
- `GitHub Pages`
- `Cloudflare Worker + Static Assets`
- `Cloudflare Worker` 作为可选 `/api/*` 代理层

如果你只是想把网页快速跑起来，优先推荐：

1. `Vercel`
2. `Cloudflare Pages`

### 一键部署 / 快速入口

#### Vercel 官方一键部署按钮

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxingxinag%2Fweixin-gzh%2Ftree%2Fminor&project-name=weixin-gzh&repository-name=weixin-gzh&demo-title=%E5%BE%AE%E4%BF%A1%E5%85%AC%E4%BC%97%E5%8F%B7%20Markdown%20%E7%BC%96%E8%BE%91%E5%99%A8&demo-description=%E6%94%AF%E6%8C%81%20AI%20%E8%83%BD%E5%8A%9B%E3%80%81OpenAI-Compatible%20%E6%8E%A5%E5%8F%A3%E3%80%81Vercel%20%E4%B8%80%E9%94%AE%E9%83%A8%E7%BD%B2&demo-url=https%3A%2F%2Fgithub.com%2Fxingxinag%2Fweixin-gzh)

说明：

- 这是 `Vercel` 官方支持的部署按钮格式
- 点击后会让用户把当前仓库导入到自己的 Vercel 和 Git 仓库账户下
- 这个项目默认是前端静态站点，不强制要求在 Vercel 部署时填写 API Key

#### Cloudflare Pages 快速入口

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages)

说明：

- `Cloudflare Pages` 目前我没有查到和 Vercel 那种完全等价的官方“克隆仓库并自动创建项目”的 README 按钮格式
- 这里放的是最接近的一键入口：直接跳到 `Workers & Pages` 控制台
- 进入后选择：`Create application` -> `Pages` -> `Connect to Git`

#### GitHub Pages 快速入口

[![Open GitHub Pages Settings](https://img.shields.io/badge/Open-GitHub%20Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white)](https://github.com/xingxinag/weixin-gzh/settings/pages)

说明：

- `GitHub Pages` 也没有像 Vercel 那样的官方 README 一键部署按钮
- 这里提供的是当前仓库 Pages 设置页的快速入口
- 打开后可以直接配置 Pages 发布来源或查看 Actions 部署结果

#### Cloudflare Worker Proxy 入口

[![Open Cloudflare Workers](https://img.shields.io/badge/Open-Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflareworkers&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages)

说明：

- 如果你准备启用 `worker-proxy` 模式，可以从这里进入 Cloudflare 的 `Workers & Pages`
- 然后按本文后面的 `Cloudflare Worker 作为 API 代理` 一节配置 `NEWAPI_BASE_URL` 和 `NEWAPI_API_KEY`

如果你还希望隐藏真实的 `New API Key`，避免前端浏览器直接暴露密钥，推荐：

1. 前端页面部署到 `Cloudflare Pages` 或 `Vercel`
2. 同时使用 `Cloudflare Worker Proxy`
3. 前端把 API 地址填写成你自己的 `/api`

### 构建路径说明

项目里的 `vite.config.ts` 已经做了多平台兼容，不再固定写死 `/md/`。

当前规则如下：

- 如果设置了 `PUBLIC_BASE_PATH`，优先使用这个值
- 如果检测到 `VERCEL`、`CF_PAGES` 或 `SERVER_ENV=NETLIFY`，自动使用根路径 `/`
- 如果检测到 `GITHUB_ACTIONS=true`，会自动按仓库名生成 `/<repo-name>/`
- 其他情况默认使用 `/`

这意味着：

- `Vercel` 和 `Cloudflare Pages` 通常不需要额外改路径
- `GitHub Pages` 会自动适配仓库子路径
- 如果你有自定义反向代理或子目录部署需求，可以显式设置 `PUBLIC_BASE_PATH`

### 方案一：部署到 Vercel

这是最省事的静态部署方案之一，适合快速上线。

#### 方式 1：在 Vercel 控制台直接部署

1. 打开 Vercel
2. 选择 `Add New Project`
3. 导入当前 GitHub 仓库
4. 构建命令保持默认或填写：`npm run build`
5. 输出目录填写：`dist`
6. 如果需要，添加环境变量：`PUBLIC_BASE_PATH=/`
7. 点击部署

#### 你需要确认的配置

- Build Command: `npm run build`
- Output Directory: `dist`
- Node 版本建议：`20`

#### 如果你想用 GitHub Actions 自动部署到 Vercel

仓库里已经加入工作流文件：

- `.github/workflows/deploy-vercel.yml`

你需要在 GitHub 仓库里配置以下 Secrets：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

配置完成后，推送到 `main` 分支即可自动部署。

### 方案二：部署到 Cloudflare Pages

这是我更推荐的纯静态站点部署方式之一，速度快，配合 Worker 也很顺手。

#### 方式 1：在 Cloudflare Pages 控制台直接部署

1. 登录 Cloudflare
2. 进入 `Workers & Pages`
3. 创建 `Pages` 项目
4. 连接当前 GitHub 仓库
5. 构建命令填写：`npm run build`
6. 输出目录填写：`dist`
7. 环境变量建议填写：`PUBLIC_BASE_PATH=/`
8. 保存并部署

#### 你需要确认的配置

- Build Command: `npm run build`
- Build Output Directory: `dist`
- Environment Variable: `PUBLIC_BASE_PATH=/`

#### 如果你想用 GitHub Actions 自动部署到 Cloudflare Pages

仓库里已经加入工作流文件：

- `.github/workflows/deploy-pages.yml`

你需要在 GitHub 仓库里配置以下 Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

你还可以配置一个可选的 GitHub Repository Variable：

- `CLOUDFLARE_PAGES_PROJECT`

如果不配这个变量，工作流默认会尝试使用：`weixin-gzh`

### 方案三：部署到 GitHub Pages

如果你只是想把前端页面挂到 GitHub Pages，这个项目也已经兼容。

仓库中已有现成工作流：

- `.github/workflows/build.yml`

因为 `vite.config.ts` 已经做了自动 base 处理，所以在 GitHub Actions 环境下会自动变成：

```text
/<repo-name>/
```

这意味着你不需要再手工改以前那种 `/md/` 固定路径。

### 方案四：Cloudflare Worker + Static Assets

如果你希望页面和代理逻辑都放在 Cloudflare 体系内，也可以直接用 Worker 托管静态资源。

仓库里已经加入：

- `wrangler.toml`
- `worker/index.ts`

这个模式下：

- `dist` 会作为静态资源目录
- Worker 会优先处理 `/api/*`
- 其他页面资源交给静态资源服务

当前 `wrangler.toml` 已配置：

- `assets.directory = "./dist"`
- `not_found_handling = "single-page-application"`
- `run_worker_first = ["/api/*"]`

这对单页应用是合适的。

### 方案五：使用 Cloudflare Worker 作为 API 代理

这是最推荐和 AI 功能一起使用的安全方案。

目的有三个：

1. 前端浏览器不直接暴露真实 API Key
2. 前端统一请求你自己的 `/api/*`
3. Worker 代你转发到真正的 New API / OpenAI-compatible 服务

仓库中代理入口文件是：

- `worker/index.ts`

它现在会：

- 接收 `/api/*` 请求
- 自动把请求转发到你的真实上游
- 在服务端注入 `Authorization: Bearer <NEWAPI_API_KEY>`
- 其他非 `/api/*` 请求继续返回静态页面资源

#### Worker 必需的环境变量 / Secrets

你至少要配置：

- `NEWAPI_BASE_URL`
- `NEWAPI_API_KEY`

含义如下：

- `NEWAPI_BASE_URL`
  你的真实上游接口根地址，例如：`https://your-newapi-host.example.com`
- `NEWAPI_API_KEY`
  真实调用上游模型服务使用的密钥

#### 前端如何配合代理模式

现在前端 AI 设置已经支持两种模式：

1. `direct`
2. `worker-proxy`

如果你使用 Worker 代理，前端应这样设置：

- 连接模式：`worker-proxy`
- Base URL：填你自己站点的代理地址，例如：

```text
https://your-domain.example.com/api
```

- API Key：可以留空

这样前端最终会请求：

- `/api/v1/models`
- `/api/v1/chat/completions`
- `/api/v1/embeddings`
- `/api/v1/moderations`
- `/api/v1/images/generations`

然后由 Worker 自动继续转发到真实上游。

### 什么时候用直连，什么时候用代理

#### 适合直连 `direct`

- 你只是本地自己临时使用
- 你明确接受浏览器保存 API Key
- 你已经有自己的受控网关地址

#### 适合代理 `worker-proxy`

- 你要把站点公开部署出去
- 你不希望 API Key 暴露在浏览器里
- 你希望后续能统一切换上游服务地址
- 你希望多人访问时由服务端统一管理密钥

### 当前仓库里和部署相关的文件

- `vite.config.ts`
  处理不同平台的 `base` 路径
- `vercel.json`
  处理 Vercel 单页应用路由回退
- `wrangler.toml`
  定义 Worker + 静态资源部署方式
- `worker/index.ts`
  处理 `/api/*` 代理逻辑
- `public/_redirects`
  处理 Pages/静态托管下的 SPA 回退和 `/api/*` 路由
- `.github/workflows/deploy-vercel.yml`
  GitHub Actions 自动部署到 Vercel
- `.github/workflows/deploy-pages.yml`
  GitHub Actions 自动部署到 Cloudflare Pages
- `.github/workflows/build.yml`
  GitHub Pages 部署流程

### 推荐部署组合

如果你问我“默认应该怎么上”，我建议：

1. 页面：`Cloudflare Pages`
2. 代理：`Cloudflare Worker Proxy`
3. 前端连接模式：`worker-proxy`

这是当前这套代码里最平衡的方案：

- 部署简单
- 访问快
- API Key 不暴露
- 后续最好维护

如果你只想最快上线而不折腾代理：

1. 页面：`Vercel`
2. 前端连接模式：`direct`
3. 直接填写兼容 OpenAI 的上游地址和 API Key

### 部署后建议自检

部署完成后，建议至少检查下面这些：

1. 页面是否能正常打开，没有资源 404
2. AI 设置弹窗能否正常保存
3. `/v1/models` 是否可以正常获取模型列表
4. 聊天能力测试是否成功
5. 如果使用代理模式，确认浏览器里没有直接暴露真实上游 API Key
6. 生成内容时，请求体里的 `max_tokens` 是否为数字而不是字符串

如果你后续要继续完善线上体验，我建议再做两件事：

1. 清理当前构建里的 `minio` 浏览器兼容警告
2. 在 Worker 代理层补更细的限流、错误日志和白名单控制

# 🚀 重磅升级：微信公众号 Markdown 编辑器 × DeepSeek 超智能创作引擎

## 🌟 划时代升级：接入 DeepSeek 千亿参数大模型

**行业首创！** 我们独家接入 DeepSeek 最新一代千亿参数大模型，带来革命性的 AI 创作体验！这是目前中文领域最强大的创作型 AI，具备：

🔥 **行业顶尖的语义理解** - 精准把握文章深层含义
🚀 **百倍于 GPT-3 的创作效率** - 秒级生成优质内容
🌟 **多模态内容生成** - 图文并茂的智能创作
🎯 **垂直领域深度优化** - 特别针对中文写作场景训练

## DeepSeek 核心能力全景展示

### 1\. 智能创作黑科技

<div align="center">

![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_png%2FLOkSMmZPGEKmAEfZX6lweiaJRrApg3Hl50XwZkVQl7GVofsqVOlOLaBxA3neE0KRBAth1d5gfeejxLgia91D7G5Q%2F640%3Fwx_fmt%3Dpng%26from%3Dappmsg)

</div>

**体验超越人类的创作能力：**

- • 单次生成 5000+ 字长文不卡顿
- • 支持 20+ 种专业领域写作（法律/医疗/金融等）
- • 10 秒完成万字文章结构搭建

- • 智能引用最新行业数据（截至 2025 年 2 月# 🚀 重磅升级：微信 Markdown 编辑器 × DeepSeek 超智能创作引擎

- <div align="center">

  ![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_png%2FLOkSMmZPGEKmAEfZX6lweiaJRrApg3Hl51aKXiaQ8MxEcBfYpO1AGq7nReBia050EBEoibZqLePet7icHib2xJwibGuwg%2F640%3Fwx_fmt%3Dpng%26from%3Dappmsg)

  </div>

  <div align="center">

  ![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_png%2FLOkSMmZPGEKmAEfZX6lweiaJRrApg3Hl5NpIoibjiaajGL9MoS04VIGXCK0PMhwQxkjpE3t86TPQnwlpicqcm0NLeA%2F640%3Fwx_fmt%3Dpng%26from%3Dappmsg)

  </div>

## 🌟 划时代升级：接入 DeepSeek 千亿参数大模型

**行业首创！** 我们独家接入 DeepSeek 最新一代千亿参数大模型，带来革命性的 AI 创作体验！这是目前中文领域最强大的创作型 AI，具备：

🔥 **行业顶尖的语义理解** - 精准把握文章深层含义
🚀 **百倍于 GPT-3 的创作效率** - 秒级生成优质内容
🎨 **多模态内容生成** - 图文并茂的智能创作
🎯 **垂直领域深度优化** - 特别针对中文写作场景训练

## 💥 DeepSeek 六大核爆级功能

### 1\. 智能创作加速器

**「DeepSeek 模式」开启后：**

✨ 输入 3 个关键词 → 自动生成 10 个爆款标题
🚀 选中段落 → 智能扩展 3 种不同文风版本
💡 空白文档 → 30 秒产出完整文章大纲

### 2\. 全链路内容优化

**从词句到战略的全维度提升：**

🔍 SEO 优化 | 💬 情感分析 | 📈 传播力预测 | ⚠️ 风险检测`   `

## 🎨 Markdown 编辑器超能力

### 实时双屏预览

**左边写作 右边即得** - 支持 20+ 种公众号主题模板，所见即所得：

<div align="center">

![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_png%2FLOkSMmZPGEKmAEfZX6lweiaJRrApg3Hl5sPk98Iyia7eicjiaZNPwuM1WviaqWT9hkjtgpV7m3JmhESfuS28WRAnyEQ%2F640%3Fwx_fmt%3Dpng%26from%3Dappmsg)

</div>

### 智能样式引擎

✅ 自动转换微信特殊格式
🎭 智能匹配最佳配色方案
📊 表格自动优化为精美样式

<div align="center">

![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_png%2FLOkSMmZPGEKmAEfZX6lweiaJRrApg3Hl5lw1mBicJmZMwibHxehbcLuRicM8Nj4C51rpcjpgdCPYNC3XNlibTMvXFnQ%2F640%3Fwx_fmt%3Dpng%26from%3Dappmsg)

</div>

## 🚀 行业解决方案

**专属功能矩阵：**

📰 新媒体爆文生成器（10秒产出热点推文）
📈 专业行业报告助手（自动生成数据图表）
🎥 短视频脚本工厂（分镜+台词+运镜指导）
🛒 电商文案生产线（百种营销话术模板）

## 💎 为什么选择我们？

**对比传统写作工具：**

✅ 创作效率提升 500%
✅ 爆文率提高 300%
✅ 排版时间节省 90%

## 创作者生态

**已服务：**

- • 1000+ 头部公众号

- • 200+ 上市公司

- • 50+ 出版机构

**用户证言：**

> "接入 DeepSeek 后创作效率提升 300%，爆文率翻倍！" —— 某百万粉科技大 V
> "完全改变了我们的内容生产流程" —— 某知名出版社总编

---

**创作不止于文字：**

- • 智能配图推荐（基于文章内容生成图片描述）
- • 数据可视化自动生成（表格 → 图表转换）
- • 公众号样式智能匹配

- • 多平台适配优化

**专属功能矩阵：**

- • 新媒体爆文生成器

- • 专业行业报告助手

- • 短视频脚本工厂

- • 电商文案生产线

## 💥 颠覆性体验

### 1\. 智能创作加速器

**「DeepSeek 模式」开启后：**

- • 输入 3 个关键词 → 自动生成 10 个爆款标题

- • 选中段落 → 智能扩展 3 种不同文风版本

- • 空白文档 → 30 秒产出完整文章大纲

### 2\. 全链路内容优化

**从词句到战略的全维度提升：
SEO 优化 | 情感分析 | 传播力预测 | 风险检测**

## 🎁 限时专属福利

**现在体验即享：**

- • DeepSeek 千亿模型免费使用权（使用全免费）

- • 专业版 AI 创作模板大礼包

- • VIP 客服优先支持通道

> 🔥 扫码立即体验 DeepSeek 的超能力 ↓
>
> <div align="center">
>
> ![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_jpg%2FLOkSMmZPGEIKL1M7WmtbegibSL8SuqvEN3Ix5OGvhEGRR95ibgGDFVhvHp4NNIv0xlVdRk8u0icknmyd9LDPgUrjw%2F640%3Fwx_fmt%3Djpeg%26from%3Dappmsg)
>
> </div>
>
> 微信交流群

## 🛠️精美模板-所见即所得

<div align="center">

![](https://images.weserv.nl/?url=https%3A%2F%2Fmmbiz.qpic.cn%2Fsz_mmbiz_png%2FLOkSMmZPGEIKL1M7WmtbegibSL8SuqvENS0VMlTR6a2vEJL79gOw5COoj3M4EuND66icQVPvzSIia0yrUTia50B8Jw%2F640%3Fwx_fmt%3Dpng%26from%3Dappmsg)

</div>
