const dev = process.env.NODE_ENV === 'dev';
const cssBundlePlugin = require('./css.js');

const projectVersion = process.env.PROJECT_VERSION || 'dev';
const indexHtmlVersion = projectVersion.endsWith('-SNAPSHOT') ?
    process.env.BUILD_DATE.replace(':', '-') :
    projectVersion;

require('esbuild').build({
    watch: dev,
    plugins: [ cssBundlePlugin() ],
    loader: { '.js': 'jsx' },
    entryPoints: ['./index.js'],
    bundle: true,
    metafile: dev,
    minify: !dev,
    sourcemap: dev,
    legalComments: 'none',
    logLevel: 'info',
    target: ['chrome58', 'firefox57', 'safari11'],
    outfile: `${process.env.OUTPUT || '../../../target/yupiik.github.io-1.0.0-SNAPSHOT/'}js/starter.js`,
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
})
.catch(() => process.exit(1));
