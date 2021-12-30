import path from 'path';
import fs from 'fs';
//import { createFilter } from '@rollup/pluginutils'
import type { PluginOption } from 'vite'

const FS_PREFIX = `/@fs/`
const queryRE = /\?.*$/
const hashRE = /#.*$/

const cleanUrl = (url: string) =>
  url.replace(hashRE, '').replace(queryRE, '')

function normalizeDevPath(root: string, id: string) {
  if (id.startsWith(root + '/')) {
    return id.slice(root.length)
  } else if (fs.existsSync(cleanUrl(id))) {
    return FS_PREFIX + id
  }
  return id
}

function parseLoader(id: string) {
  const loaders = id
    .replace(/^-?!+/, "")
    .replace(/!!+/g, "!")
    .split("!");
  const resource = loaders.pop() || '';
  return {
    loaders,
    resource
  };
}

export interface Options {
  //include?: string | RegExp | Array<string | RegExp>
  //exclude?: string | RegExp | Array<string | RegExp>
  extname?: string
  packageName?: string
}

export default (options: Options = {}): PluginOption => {
  const virtual = 'virtual:';
  const extname = options.extname || '.css';
  const loader = 'style-provider';
  const updateEventName = `${loader}:update`;
  const prefix = `${virtual}${loader}`;
  const resolvedPrefix = `\0/`;

  const runtimeModuleId = `${prefix}!:runtime`;
  let resolvedRuntimeModuleId: string;

  //const include = options.include || [];
  let command: string;
  let packageName = options.packageName;
  let base = '/'
  //let filter = createFilter(include, options.exclude)
  let projectRoot = process.cwd()

  const watchFiles = new Set();
  const paramsRE = /^[^\?]*|\?.*$/g;

  return {
    name: 'shadow-dom-css',
    //enforce: 'post',
    config(config, env) {
      command = env.command;
    },
    configResolved(config) {
      base = config.base
      projectRoot = config.root
      resolvedRuntimeModuleId = command === 'serve' ? path.posix.join(base, runtimeModuleId) : runtimeModuleId;

      if (!packageName) {
        try {
          packageName = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8')).name;
        } catch(e) {
          throw new Error(`Requires "packageName" option`);
        }
      }

      // filter = createFilter(include, options.exclude, {
      //   resolve: projectRoot
      // })
    },
    async handleHotUpdate({ server, file, timestamp, read }) {
      if (watchFiles.has(file)) {
        server.ws.send({
          type: 'custom',
          event: updateEventName,
          data: {
            path: normalizeDevPath(projectRoot, file).replace(extname, ''),
            timestamp,
            content: await read()
          }
        })
        return []
      }
    },
    async resolveId(id, importer) {
      if (id === resolvedRuntimeModuleId) {
        return id;
      }

      if (id.startsWith(prefix)) {
        if (id.includes('.css')) {
          console.warn(`[WARN] Please avoid using .css as the file name, because vite will handle it`);
          console.warn(`[WARN] ${id}`);
        }
        const { loaders, resource } = parseLoader(id.replace(virtual, ""));
        const resolvedFilename = path.join(path.dirname(importer || ''), resource);
        const normalizePath = normalizeDevPath(projectRoot, resolvedFilename);
        const current: string = loaders[0];
        const [loader, query] = current.match(paramsRE)!;
        const resolvedId = `${resolvedPrefix}${loader}${query || ''}!${normalizePath}`;
        return resolvedId;
      }
    },
    async load(id) {
      if (id === resolvedRuntimeModuleId) {
        return fs.readFileSync(path.join(__dirname, 'style-provider-runtime.js'), 'utf-8');
      }

      if (id.startsWith(`${resolvedPrefix}${loader}`)) {

        const { loaders, resource } = parseLoader(id.replace(resolvedPrefix, ""));
        const current = loaders[0];
        const [, query] = current.match(paramsRE)!;
        const params = new URLSearchParams(query);
        const resolvedId = command === 'serve' ? resource : `${packageName}${resource}`;
        //const options = Object.fromEntries(params);

        if (params.has('query')) {

          //const d = normalizeDevPath(projectRoot, resource);
          const filter = `^${resolvedId.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*?')}$`;

          return [
            `import stylesProvider from ${JSON.stringify(resolvedRuntimeModuleId)}`,
            `const filter = new RegExp(${JSON.stringify(filter)})`,
            `const create = (container, name) => () => Array.from(stylesProvider.entries())`,
            `  .filter(([id]) => filter.test(id))`,
            `  .forEach(([id]) => {`,
            `    stylesProvider.import(id)(container)[name]()`,
            `  })`,
            `export default (container = document.head) => ({`,
            `  mount: create(container, 'mount'),`,
            `  unmount: create(container, 'unmount'),`,
            `  unload: create(container, 'unload')`,
            `})`
          ].join('\n')
        }

        const fullFilename = path.join(projectRoot, resource + extname);
        const code = fs.readFileSync(fullFilename, 'utf-8');
        this.addWatchFile(fullFilename);
        watchFiles.add(fullFilename)

        if (command === 'serve') {
          return [
            `import stylesProvider from ${JSON.stringify(resolvedRuntimeModuleId)}`,
            `const id = ${JSON.stringify(resolvedId)}`,
            `const css = ${JSON.stringify(code)}`,
            `stylesProvider.set(id, css)`,
            `export default stylesProvider.import(id)`,
            `if (import.meta.hot) {`,
            `   import.meta.hot.on(${JSON.stringify(updateEventName)}, ({ path, content }) => {`,
            `     if (id === path) {`,
            `       console.log("[vite] hot updated:", id + ${JSON.stringify(extname)})`,
            `       stylesProvider.set(id, content)`,
            `     }`,
            `   })`,
            `}`,
          ].join('\n')
        } else {
          return [
            `import stylesProvider from ${JSON.stringify(resolvedRuntimeModuleId)}`,
            `const id = ${JSON.stringify(resolvedId)}`,
            `const css = ${JSON.stringify(code)}`,
            `stylesProvider.set(id, css)`,
            `export default stylesProvider.import(id)`
          ].join('\n')
        }
      }
    }
  }
}
