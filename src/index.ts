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

/* minify css */
function minifyCSS(content: string) {
  content = content.replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, "");
  content = content.replace(/ {2,}/g, " ");
  content = content.replace(/ ([{:}]) /g, "$1");
  content = content.replace(/([{:}]) /g, "$1");
  content = content.replace(/([;,]) /g, "$1");
  content = content.replace(/ !/g, "!");
  return content;
}

export interface Options {
  //include?: string | RegExp | Array<string | RegExp>
  //exclude?: string | RegExp | Array<string | RegExp>
  extname?: string
  packageName?: string
  minify?: boolean
}

export default (options: Options = {}): PluginOption => {
  const virtual = 'virtual:';
  const extname = options.extname || '.css';
  const minify = options.minify === undefined ? process.env.NODE_ENV === 'production' : false;
  const loader = 'style-provider';
  const updateEventName = `${loader}:update`;
  const resolvedPrefix = `\0/`;
  const prefix = `${virtual}${loader}`;

  const runtimeModuleId = `${loader}!/:runtime`;
  const resolvedRuntimeModuleId = `${resolvedPrefix}${runtimeModuleId}`;

  //const include = options.include || [];
  let command: string;
  let packageName = options.packageName;
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
      projectRoot = config.root
      //resolvedRuntimeModuleId = command === 'serve' ? path.posix.join(base, runtimeModuleId) : runtimeModuleId;

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
          return [
            `import { useQueryStyle } from ${JSON.stringify(resolvedRuntimeModuleId)}`,
            `export default useQueryStyle(${JSON.stringify(resolvedId)})`,
          ].join('\n')
        }

        const fullFilename = path.join(projectRoot, resource + extname);
        const source = fs.readFileSync(fullFilename, 'utf-8');
        const code = minify ? minifyCSS(source) : source;
        this.addWatchFile(fullFilename);
        watchFiles.add(fullFilename)

        if (command === 'serve') {
          return [
            `import { setStyle, useStyle } from ${JSON.stringify(resolvedRuntimeModuleId)}`,
            `const id = ${JSON.stringify(resolvedId)}`,
            `const css = ${JSON.stringify(code)}`,
            `setStyle(id, css)`,
            `export default useStyle(id)`,
            `if (import.meta.hot) {`,
            `   import.meta.hot.on(${JSON.stringify(updateEventName)}, ({ path, content }) => {`,
            `     if (id === path) {`,
            `       console.log("[vite] hot updated:", id + ${JSON.stringify(extname)})`,
            `       setStyle(id, content)`,
            `     }`,
            `   })`,
            `}`,
          ].join('\n')
        } else {
          return [
            `import { setStyle, useStyle } from ${JSON.stringify(resolvedRuntimeModuleId)}`,
            `const id = ${JSON.stringify(resolvedId)}`,
            `const css = ${JSON.stringify(code)}`,
            `setStyle(id, css)`,
            `export default useStyle(id)`
          ].join('\n')
        }
      }
    }
  }
}
