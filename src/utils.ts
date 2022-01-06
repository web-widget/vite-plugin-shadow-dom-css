import fs from 'fs'

const relativePathRE = /^(\.\/|\.\.)/;

export function isRelativePath(id: string): boolean {
  return relativePathRE.test(id);
}

const FS_PREFIX = `/@fs/`
const queryRE = /\?.*$/
const hashRE = /#.*$/

export const cleanUrl = (url: string) =>
  url.replace(hashRE, '').replace(queryRE, '')

export function normalizeDevPath(root: string, id: string) {
  if (id.startsWith(root + '/')) {
    return id.slice(root.length)
  } else if (fs.existsSync(cleanUrl(id))) {
    return FS_PREFIX + id
  }
  return id
}

export function injectQuery(url: string, queryToInject: string): string {
  const paramsRE = /^[^\?]*|\?.*$/g;
  const [path, query] = url.match(paramsRE) || [''];

  if (query) {
    if ((new RegExp(`(\\?|&)${queryToInject}\\b`)).test(queryToInject)) {
      return url;
    }
    return `${path}?${queryToInject}&${query.replace('?', '')}`
  }
  return `${path}?${queryToInject}`
}