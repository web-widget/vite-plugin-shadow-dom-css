import { createFilter } from '@rollup/pluginutils';
import { normalizeDevPath, injectQuery, isRelativePath } from './utils';
import fs from 'fs';
import path from 'path';
import type { PluginOption } from 'vite';

export interface Options {
  include?: string | RegExp | Array<string | RegExp>;
  exclude?: string | RegExp | Array<string | RegExp>;
  packageName?: string;
}

// const cssLangs = `\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)`;
// const cssLangRE = new RegExp(cssLangs);
const runtimeTemplate = fs.readFileSync(
  path.join(__dirname, 'style-provider-runtime.js'),
  'utf-8'
);

export default (options: Options = {}): PluginOption[] => {
  const virtual = 'virtual:';
  const loader = 'style-provider';
  const ignore = `from-style-provider`;

  const updateEventName = `${loader}:update`;
  const resolvedPrefix = `\0/`;
  const runtimeId = `${resolvedPrefix}${loader}/:runtime`;
  const afterIdRE = new RegExp(`(\\?|&)${loader}\\b`);
  const beforeIdRE = new RegExp(`^(${virtual}|${resolvedPrefix})${loader}\\b`);
  const ignoreRE = new RegExp(`(\\?|&)${ignore}\\b`);

  let command: string;
  let packageName = options.packageName;
  let projectRoot = process.cwd();
  let filter = createFilter(options.include/* || [cssLangRE]*/, options.exclude);

  return [
    {
      name: 'shadow-dom-css',
      enforce: 'pre',
      config(config, env) {
        command = env.command;
      },
      configResolved(config) {
        projectRoot = config.root;
        if (!packageName) {
          try {
            packageName = JSON.parse(
              fs.readFileSync(
                path.join(projectRoot, 'package.json'),
                'utf-8'
              )
            ).name;
          } catch (e) {
            throw new Error(`Requires "packageName" option`);
          }
        }
      },
      async handleHotUpdate({ server, file, modules, timestamp, read }) {
        if (filter(file)) {
          server.ws.send({
            type: 'custom',
            event: updateEventName,
            data: {
              path: normalizeDevPath(projectRoot, file),
              modules,
              timestamp,
              content: await read(),
            },
          });
          return [];
        }
      },
      async resolveId(id, importer) {
        if (id === runtimeId) {
          return id;
        }

        // `virtual:style-provider?query=./**` -> `\0/style-provider/${encodeData}`
        if (beforeIdRE.test(id)) {
          const normalizeId = id.replace(`${virtual}${loader}`, '').replace(`${resolvedPrefix}${loader}`, '');

          if (normalizeId.startsWith('?')) {
            const searchParams = new URLSearchParams(normalizeId.slice(1));
            const params = Object.create(null);

            Array.from(searchParams.entries()).forEach(([name, value]) => {
              const type = typeof params[name];
              if (type === 'undefined') {
                params[name] = value;
              } else if (type === 'object') {
                params[name].push(value);
              } else if (type === 'string') {
                params[name] = [params[name], value];
              }
            });

            if (params.query) {
              params.query = params.query.replace(/^~/, `${packageName}`).replace(`,~`, `,${packageName}`);
            }

            const data = JSON.stringify({ params, id: null });
            const encodeData = Buffer.from(data).toString('base64');
            const resolvedId = `${resolvedPrefix}${loader}/${encodeData}`;
            return resolvedId;
          }

          return;
        }

        // `./style.css?style-provider` -> `\0/style-provider/${encodeData}`
        if (afterIdRE.test(id)) {
          const paramsRE = /^[^\?]*|\?.*$/g;
          let [filename, query] = id.match(paramsRE) || [''];
          query = query.replace(afterIdRE, '?').replace(/\?$/, '');

          let normalizePath = `${filename}${query}`;

          if (isRelativePath(normalizePath)) {
            normalizePath = path.join(
              path.dirname(importer || ''),
              normalizePath
            );
          }

          normalizePath = normalizeDevPath(
            projectRoot,
            normalizePath
          );

          const data = JSON.stringify({ params: null, id: normalizePath });
          const encodeData = Buffer.from(data).toString('base64');
          const resolvedId = `${resolvedPrefix}${loader}/${encodeData}`;
          return resolvedId;
        }

        if (filter(id) && !ignoreRE.test(id)) {
          let normalizePath = id; // TODO

          if (isRelativePath(normalizePath)) {
            normalizePath = path.join(
              path.dirname(importer || ''),
              normalizePath
            );
          }

          const resolvedId = injectQuery(normalizePath, loader);
          return resolvedId;
        }
      },
      async load(id) {
        // runtime
        if (id === runtimeId) {
          return runtimeTemplate;
        }

        // css files
        if (id.startsWith(`${resolvedPrefix}${loader}`)) {
          const encodeData = id.replace(
            `${resolvedPrefix}${loader}/`,
            ''
          );
          const decodeData = Buffer.from(
            encodeData,
            'base64'
          ).toString('ascii');
          const data = JSON.parse(decodeData);

          // `\0/style-provider?query=${encodeData}`
          if (data.params) {
            const query = data.params.query;
            if (query) {
              return [
                `import { useQueryStyle } from ${JSON.stringify(
                  runtimeId
                )}`,
                `export default useQueryStyle(${JSON.stringify(
                  query
                )})`,
              ].join('\n');
            }
            throw new Error(`Unsupported parameters: ${JSON.stringify(data.params)}`);
          }

          // `\0/style-provider/${encodeData}`
          const normalizeId = data.id;
          const resolvedPath = /^\//.test(normalizeId)
            ? path.join(projectRoot, normalizeId)
            : normalizeId;
          const resolvedId = /^\//.test(normalizeId)
            ? `${packageName}${normalizeId}`
            : normalizeId;
          const cssId = injectQuery(
            injectQuery(resolvedPath, ignore),
            'inline'
          );
          const runtimeIdStringify = JSON.stringify(runtimeId);
          const idStringify = JSON.stringify(resolvedId);
          const cssIdStringify = JSON.stringify(cssId);
          const updateEventNameStringify = JSON.stringify(updateEventName);
          const normalizeIdStringify = JSON.stringify(normalizeId);

          if (command === 'serve') {
            return [
              `import { setStyle, useStyle } from ${runtimeIdStringify}`,
              `import css from ${cssIdStringify}`,
              `const id = ${idStringify}`,
              `setStyle(id, css)`,
              `export default useStyle(id)`,
              `if (import.meta.hot) {`,
              ` import.meta.hot.on(${updateEventNameStringify}, ({ path, content }) => {`,
              `   if (path === ${normalizeIdStringify}) {`,
              `     console.log("[vite] hot updated:", path)`,
              `     setStyle(id, content)`,
              `   }`,
              ` })`,
              `}`,
            ].join('\n');
          } else {
            return [
              `import css from ${cssIdStringify}`,
              `import { setStyle, useStyle } from ${JSON.stringify(
                runtimeId
              )}`,
              `const id = ${idStringify}`,
              `setStyle(id, css)`,
              `export default useStyle(id)`,
            ].join('\n');
          }
        }
      },
    },
  ];
};
