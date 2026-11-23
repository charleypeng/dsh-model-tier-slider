# charleypeng/dsh-model-tier-slider

**English** · [简体中文](README.zh.md)

Adjust reasoning effort in the DeepSeek Harness composer with a slider. The slider shows the levels supported by the current model, and the model picker groups models by provider.

## Installation

For the desktop and web composer in DeepSeek Harness 0.2.2-rc.5. Clone the repository, then open **Plugins → Add plugin** in DSH and select the `dsh-model-tier-slider` directory. No build step is required.

```sh
git clone https://github.com/charleypeng/dsh-model-tier-slider.git
```

If you have the older `@local/model-tier-replica` installed, disable it first. Both plugins replace the same model selector.

## Usage

Click the model name in the composer to open the panel. Drag the thumb to follow the pointer continuously; on release it settles onto the nearest level and submits once. You can also focus the slider and use the arrow keys, `Home`, or `End`. Click the model name in the middle of the panel to switch models. The reset arrow in the upper-right corner restores the current model’s default effort. Press `Esc` or click outside to close the panel.

A blue-to-purple gradient with stars marks the highest level. The animation stops when your system’s reduced-motion setting is on. The plugin does not add unsupported effort levels or a separate fast mode.

Changes use DSH’s native model selector API. They apply to future requests in the current session and may also update the default for new sessions. Requests already sent are unaffected. Disable the plugin to restore the built-in selector.

## Development

From the repository root, build the plugin and run its tests:

```sh
node build.mjs
node --test controller.test.mjs
```

## License

[MIT](LICENSE)
