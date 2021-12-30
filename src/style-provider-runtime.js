const contents = Symbol('contents');
const dependencies = Symbol('dependencies');
const providers = Symbol('providers');

export class StylesProvider {
  constructor() {
    this[contents] = new Map()
    this[dependencies] = new Map()
    this[providers] = new Map();
  }

  set(id, content) {
    this[contents].set(id, content);

    if (!this[dependencies].has(id)) {
      this[dependencies].set(id, new Set());
    }

    this[dependencies].get(id).forEach(provider => {
      provider.mount();
    });
  }

  has(id) {
    return this[contents].has(id);
  }

  delete(id) {
    this[dependencies].get(id)?.forEach(provider => {
      provider.unmount();
      provider.unload();
    });
    return this[contents].delete(id);
  }

  entries() {
    return this[contents].entries();
  }

  get(id) {
    return this[contents].get(id);
  }

  import(id) {
    if (this[providers].has(id)) {
      return this[providers].get(id);
    }

    this[providers].set(id, (container = document.head) => {
      let style;
      const provider = {
        mount: () => {
          if (!container) {
            return;
          }

          if (!this.has(id)) {
            throw new Error(`Style not found: ${id}`);
          }

          const content = this.get(id);

          if (style) {
            style.innerHTML = content;
          } else {
            style = document.createElement('style');
            style.innerHTML = content;
            container.appendChild(style);
          }

          this[dependencies].get(id)?.add(provider);
        },
        unmount: () => {
          if (container && style) {
            container.removeChild(style);
            style = null;
            this[dependencies].get(id).delete(provider);
          }
        },
        unload: () => {
          container = null;
          style = null;
        }
      };

      return provider;
    });

    return this[providers].get(id);
  }
}

const stylesProvider = window.stylesProvider || new StylesProvider();

if (!window.stylesProvider) {
  window.stylesProvider = stylesProvider;
}

export default stylesProvider;
