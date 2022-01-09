const path = require('path');
const fse = require('fs-extra');
const postcss = require('postcss');
const cssModules = require('postcss-modules');
const util = require('util');
const tmp = require('tmp');
const crypto = require('crypto');
const readFile = util.promisify(fse.readFile);
const writeFile = util.promisify(fse.writeFile);
const ensureDir = util.promisify(fse.ensureDir);
const pluginNamespace = 'esbuild-css-modules-plugin-namespace';

const defineCssImport = `defCss.js`;
const defineCssContent = `
export default function (digest, css) {
    if (!document.getElementById(digest)) {
        var el = document.createElement('style');
        el.id = digest;
        el.textContent = css;
        document.head.appendChild(el);
    }
}
`.trim();

const buildCssModulesJS = async (cssFullPath, options = { light: true }) => {
    const css = await readFile(cssFullPath);
    let cssModulesJSON;
    const result = await postcss([
        cssModules({
            localsConvention: 'camelCaseOnly',
            scopeBehaviour: 'global',
            getJSON(cssSourceFile, json) {
                cssModulesJSON = { ...json };
                return cssModulesJSON;
            }
        })
    ]).process(css, { from: undefined, map: false });

    const hash = crypto.createHash('sha256');
    hash.update(cssFullPath);
    const digest = hash.digest('hex');

    const jsContent = (options.light ?
        `require('${defineCssImport}').default('${digest}', \`${result.css}\`);` :
        `
const defineCss = require('${defineCssImport}').default;
const digest = '${digest}';
const css = \`${result.css}\`;
defineCss(digest, css);
export default ${JSON.stringify(cssModulesJSON)};
export { css, digest };
`).trim();

    return Promise.resolve({
        jsContent,
        cssContent: result.css
    });
};

const CssBundlePlugin = (options = {}) => {
    return {
        name: 'esbuild-css-modules-plugin',
        setup(build) {
            const { outdir, bundle, logLevel } = build.initialOptions;
            const rootDir = process.cwd();
            const tmpDirPath = tmp.dirSync().name;

            const outputLogs = logLevel === 'debug' || logLevel === 'verbose';

            build.onResolve({ filter: /\.modules?\.css$/, namespace: 'file' }, async (args) => {
                const sourceFullPath = path.resolve(args.resolveDir, args.path);
                const sourceExt = path.extname(sourceFullPath);
                const sourceBaseName = path.basename(sourceFullPath, sourceExt);
                const sourceDir = path.dirname(sourceFullPath);
                const sourceRelDir = path.relative(path.dirname(rootDir), sourceDir);
                const tmpDir = path.resolve(tmpDirPath, sourceRelDir);
                await ensureDir(tmpDir);
                const tmpFilePath = path.resolve(tmpDir, `${sourceBaseName}.css`);

                const { jsContent } = await buildCssModulesJS(sourceFullPath, options);

                await writeFile(`${tmpFilePath}.js`, jsContent, { encoding: 'utf-8' });

                if (outdir && !bundle) {
                    const isOutdirAbsolute = path.isAbsolute(outdir);
                    const absoluteOutdir = isOutdirAbsolute
                        ? outdir
                        : path.resolve(args.resolveDir, outdir);
                    const isEntryAbsolute = path.isAbsolute(args.path);
                    const entryRelDir = isEntryAbsolute
                        ? path.dirname(path.relative(args.resolveDir, args.path))
                        : path.dirname(args.path);
                    const targetSubpath =
                        absoluteOutdir.indexOf(entryRelDir) === -1
                            ? path.join(entryRelDir, `${sourceBaseName}.css.js`)
                            : `${sourceBaseName}.css.js`;
                    const target = path.resolve(absoluteOutdir, targetSubpath);
                    await ensureDir(path.dirname(target));
                    fse.copyFileSync(`${tmpFilePath}.js`, target);
                    outputLogs &&
                        console.log(
                            '[css-modules-plugin]',
                            path.relative(rootDir, sourceFullPath),
                            '=>',
                            path.relative(rootDir, target)
                        );
                }
                if (!bundle) {
                    return { path: sourceFullPath, namespace: 'file' };
                }
                return {
                    path: `${tmpFilePath}.js`,
                    namespace: pluginNamespace,
                    pluginData: {
                        content: jsContent,
                        resolveArgs: {
                            path: args.path,
                            fullPath: sourceFullPath,
                            importer: args.importer,
                            namespace: args.namespace,
                            resolveDir: args.resolveDir,
                            kind: args.kind,
                        },
                    },
                };
            });
            build.onLoad({ filter: /\.modules?\.css\.js$/, namespace: pluginNamespace }, (args) => {
                const { path: resolvePath, importer, fullPath } = args.pluginData.resolveArgs;
                const importerName = path.basename(importer);
                outputLogs &&
                    console.log(
                        '[css-modules-plugin]',
                        `${resolvePath} => ${resolvePath}.js => ${importerName}`
                    );
                return { contents: args.pluginData.content, loader: 'js', watchFiles: [fullPath] };
            });

            // define a virtual file with the css injector code to avoid to repeat it for each css file
            build.onResolve({ filter: new RegExp(defineCssImport.replace('.', '\\.')) }, () => ({
                path: 'defineCss',
                namespace: pluginNamespace,
            }));
            build.onLoad({ filter: /defineCss/, namespace: pluginNamespace }, () => ({
                loader: 'js',
                contents: defineCssContent,
            }));
        }
    }
};

module.exports = CssBundlePlugin;
