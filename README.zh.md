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

点击输入栏的模型名打开面板。拖动滑块时可以预览档位，松开才提交；也可以让滑杆获得键盘焦点，再用方向键调整。点击面板中央的模型名可切换模型，右上角的回转箭头可恢复当前模型的默认档位。按 `Esc` 或点击面板外部即可关闭。

最高档使用蓝紫渐变和星点标识；开启系统的「减少动态效果」后，动画会停止。插件不会添加提供方未声明的档位，也不提供独立的快速模式。

选择通过 DSH 原生接口生效：影响当前会话的后续请求，也可能更新新会话的默认选择，不会改变已发出的请求。禁用插件即可恢复原生选择器。

## 开发

在仓库根目录运行：

```sh
node build.mjs
node --test controller.test.mjs
```

## 许可证

[MIT](LICENSE)
