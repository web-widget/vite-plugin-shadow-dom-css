# vite-plugin-shadow-dom-css

Vite Shadow DOM CSS 插件。

虽然 Web Components 充满了希望，但如今要在工程中使用它将会面临非非常多的问题，而样式的工程化首当其冲。Vite 与其他流行构建工具并没有很好的解决这样的问题，而开发社区中只有零星的文章讨论到它，所以这个插件是一次解决问题的尝试。

- 能够将 CSS 插入到 Shadow DOM 中
- 开发环境支持热更新

## 为什么要使用此插件

当你试图使用 Vite 作为构建工具来编写和 Web Components 相关的组件的时候，你会发现样式永远无法生效： 

```js
import myStyle from './my-style.css';
export class MyElement extends HTMLElement {
  constructor() {
    this.attachShadow({ mode: 'open' });
    myStyle(this.shadowRoot).mount();
    this.shadowRoot.innerHTML = `
      <h1>Hello world</h1>
    `;
  }
}
customElements.define('my-element', MyElement);
```

```html
<html>
  <head>
    <style>
      /*...*/
    </style>
  </head>
  <body>
    <my-element>
      #shadow-root
      	<h1>Hello world</h1>
    </my-element>
  </body>
</html>
```

在开发模式中，我们会在 `<head>` 中得到由 Vite 生成的 `<style>`；在生产模式中，我们将得到 .css 文件，这些 .css 文件需要有我们额外通过 `<link>` 标签输出。这两种模式都不能让 CSS 工作在 Shadow DOM 中，因为 Shadow DOM 是一个隔离的样式环境。

### 使用 CSS in JS

要解决这样的问题，你需要使用 `CSS in JS` 的方案，它对 Shadow DOM 非常友好。

```js
import myStyle from './my-style.css?inline';
export class MyElement extends HTMLElement {
  constructor() {
    this.attachShadow({ mode: 'open' });
    myStyle(this.shadowRoot).mount();
    this.shadowRoot.innerHTML = `
      <h1>Hello world</h1>
      <style>${myStyle}</style>
    `;
  }
}
customElements.define('my-element', MyElement);
```

```html
<my-element>
  #shadow-root
    <h1>Hello world</h1>
    <style>
      /*...*/
    </style>
</my-element>
```

### 问题

#### 依赖失去控制

并不是所有的外部组件都使用了 CSS in JS，这些组件会导致我们需要花费大量的时间处理样式丢失问题：

```js
import '@ui/my-button';
```

```js
// @ui/my-buttom
import './style.css';
// ...
```

#### 无法热更新

当使用 `inline` CSS 后，Vite 的热更新与自动刷新功能都无法工作。

## 使用

```js
// vite.config.js
import { defineConfig } from 'vite'
import shadowDomCss from 'vite-plugin-shadow-dom-css'

export default defineConfig({
  plugins: [shadowDomCss()]
})
```

配置插件后，它通过虚拟路径 `virtual:style-provider` 来管理样式。

### 引入 CSS

```js
import myStyle from './my-style.css?style-provider';

export class MyElement extends HTMLElement {
  constructor() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = '<h1>Hello world</h1>';
    myStyle(this.shadowRoot).mount();
  }
}
customElements.define('my-element', MyElement);
```

### 查询 CSS

支持使用虚拟模块 `virtual:style-provider?query=${query}` 查询 CSS：

`${query}` 支持的语法：

* `*`: 通配符
* `,`: 分割符
* `~`: 包的根目录

示例：

```js
// 所有样式
import allStyle from `virtual:style-provider?query=*`;
// 当前包下的所有样式
import packageAllStyle from `virtual:style-provider?query=~/*`;
// 指定多个样式
import selectStyle from `virtual:style-provider?query=@ui/dialog/*,@ui/button/*`;

allStyle(document.head).mount();
packageAllStyle(document.head).mount();
selectStyle(document.head).mount();
```

## 配置

* `include`
* `exclude`


## CSS API

```ts
type StyleProvider = {
  mount(): void;
  unmunt(): void;
  unload(): void
}
```