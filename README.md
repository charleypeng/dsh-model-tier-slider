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

A blue-to-purple gradient with stars marks the highest level. The animation stops when your system’s reduced-motion setting is on. The plugin does not add unsupported effort levels.

### Codex Fast

The lightning toggle appears only when a compatible Codex bridge is running on the DSH Host and the signed-in account’s catalog explicitly advertises Fast for the current model. Turning it on animates stars in the rail and requests `service_tier: "priority"` on subsequent inference. It is separate from reasoning effort, applies only to that model in the current session, and is off by default. Fast may consume Codex allowance more quickly. The service tier actually used can differ from the requested tier.

The slider does not handle sign-in, read credentials, or send requests directly to OpenAI. Without a compatible bridge, the regular reasoning slider still works. The public API-key route uses [OpenAI API Fast pricing](https://developers.openai.com/api/docs/guides/fast-mode); this toggle does not control that route. See [Codex’s catalog and request implementation](https://github.com/openai/codex/pull/21745) for how the native client selects the tier.

Changes use DSH’s native model selector API. They apply to future requests in the current session and may also update the default for new sessions. Requests already sent are unaffected. Disable the plugin to restore the built-in selector.

### Configure provider shortcuts

[Speed profiles](speed-profiles.json) match exact DSH provider and model IDs. Presets cover verified Z.AI GLM and Qwen Token Plan routes, subject to the levels reported by the live catalog. Shortcuts appear below the slider and apply only when clicked. A lower reasoning setting is not Fast mode and does not guarantee a change in latency or usage.

Under `providers.<provider ID>.models.<model ID>`, set `lighterEffort` to an available effort ID (or `false` to disable it) and optionally set `alternateModel` to another model ID in the same provider’s catalog. The provider-level `lighterEffort` can supply a default. `showLighterEffort` defaults to off for routes without a profile. After editing, run `node build.mjs` and refresh the page loading the linked plugin. Shortcuts use native DSH selection, not a priority service tier.

## Development

From the repository root, build the plugin and run its tests:

```sh
node build.mjs
node --test controller.test.mjs
```

## License

[MIT](LICENSE)
