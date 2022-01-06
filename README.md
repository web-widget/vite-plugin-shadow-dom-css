# vite-plugin-shadow-dom-css

Vite Shadow DOM CSS 插件。

虽然 Web Components 充满了希望，但如今要在工程中使用它将会面临非非常多的问题，而样式的工程化首当其冲。Vite 与其他流行构建工具并没有很好的解决这样的问题，而开发社区中只有零星的文章讨论到它，所以这个插件是一次解决问题的尝试。

- 能够将 CSS 插入到 Shadow DOM 中
- 开发环境支持热更新

## 问题

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

## 使用

```js
// vite.config.js
import { defineConfig } from 'vite'
import shadowDomCss from 'vite-plugin-shadow-dom-css'

export default defineConfig({
  plugins: [shadowDomCss()]
})
```

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