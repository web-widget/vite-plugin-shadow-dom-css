import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  rollup: {
    emitCJS: true,
    cjsBridge: true
  },
  externals: [
    "vite",
    '@babel/*',
    '@rollup/*',
    'resolve'
  ],
})
