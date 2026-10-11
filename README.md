# Clean management.html Builder

自动从上游 [Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center) 拉取最新代码，移除内置捆绑的中转站入口（侧边栏"快速开始"导航项 + 仪表盘快速开始卡片 + AI 提供商页"快速接入"卡片 + `/quick-start` 路由），清掉各处赞助商/推广内容（OAuth 页的 Kimi 推荐大卡与"立即注册"药丸、提供商面板的 Kimi 注册链接、配置面板「代理 URL」下方的第三方赞助行），将 OAuth 登录中的 Kimi OAuth 改回普通样式，并把 OAuth 页的 Codex 卡片排到第一位，构建出干净的 `management.html`。

> 上游自 v1.17.2（2026-06-24）起硬编码了中转站，且没有任何关闭开关。本工具只隐藏其入口，不删除底层功能，保证随上游更新不报错。

## 文件说明

| 文件 | 作用 |
|------|------|
| `patch.cjs` | 补丁脚本：移除中转站入口并将 Kimi OAuth 改回正常样式，自动适配 CRLF/LF，幂等可重复运行，打完后验证无残留 |
| `build-local.cjs` | 本地一键构建（跨平台）：clone → 安装依赖 → 打补丁 → 构建 → 输出 `management.html` |
| `build-local.ps1` | windows 环境下一键运行的脚本。功能一致 |
| `.github/workflows/build-clean.yml` | GitHub Actions 云端构建：手动触发或每三天自动触发，产物自动上传 Release  |

## 方式一：直接填写url （推荐）

本仓库会每隔三天检查并自动修补上游版本，发布到 Release 。所以你只需要将 config.yaml 中的 panel-github-repository 修改为 
https://github.com/ouqiting/Fuck_CPAMC 即可正常使用。


## 方式二：GitHub Actions 云端运行

### 步骤

1. **Fork** 本仓库
2. 进入仓库 **Actions** 页面 → 选择 **Build Clean management.html** 工作流
3. 点击 **Run workflow** 手动触发，或等待每三天自动触发
4. 构建完成后，产物将自动推送到 Release


## 方式三：本地构建

### 前置要求

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)（18+）
- [Bun](https://bun.sh/)（1.3.14，与上游 `package.json` 的 `packageManager` 一致）

### 步骤

```powershell
.\build-local.ps1
```

```bash
node build-local.cjs
```

流程：

1. clone 上游最新代码到 `.build-tmp\repo\`
2. `bun install --frozen-lockfile` 安装依赖
3. `node patch.cjs` 打补丁隐藏 中转站 入口
4. `bun run build` 构建
5. 复制 `dist\index.html` 为 `output\management.html`
6. 清理 `.build-tmp\` 临时目录

完成后 `management.html` 在 `output\` 下。

### 可选参数

```powershell
.\build-local.ps1 -Branch main -OutputDir ".\output" -UpstreamUrl "https://github.com/router-for-me/Cli-Proxy-API-Management-Center.git"
.\build-local.ps1 -Tag v1.17.8
```

```bash
node build-local.cjs --branch main --output-dir "./output" --upstream-url "https://github.com/router-for-me/Cli-Proxy-API-Management-Center.git"
node build-local.cjs --tag v1.17.8
```

> 指定 `--tag` / `-Tag` 时拉取上游对应 tag 版本代码进行修补，优先级高于 `--branch`。



## 本地构建后的步骤

### 1. 替换后端面板文件

把生成的 `management.html` 复制到你的 CLI Proxy API 后端文件夹，覆盖原有文件。

### 2. 修改后端配置文件

编辑后端的 `config.yaml`，将 `disable-auto-update-panel` 设置为 `true`：

```yaml
disable-auto-update-panel: true
```

这会阻止后端自动下载并覆盖你替换的 `management.html`，否则后端启动/更新时会用官方版本（含 中转站 入口）覆盖你清理过的版本。

## 补丁说明

`patch.cjs` 精确移除以下入口（连同因移除而变成死代码的 import 和变量，确保 `tsc --noEmit` 通过）：

- `src/components/layout/MainLayout.tsx`：侧边栏"快速开始 / 中转站"导航项
- `src/pages/DashboardPage.tsx`（旧版本）或 `src/features/dashboard/DashboardPage.tsx`（v1.19+）：仪表盘"快速开始"卡片。上游在 v1.19+ 已重写仪表盘并移除该卡片，补丁会自动适配旧/新路径，保持对 `--tag` 旧版本的兼容。
- `src/features/providers/components/ProviderCategoryList.tsx`：AI 提供商页面中的"快速填入"中转站卡片（v1.19+ 新增），并把卡片里的中转站品牌从普通分类列表中一并移除。补丁通过正则抓取上游的品牌列表原样构建隐藏集合，因此上游后续新增的赞助商品牌也能自动适配，无需每次手工改补丁。
- `src/router/MainRoutes.tsx`（v1.20+）：上游新增的独立 `/quick-start` 中转站注册页面（SponsorQuickStartPanel）。侧边栏入口移除后这里就是唯一的残留入口，补丁将其重定向到 `/ai-providers`。旧版本没有该路由，对应补丁会自动 skip。
- `src/pages/OAuthPage.tsx`（v1.18.4+）：OAuth 登录中的 Kimi OAuth 特殊推荐卡片。上游自 v1.18.4 起将 Kimi 单独提取为置顶推荐卡片（带黑框、蓝色渐变背景、特殊按钮样式与推广注册按钮）；v1.24 起又把 `kimi-ai` 一并纳入，改用 `featuredProviders` 数组单独渲染一个区块。补丁会移除该置顶区块，把所有提供商（含 `kimi`、`kimi-ai`）合并回同一个普通卡片列表，从而不再套用任何特殊样式，也不会渲染推广注册按钮。旧版本若无该卡片会自动 skip。
- `src/pages/OAuthPage.tsx`（v1.17.2 - v1.22）：OAuth 授权对话框里的 Kimi"立即注册"推广按钮（打开带返利参数的 Kimi 推广页）。v1.23 起上游删掉了它，所以这三个 op 只在旧 tag 上生效。
- `src/features/oauth/providers.ts`（v1.26+）：上游在 v1.26 把 OAuth 目录抽成独立模块，并把 Kimi 的推荐卡泛化成"赞助商"概念——任何带 `sponsor.signUpUrl` 的提供商会独占首行大卡、套品牌蓝描边与渐变，并在卡片和授权对话框里常驻"立即注册"推广药丸。补丁在 `isSponsor` 前插入一个 `SPONSOR_CARDS_ENABLED: boolean = false` 开关并短路该判断，于是所有提供商（含 Kimi 两站）都回到普通网格、推广药丸全部消失；上游以后若再把别的提供商标成赞助商，也会一并失效，无需改补丁。
- `src/features/providers/` 下各赞助商模块：推广注册链接常量（`*_AFFILIATE_URL`）。AI 提供商面板标题行的"立即注册 / 点此注册"与 Kimi 的充值推广文案都由这些常量驱动，补丁把 URL 清空——面板只在 URL 非空时才渲染该链接，因此链接与文案整体消失，而代码路径（这些品牌本身的配置功能）原样保留。正则按 `AFFILIATE_URL` 命名匹配，上游改写 URL 或新增同名前缀常量都会一并清空；上游已删除的赞助商模块，对应 op 自动 skip。
- `src/features/config/sponsors.ts`（v1.23+）：配置面板「网络配置 → 代理 URL」下方的第三方赞助行（带返利参数的推广链接）。上游该模块的注释明确写了"数组为空时赞助行整体不渲染"，因此补丁直接清空 `SPONSORS` 数组并移除随之无用的 logo import。
- `src/pages/OAuthPage.tsx` / `src/features/oauth/OAuthPage.tsx`（v1.17.2+）：OAuth 卡片顺序。将 Codex OAuth 固定到第一位，原本排在它前面的卡片（meta、kimi、kimi-ai 等）整体轮转到列表末尾，插件提供的 OAuth 卡片仍保持在上游放置的最后位置。补丁只改 `providerCards` 这一处 memo，正则抓取列表变量名（v1.25.6 及以前是 `PROVIDERS`，v1.26 起是 `OAUTH_PROVIDERS`），上游将来新增或调整内置提供商时会自动适应：新加在 Codex 前面的卡片会自动轮转到末尾，加在后面的保持相对顺序。该 op 标记为 required，一旦上游重写这段 memo 会直接报错中止构建，而不会静默产出顺序未生效的版本。

脚本带验证机制：

- 打完后检查残留引用（侧边栏/仪表盘/快速填入/赞助商等标识符，以及推广链接的 URL 特征，如返利参数），命中即报 `[FAIL]` 并 `exit 1`。
- 顺序类与"关闭开关"类 op 标记为 `required`：若上游重写了它依赖的代码结构会报 `[MISSING]` 并 `exit 1` 阻止构建，避免静默产出功能未生效的版本；若该 op 是自己已经改过的（第二次运行），则通过 `alreadyApplied` 标记识别为 skip，脚本可重复运行。
- 若上游代码改动导致匹配失败，会明确报出哪个补丁 SKIP，提示人工检查。
- 兼容范围：v1.17.8 至 v1.26.1 均已验证可打完补丁并通过 `tsc --noEmit`。上游自带的 `bun test` 用例里有断言赞助商 UI 存在的测试（如 `tests/kimiOAuth.test.ts`），打了补丁后这些用例会失败——这是预期行为，构建流程（`bun run build`）不跑测试。

