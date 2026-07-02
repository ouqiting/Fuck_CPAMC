# Clean management.html Builder

自动从上游 [Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center) 拉取最新代码，移除内置捆绑的中转站入口（侧边栏"快速开始"导航项 + 仪表盘快速开始卡片），构建出干净的 `management.html`。

> 上游自 v1.17.2（2026-06-24）起硬编码了中转站，且没有任何关闭开关。本工具只隐藏其入口，不删除底层功能，保证随上游更新不报错。

## 文件说明

| 文件 | 作用 |
|------|------|
| `patch.cjs` | 补丁脚本：移除 `MainLayout.tsx` 和 `DashboardPage.tsx` 中的 中转站 入口，自动适配 CRLF/LF，幂等可重复运行，打完后验证无残留 |
| `build-local.py` | 本地一键构建：clone → 安装依赖 → 打补丁 → 构建 → 输出 `management.html` |
| `build-local.ps1` | windows 环境下一键运行的脚本。功能一致 |
| `.github/workflows/build-clean.yml` | GitHub Actions 云端构建：手动触发或每周一自动触发，产物作为 artifact 下载 |

## 方式一：直接填写url （推荐）

### 本仓库会每隔三天检查并自动修补上游版本，发布到 Release 。所以你只需要将 config.yaml 中的 panel-github-repository 修改为 "https://github.com/ouqiting/Fuck_CPAMC" 即可正常使用。


## 方式二：GitHub Actions 云端运行

### 步骤

1. Clone 本仓库
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

```python
python build-local.py
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
```



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
- `src/pages/DashboardPage.tsx`：仪表盘"快速开始"卡片

脚本带验证机制：打完后检查残留引用，若上游代码改动导致匹配失败会明确报出哪个补丁 SKIP 并 `exit 1` 阻止构建，提示人工检查。
