# charleypeng/dsh-model-tier-slider

[English](README.md) · **简体中文**

用滑杆调整 DeepSeek Harness 的推理档位，无需离开输入栏。可选档位由当前模型提供方决定；切换模型时，列表按提供方分组展示。

## 安装

适用于 DeepSeek Harness 0.2.2-rc.5 的桌面和 Web 输入栏。克隆仓库后，在 DSH 的「插件 → 添加插件」中选择 `dsh-model-tier-slider` 目录，无需先构建。

```sh
git clone https://github.com/charleypeng/dsh-model-tier-slider.git
```

如果安装过旧版 `@local/model-tier-replica`，请先禁用它，避免两个插件占用同一个模型入口。

## 使用

点击输入栏的模型名打开面板。拖动滑块时位置连续跟手，松手后才吸附到最近一档并提交一次；也可以让滑杆获得键盘焦点，用方向键、`Home`、`End` 调整。点击面板中央的模型名可切换模型，右上角的回转箭头可恢复当前模型的默认档位。按 `Esc` 或点击面板外部即可关闭。

最高档使用蓝紫渐变和星点标识；开启系统的「减少动态效果」后，动画会停止。插件不会添加提供方未声明的推理档位。

### Codex Fast

如果 DSH Host 上有支持 Fast 的 Codex 桥接，且当前账号的模型目录明确为当前模型声明 Fast，面板左上角才会显示闪电。点亮闪电后滑轨会出现流动星点，后续推理会请求 `service_tier: "priority"`。此设置和推理档位独立，仅作用于当前会话的该模型，默认关闭；开启可能更快消耗 Codex 额度。服务端实际采用的档位可能与请求不同。

滑杆不自行处理 Codex 登录、不读取密钥，也不向 OpenAI 直接发推理请求。未安装兼容桥接时，普通档位滑杆仍可使用。公共 API Key 路线的 Fast 按 [OpenAI API 定价](https://developers.openai.com/api/docs/guides/fast-mode) 计费，不由此开关控制。Codex 的能力检测与请求值见 [Codex 原生实现](https://github.com/openai/codex/pull/21745)。

选择通过 DSH 原生接口生效：影响当前会话的后续请求，也可能更新新会话的默认选择，不会改变已发出的请求。禁用插件即可恢复原生选择器。

### 按提供方配置快捷项

[速度配置](speed-profiles.json)按 DSH 的提供方 ID 和模型 ID 精确匹配。内置预设覆盖经核对的智谱 GLM 和百炼 Token Plan 路线；模型目录仍须提供所选档位。快捷项位于滑轨下方，点了才生效。快捷档位不等于 Fast，也不保证延迟或用量变化。

自定义路线可在 `providers.<提供方 ID>.models.<模型 ID>` 指定 `lighterEffort`（可用档位 ID，或 `false` 禁用）和 `alternateModel`（同一提供方目录中备选模型的 ID）。只有目标在当前目录可用时才显示。提供方级 `lighterEffort` 可作为默认；`showLighterEffort` 默认关闭未知路线的档位推断。修改配置后运行 `node build.mjs`，刷新已链接的插件页面加载新产物。选择档位或备选模型沿用 DSH 原生选择语义，不会被当成优先服务。

## 开发

在仓库根目录运行：

```sh
node build.mjs
node --test controller.test.mjs
```

## 许可证

[MIT](LICENSE)
