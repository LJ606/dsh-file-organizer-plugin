# dsh-file-organizer-plugin

DeepSeek Harness (dsh) 代码插件，Cordis 插件形态。和任何个人经历无关：只做桌面文件整理，谁的文件夹乱了都能用。

> 状态：DSH 本身还在 developer preview，API 可能变。本插件按 2026-11-09 查到的官方文档写成，并用真实的 `@deepseek-ai/dsh-tools@0.0.1-rc.1` 跑通过加载和调用。

## 3 个工具

| 工具 | 输入 | 输出 | 说明 |
|---|---|---|---|
| `scan_folder` | path（必填）、maxDepth | 按类型/大小统计、总字节、最大的 5 个文件 | 只读 |
| `find_duplicates` | path（必填）、maxDepth | 重复组、每组文件、可回收字节 | 先按大小分组，再对同大小的文件算 SHA-256；超 50MB 的只按大小+文件名分组 |
| `plan_organize` | path、strategy（by-type 默认 / by-date） | 拟移动清单 | **只出方案，不动文件**。dryRun 恒为 true，先看方案再决定 |

安全规则：路径必须是已存在的目录；不跟随符号链接；跳过隐藏文件；单次最多扫 500 个文件。

## 目录

```
dsh-file-organizer-plugin/
├── package.json          # dsh.bundle 声明，engines.dsh >=0.2.0 <0.3.0
├── cordis.patch.yml      # bundle 的 patch 层
├── index.js              # 上线入口：纯 JS，无需 build（git 安装不跑 build）
├── src/
│   ├── core.js           # 纯逻辑：scanFolder / findDuplicates / planOrganize
│   └── index.ts          # TypeScript 对照版
├── test/
│   └── test.mjs          # mock 测试，不需要 Harness、不需要 Key
└── README.md
```

## 安装

前置：Node.js >= 18，已装好 `dsh` CLI。

```bash
dsh plugin --profile demo add ./dsh-file-organizer-plugin
dsh --profile demo --dump-config   # 应能看到 "# == dsh-file-organizer-plugin" 一层
dsh --profile demo
```

打开 `http://127.0.0.1:3080`，问：

> 用 scan_folder 扫一下我的下载文件夹 /Users/xxx/Downloads，再用 find_duplicates 看看有没有重复，最后用 plan_organize 按类型给我一个整理方案，先不要动文件。

模型会依次调工具，先给你统计和方案，你确认后才动手。

## 本地验证（已跑通过）

```bash
cd dsh-file-organizer-plugin
node test/test.mjs   # 或 npm test
```

2026-11-09 实测，测试用的全是中性文件（周末照片、待办 txt、幻灯片、音乐、3 份内容相同的 txt）：

- `scan_folder`：8 个可见文件，Images 2、Documents 5、Audio 1，最大是 song.mp3；隐藏文件正确跳过。
- `find_duplicates`：1 组重复（3 份相同 txt），可回收 2 倍文件大小。
- `plan_organize`：dryRun true，8 条拟移动，跑完后原文件一个没动。
- 用真实 `@deepseek-ai/dsh-tools@0.0.1-rc.1` 加载 `index.js`：3 个工具注册成功，`execute` 直接调用返回正确结果。

没验证的部分：完整的 dsh Web UI 端到端（需要 clone harness 仓库 + pnpm install + 配 DeepSeek API Key）。上面安装命令是按官方文档写的，在这台机器上没跑全套 UI。

## 许可证

Apache-2.0
