import { readFile, writeFile } from 'node:fs/promises';
const at = name => new URL(name, import.meta.url);
const read = name => readFile(at(name), 'utf8');
const sources = await Promise.all(['controller.js','view.js','plugin.js'].map(read));
const css = await read('style.css');
const languages = await Promise.all(['en','zh'].map(async lang => [lang, JSON.parse(await read(`locale/${lang}.json`)).ui]));
const manifest = JSON.parse(await read('package.json'));
const body = sources.map(text => text.replace(/^export (?=function |const )/gm,'')).join('\n');
await writeFile(at('client.js'), `// Generated from controller.js, view.js, plugin.js, style.css and locale dictionaries.\nwindow.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory(require){\n${body}\nreturn makePlugin(require('react'),require('react-dom').createPortal,${JSON.stringify(css)},${JSON.stringify(Object.fromEntries(languages))});\n}});\n`);
