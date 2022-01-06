const StylesProviderCache = window.StylesProviderCache || {
  contents: new Map(),
  dependencies: new Map(),
  providers: new Map()
};

const create = (filter, container, name) => () => Array.from(StylesProviderCache.contents.keys())
  .filter(id => filter.test(id))
  .forEach(id => {
    useStyle(id)(container)[name]()
  });

export function setStyle(id, content) {
  StylesProviderCache.contents.set(id, content);

  if (!StylesProviderCache.dependencies.has(id)) {
    StylesProviderCache.dependencies.set(id, new Set());
  }

  StylesProviderCache.dependencies.get(id).forEach(provider => {
    provider.update();
  });
}

export function hasStyle(id) {
  return StylesProviderCache.contents.has(id);
}

export function deleteStyle(id) {
  StylesProviderCache.dependencies.get(id)?.forEach(provider => {
    provider.unmount();
    provider.unload();
  });
  return StylesProviderCache.contents.delete(id);
}

export function getStyle(id) {
  return StylesProviderCache.contents.get(id);
}

export function useQueryStyle(query) {
  const filter = new RegExp(`^(${query.replace(/\*+/g, '.*').split(',').join('|')})$`)
  return container => ({
    mount: create(filter, container, 'mount'),
    unmount: create(filter, container, 'unmount'),
    unload: create(filter, container, 'unload')
  })
}

export function useStyle(id) {
  if (StylesProviderCache.providers.has(id)) {
    return StylesProviderCache.providers.get(id);
  }

  StylesProviderCache.providers.set(id, function styleProvider(container = document.head) {
    let style;
    const provider = {
      mount: () => {
        if (container) {
          style = document.createElement('style');
          style.dataset.id = id;
          container.appendChild(style);
          provider.update();
        }
      },
      update: () => {
        if (style) {
          const content = getStyle(id);

          if (typeof content !== 'string') {
            throw new Error(`Style not found: ${id}`);
          }

          style.innerHTML = content;
        }
      },
      unmount: () => {
        if (container && style) {
          container.removeChild(style);
          style = null;
        }
      },
      unload: () => {
        container = null;
        style = null;
        StylesProviderCache.dependencies.get(id).delete(provider);
      }
    };

    StylesProviderCache.dependencies.get(id)?.add(provider);

    return provider;
  });

  return StylesProviderCache.providers.get(id);
}

window.StylesProviderCache = StylesProviderCache;