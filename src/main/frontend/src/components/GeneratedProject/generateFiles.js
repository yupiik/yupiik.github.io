import indexTemplate from './esbuild/assets/index.txt';
import cssTemplate from './esbuild/plugins/css.txt';
import resourcesTemplate from './esbuild/plugins/resources.txt';
import { generatePom } from './generatePom';
import { toPackage } from './generationUtils';

const isUsingFusion = spec => (spec.switchValues.filter(it => it.enabled).map(it => it.name)[0] || 'useFusion') === 'useFusion';

const getOrCreateFolder = (files, name, idGenerator) => {
    const segments = name.split('/');
    let current = files;
    for (const segment of segments) {
        const item = current.filter(it => it.name == segment);
        if (item.length == 1) {
            current = item[0].children;
            continue;
        }
        const newItem = {
            id: idGenerator(),
            name: segment,
            children: [],
        };
        current.push(newItem);
        current = newItem.children;
    }
    return current;
};
const ensureBasePackage = (files, idGenerator, groupId, module) => {
    const packageLayers = toPackage(groupId, module).replace(/\./g, '/');
    return {
        main: getOrCreateFolder(files, `src/main/java/${packageLayers}`, idGenerator),
        test: getOrCreateFolder(files, `src/test/java/${packageLayers}`, idGenerator),
    };
};

const injectBatch = (files, groupId, artifactId, idGenerator, hasFeature, readmePaths) => {
    const { main, test } = ensureBasePackage(files, idGenerator, groupId, artifactId);
    const pck = toPackage(groupId, artifactId);
    const batch = getOrCreateFolder(main, 'batch', idGenerator);

    readmePaths.push('The batch is composed of two main entry points:');
    readmePaths.push('');
    readmePaths.push('* Its configuration: `BatchConfiguration`,');
    readmePaths.push('* Its implementation: `SimpleBatch`.');
    readmePaths.push('');
    readmePaths.push('`SimpleBatch` owns - in this generated implementation - the batch launcher (`main`) too.');
    readmePaths.push('It will be responsible to instantiate the configuration (from the environment) and execute the batch.');
    readmePaths.push('');
    readmePaths.push('`doRun` method of `SimpleBatch` define the batch pipeline and rest of its code sets up the execution from the configuration.');
    readmePaths.push('');
    readmePaths.push('Finally, `SimpleBatchTest` is a skeleton to write a test for the batch.');
    readmePaths.push('');
    readmePaths.push('TIP: in this mode, the tracer relies on a database but the generator does not bring h2 or any database by default to let you pick the one you prefer.');
    readmePaths.push('Ensure to add one if you want to enable the tracer in tests - or at runtime.');
    readmePaths.push('');

    batch.push({
        id: idGenerator(),
        name: 'BatchConfiguration.java',
        content: [
            `package ${pck}.batch;`,
            '',
            'import io.yupiik.batch.runtime.configuration.Param;',
            'import io.yupiik.batch.runtime.sql.DataSourceConfiguration;',
            '',
            '// hosts the batch configuration and is injected when the batch is launched',
            'public class BatchConfiguration {',
            '    @Param(description = "If `true` will skip the execution.")',
            '    private boolean skip;',
            '',
            '    @Param(description = "If `true` will skip the tracing of the execution (nothing written in the database).")',
            '    private boolean skipTracing = true;',
            '',
            '    @Param(name = "tracing-datasource", description = "Tracing database.")',
            '    private DataSourceConfiguration tracingDatasource = new DataSourceConfiguration();',
            '',
            '    public boolean isSkip() {',
            '        return skip;',
            '    }',
            '',
            '    public BatchConfiguration setSkip(final boolean skip) {',
            '        this.skip = skip;',
            '        return this;',
            '    }',
            '',
            '    public boolean isSkipTracing() {',
            '        return skipTracing;',
            '    }',
            '',
            '    public BatchConfiguration setSkipTracing(final boolean skip) {',
            '        this.skipTracing = skip;',
            '        return this;',
            '    }',
            '',
            '    public DataSourceConfiguration getTracingDatasource() {',
            '        return tracingDatasource;',
            '    }',
            '',
            '    public BatchConfiguration setTracingDatasource(final DataSourceConfiguration tracingDatasource) {',
            '        this.tracingDatasource = tracingDatasource;',
            '        return this;',
            '    }',
            '}',
            '',
        ].join('\n'),
    });
    batch.push({
        id: idGenerator(),
        name: 'FetchData.java',
        content: [
            `package ${pck}.batch;`,
            '',
            'import io.yupiik.batch.runtime.fn.CommentifiableFunction;',
            '',
            'public class FetchData implements CommentifiableFunction<Void, InitialData> {',
            '    private final StringBuilder comment = new StringBuilder();',
            '',
            '    @Override',
            '    public InitialData apply(final Void ignored) {',
            '        return new InitialData(); // TODO',
            '    }',
            '',
            '    @Override',
            '    public String toComment() {',
            '        return comment.toString();',
            '    }',
            '}',
            '',
        ].join('\n'),
    });
    batch.push({
        id: idGenerator(),
        name: 'InitialData.java',
        content: [
            `package ${pck}.batch;`,
            '',
            'public class InitialData {',
            '}',
            '',
        ].join('\n'),
    });
    batch.push({
        id: idGenerator(),
        name: 'SimpleBatch.java',
        content: [
            `package ${pck}.batch;`,
            '',
            'import io.yupiik.batch.runtime.batch.Batch;',
            'import io.yupiik.batch.runtime.batch.BatchMeta;',
            'import io.yupiik.batch.runtime.batch.builder.Executable;',
            'import io.yupiik.batch.runtime.batch.builder.RunConfiguration;',
            'import io.yupiik.batch.runtime.sql.SQLSupplier;',
            'import io.yupiik.batch.runtime.tracing.BaseExecutionTracer;',
            'import io.yupiik.batch.runtime.tracing.ExecutionTracer;',
            'import java.sql.Connection;',
            'import java.time.Clock;',
            'import java.time.Instant;',
            'import java.time.LocalDateTime;',
            'import java.util.List;',
            'import java.util.UUID;',
            'import java.util.logging.Logger;',
            '',
            'import static java.time.Clock.systemUTC;',
            'import static java.util.logging.Level.SEVERE;',
            '',
            '// see https://yupiik.github.io/yupiik-batch/write-your-first-batch.html#_reusable_batch_components',
            '// to implement doRun()',
            '@BatchMeta(description = "Sample generated batch.")',
            'public class SimpleBatch implements Batch<BatchConfiguration> {',
            '    public static void main(final String... args) {',
            '        Batch.run(SimpleBatch.class, args);',
            '    }',
            '',
            '    // this is the batch "pipeline", it is where you will add your steps',
            '    private void doRun() {',
            '        from()',
            '            .map("Fetch Batch Data", new FetchData());',
            '    }',
            '',
            '    @Override',
            '    public void accept(final BatchConfiguration configuration) {',
            '        final var clock = systemUTC();',
            '        final var batchClass = getClass();',
            '        final var startInstant = clock.instant();',
            '        final var start = LocalDateTime.ofInstant(startInstant, clock.getZone());',
            '        final var tracer = new SimpleTracer(',
            '            configuration.getTracingDatasource().toConnectionProvider(),',
            '            batchClass.getSimpleName(), clock, configuration.isSkipTracing());',
            '        final var logger = Logger.getLogger(batchClass.getName());',
            '        if (configuration.isSkip()) {',
            '            logger.warning("Batch execution is skipped");',
            '            tracer.save(',
            '                new BaseExecutionTracer.JobExecution(',
            '                    UUID.randomUUID().toString(), batchClass.getSimpleName(),',
            '                    BaseExecutionTracer.Status.FAILURE, "Batch skipped.",',
            '                    start,',
            '                    start.plusSeconds(1)),',
            '                List.of());',
            '            return;',
            '        }',
            '',
            '        final var runConfiguration = new RunConfiguration();',
            '        runConfiguration.setExecutionWrapper(tracer::traceExecution);',
            '        runConfiguration.setElementExecutionWrapper(e -> (c, r) -> {',
            '            try {',
            '                return Executable.Result.class.cast(tracer.traceStep(c, e, r));',
            '            } catch (final RuntimeException re) {',
            '                logger.log(SEVERE, re, re::getMessage);',
            '                throw re;',
            '            }',
            '        });',
            '',
            '        final var shutdownHook = createShutdownHook(batchClass, clock, startInstant, tracer);',
            '        logger.info(() -> "Starting batch " + batchClass.getSimpleName());',
            '        try {',
            '            doRun();',
            '        } finally {',
            '            try {',
            '                Runtime.getRuntime().removeShutdownHook(shutdownHook);',
            '            } catch (final IllegalStateException ise) {',
            '                // no-op',
            '            }',
            '            final var end = clock.instant();',
            '            final var duration = end.minusMillis(startInstant.toEpochMilli()).toEpochMilli();',
            '            logger.info(() -> "" +',
            '                "Batch " + batchClass.getSimpleName() +',
            '                " ended in " + duration + "ms");',
            '        }',
            '    }',
            '',
            '    private Thread createShutdownHook(final Class<?> batchClass, final Clock clock,',
            '                                      final Instant start, final SimpleTracer tracer) {',
            '        final var shutdownHook = new Thread(() -> {',
            '            if (tracer.isAlreadySaved()) {',
            '                return;',
            '            }',
            '',
            '            final var end = clock.instant();',
            '            final var duration = end.minusMillis(start.toEpochMilli()).toEpochMilli();',
            '',
            '            final var startDate = LocalDateTime.ofInstant(start, clock.getZone());',
            '            tracer.save(',
            '                    new BaseExecutionTracer.JobExecution(',
            '                            UUID.randomUUID().toString(), batchClass.getSimpleName(),',
            '                            BaseExecutionTracer.Status.FAILURE,',
            '                            "Batch was cancelled (shutdown hook fallback).", // deadline exceeded in general',
            '                            startDate,',
            '                            duration <= 0 ? startDate : LocalDateTime.ofInstant(end, clock.getZone())),',
            '                    List.of());',
            '        }, getClass().getName() + "-shutdownhook");',
            '        final var runtime = Runtime.getRuntime();',
            '        runtime.addShutdownHook(shutdownHook);',
            '        return shutdownHook;',
            '    }',
            '',
            '    private static class SimpleTracer extends ExecutionTracer {',
            '        private final boolean skip;',
            '',
            '        public SimpleTracer(',
            '                final SQLSupplier<Connection> connectionSQLSupplier,',
            '                final String name, final Clock clock, final boolean skip) {',
            '            super(connectionSQLSupplier, name, clock);',
            '            this.skip = skip;',
            '        }',
            '',
            '        @Override',
            '        public synchronized void save(final JobExecution job, final List<StepExecution> steps) {',
            '            if (!skip) {',
            '                super.save(job, steps);',
            '            }',
            '        }',
            '    }',
            '}',
            '',
        ].join('\n'),
    });

    // test
    const testBatch = getOrCreateFolder(test, 'batch', idGenerator);
    testBatch.push({
        id: idGenerator(),
        name: 'SimpleBatchTest.java',
        content: [
            `package ${pck}.batch;`,
            '',
            'import org.junit.jupiter.api.Test;',
            '',
            'class SimpleBatchTest {',
            '    @Test',
            '    void run() {',
            '        final var configuration = new BatchConfiguration();',
            '        configuration.setSkipTracing(true /* enable and set up a database (h2) if needed */);',
            '',
            '        // run itself',
            '        // TIP: if you use diff logic, run it twice',
            '        //      to ensure there is no diff the 2nd time',
            '        new SimpleBatch().accept(configuration);',
            '',
            '        // todo: asserts',
            '    }',
            '}',
            '',
        ].join('\n'),
    });
};

const configMap = (name, custom) => [
    '{',
    '  "apiVersion": "v1",',
    '  "kind": "ConfigMap",',
    '  "metadata": {',
    `    "name": "${name}",`,
    '    "labels": {',
    `      "app": "${name}",`,
    '      "deploy.by":"{{user.name:-unknown}}"',
    '    }',
    '  },',
    '  "data":{',
    '    "APPLICATION_ENVIRONMENT":"{{bundlebee.environment:-default}}",',
    '    "_DEPLOY_TIME":"{{app.deploytime:-unset}}"' + (custom ? ',' : ''),
    ...(custom ? custom : []),
    '  }',
    '}',
].join('\n');

const service = name => [
    '{',
    '  "apiVersion": "v1",',
    '  "kind": "Service",',
    '  "metadata": {',
    `    "name": "${name}",`,
    '    "labels": {',
    `      "app": "${name}",`,
    '      "deploy.by":"{{user.name:-unknown}}"',
    '    }',
    '  },',
    '  "spec":{',
    '    "type": "NodePort",',
    '    "selector": {',
    `      "app": "${name}"`,
    '    },',
    '    "ports": [',
    '      {',
    '        "protocol": "TCP",',
    '        "port": 8080,',
    '        "targetPort": 8080',
    '      }',
    '    ]',
    '  }',
    '}',
].join('\n');

const BUNDLEBEE_TOMCAT_ARGS = [
    '            "args": [',
    '              "--openwebbeans.main",',
    '              "uShipTomcatAwait"',
    '            ],',
];
const deployment = (singleModule, name, artifactId, main, args, injectProbes, systemProps) => [
    '{',
    '  "apiVersion": "apps/v1",',
    '  "kind": "Deployment",',
    '  "metadata": {',
    `    "name": "${name}",`,
    '    "labels": {',
    `      "app": "${name}",`,
    '      "deploy.by":"{{user.name:-unknown}}"',
    '    }',
    '  },',
    '  "spec": {',
    '    "selector": {',
    '      "matchLabels": {',
    `        "app": "${name}"`,
    '      }',
    '    },',
    '    "template": {',
    '      "metadata": {',
    '        "labels": {',
    `          "app": "${name}",`,
    `          "deploy.by":"{{user.name:-unknown}}",`,
    `          "deploy.at":"{{app.deploytime:-unset}}",`,
    `          "app.environment":"{{bundlebee.environment}}"`,
    '        }',
    '      },',
    '      "spec": {',
    '        "containers": [',
    '          {',
    `            "name": "${name}",`,
    `            "image":"{{image.registry}}/${artifactId}:{{project.version}}",`,
    '            "imagePullPolicy": "{{pharmaplus.image.pullPolicy:-IfNotPresent}}",',
    ...(singleModule ? [
        '            "command": [',
        '              "java",',
        '              "-Djava.util.logging.manager=io.yupiik.logging.jul.YupiikLogManager",',
        '              "-Dio.yupiik.logging.jul.handler.StandardHandler.formatter=json",',
        '              "-Djava.security.egd=file:/dev/./urandom",',
        ...systemProps.map(it => `              "${it}",`),
        '              "-cp",',
        `              "@/opt/applications/${artifactId}/jib-classpath-file",`,
        `              "${main}"`,
        '            ],',
    ] : []),
    ...args,
    '            "env": [',
    '              {',
    '                "name": "K8S_POD_NAME",',
    '                "valueFrom": {',
    '                  "fieldRef": {',
    '                    "fieldPath":"metadata.name"',
    '                  }',
    '                }',
    '              },',
    '              {',
    '                "name": "K8S_POD_NAMESPACE",',
    '                "valueFrom": {',
    '                  "fieldRef": {',
    '                    "fieldPath":"metadata.namespace"',
    '                  }',
    '                }',
    '              }',
    '            ],',
    '            "envFrom": [',
    '              {',
    '                "configMapRef": {',
    `                  "name": "${name}"`,
    '                }',
    '              }',
    '            ]' + (injectProbes ? ',' : ''),
    ...(injectProbes ? [
        '            "ports": [',
        '              {',
        '                "containerPort": 8080',
        '              }',
        '            ],',
        '            "readinessProbe": {',
        '              "initialDelaySeconds": 3,',
        '              "periodSeconds": 3,',
        '              "failureThreshold": 10,',
        '              "httpGet": {',
        '                "path": "/health?ready",',
        '                "port": 8080,',
        '                "httpHeaders": [',
        '                  {',
        '                    "name": "Health-Key",',
        '                    "value": "{{bundlebee.probes.health.key:-changeit}}"',
        '                  }',
        '                ]',
        '              }',
        '            },',
        '            "livenessProbe": {',
        '              "initialDelaySeconds": 3,',
        '              "periodSeconds": 3,',
        '              "failureThreshold": 10,',
        '              "httpGet": {',
        '                "path": "/health?live",',
        '                "port": 8080,',
        '                "httpHeaders": [',
        '                  {',
        '                    "name": "Health-Key",',
        '                    "value": "{{bundlebee.probes.health.key:-changeit}}"',
        '                  }',
        '                ]',
        '              }',
        '            }',
    ] : []),
    '          }',
    '        ]',
    '      }',
    '    },',
    `    "replicas": {{bundlebee.deployments.${name}.replicas:-1}}`,
    '  }',
    '}',
].join('\n');

const injectBundleBee = (files, groupId, artifactId, idGenerator, hasFeature, singleModule, readmePaths, useFusion) => {
    readmePaths.push('Bundlebee enables you to automate the deployment of your application in Kubernetes.');
    readmePaths.push('');
    readmePaths.push('Generator creates a basic recipe in `manifest.json` for your application.');
    readmePaths.push(`it has one per type of deployment (a \`Deployment\` for a JSON-RPC server, a \`CronJob\` for a batch for example) and one "all in one" called ${artifactId}`);
    readmePaths.push('');
    readmePaths.push('You can deploy your application using: `mvn bundlebee:apply`.');
    readmePaths.push('');

    const pck = toPackage(groupId, artifactId);
    const root = singleModule ? getOrCreateFolder(files, 'src/main', idGenerator) : files;
    const bundlebee = getOrCreateFolder(root, 'bundlebee', idGenerator);

    const jsonRpc = hasFeature('jsonRpc');
    const batch = hasFeature('batch');
    const frontend = hasFeature('frontend');

    const baseName = artifactId;

    bundlebee.push({
        id: idGenerator(),
        name: 'manifest.json',
        content: [
            '{',
            '  "alveoli": [',
            [
                [

                    '    {',
                    `      "name": "${baseName}",`,
                    '      "dependencies": [',
                    [
                        (jsonRpc ? [
                            '        {',
                            `          "name": "${baseName}-jsonrpc-server"`,
                            '        }',
                        ].join('\n') : ''),
                        (batch ? [
                            '        {',
                            `          "name": "${baseName}-batch"`,
                            '        }',
                        ].join('\n') : ''),
                        (frontend ? [
                            '        {',
                            `          "name": "${baseName}-frontend"`,
                            '        }',
                        ].join('\n') : ''),
                    ].filter(it => it.length > 0).join(',\n'),
                    '      ]',
                    '    }',
                ].join('\n'),
                (jsonRpc ? [
                    '    {',
                    `      "name": "${baseName}-jsonrpc-server",`,
                    '      "descriptors": [',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/jsonrpc-server/configmap.json",`,
                    `          "interpolate": true`,
                    '        },',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/jsonrpc-server/deployment.json",`,
                    `          "interpolate": true`,
                    '        },',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/jsonrpc-server/service.json",`,
                    `          "interpolate": true`,
                    '        }',
                    '      ]',
                    '    }',
                ].join('\n') : ''),
                (batch ? [
                    '    {',
                    `      "name": "${baseName}-batch",`,
                    '      "descriptors": [',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/batch/configmap.json",`,
                    `          "interpolate": true`,
                    '        },',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/batch/cronjob.json",`,
                    `          "interpolate": true`,
                    '        }',
                    '      ]',
                    '    }',
                ].join('\n') : ''),
                (frontend ? [
                    '    {',
                    `      "name": "${baseName}-frontend",`,
                    '      "descriptors": [',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/frontend/configmap.json",`,
                    `          "interpolate": true`,
                    '        },',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/frontend/deployment.json",`,
                    `          "interpolate": true`,
                    '        },',
                    '        {',
                    `          "name": "${groupId}/${artifactId}/frontend/service.json",`,
                    `          "interpolate": true`,
                    '        }',
                    '      ]',
                    '    }',
                ].join('\n') : ''),
            ].filter(it => it.length > 0).join(',\n'),
            '  ]',
            '}',
        ].join('\n'),
    });

    const kubernetesSubFolder = getOrCreateFolder(bundlebee, `kubernetes/${groupId}/${artifactId}`, idGenerator);
    if (frontend) {
        const moduleFolder = getOrCreateFolder(kubernetesSubFolder, 'frontend', idGenerator);
        const name = `${artifactId}-frontend`;

        readmePaths.push(`\`kubernetes/${groupId}/${artifactId}/frontend/configmap.json\` contains the frontend server configuration in the data map (matches \`ApplicationConfiguration\`).`);
        readmePaths.push('By default it forwards the environment and deploy time only (can be used with stakater reloader to restart the dpeloyment for example).');
        readmePaths.push('');
        readmePaths.push(`\`kubernetes/${groupId}/${artifactId}/frontend/deployment.json\` contains the frontend server deployment.`);
        readmePaths.push(`It uses placeholders like \`bundlebee.deployments.${name}.replicas\` you can force on the command line ot override the default (1).`);
        readmePaths.push('');

        moduleFolder.push({
            id: idGenerator(),
            name: 'configmap.json',
            content: configMap(name),
        });
        moduleFolder.push({
            id: idGenerator(),
            name: 'service.json',
            content: service(name),
        });
        moduleFolder.push({
            id: idGenerator(),
            name: 'deployment.json',
            content: deployment(
                singleModule, name, artifactId,
                useFusion ? 'io.yupiik.fusion.framework.api.main.Launcher' : 'org.apache.openwebbeans.se.CDILauncher',
                useFusion ? [] : BUNDLEBEE_TOMCAT_ARGS,
                false, [`-D${artifactId}-resources-docBase=/opt/applications/${artifactId}/docs`]),
        });
    }
    if (jsonRpc) {
        const moduleFolder = getOrCreateFolder(kubernetesSubFolder, 'jsonrpc-server', idGenerator);
        const name = `${artifactId}-jsonrpc-server`;

        readmePaths.push(`\`kubernetes/${groupId}/${artifactId}/jsonrpc-server/configmap.json\` contains the JSON-RPC server configuration in the data map (matches \`ApplicationConfiguration\`).`);
        readmePaths.push('By default it forwards the environment and deploy time only (can be used with stakater reloader to restart the dpeloyment for example).');
        readmePaths.push('');
        readmePaths.push(`\`kubernetes/${groupId}/${artifactId}/jsonrpc-server/deployment.json\` contains the JSON-RPC server deployment.`);
        readmePaths.push(`It uses placeholders like \`bundlebee.deployments.${name}.replicas\` you can force on the command line ot override the default (1).`);
        readmePaths.push('');

        moduleFolder.push({
            id: idGenerator(),
            name: 'configmap.json',
            content: configMap(name),
        });
        moduleFolder.push({
            id: idGenerator(),
            name: 'service.json',
            content: service(name),
        });
        moduleFolder.push({
            id: idGenerator(),
            name: 'deployment.json',
            content: deployment(
                singleModule, name, artifactId,
                useFusion ? 'io.yupiik.fusion.framework.api.main.Launcher' : 'org.apache.openwebbeans.se.CDILauncher',
                useFusion ? [] : BUNDLEBEE_TOMCAT_ARGS,
                true, []),
        });
    }
    if (batch) {
        const moduleFolder = getOrCreateFolder(kubernetesSubFolder, 'batch', idGenerator);
        const name = `${artifactId}-batch`;

        readmePaths.push(`\`kubernetes/${groupId}/${artifactId}/batch/configmap.json\` contains the batch configuration in the data map (matches \`BatchConfiguration\`).`);
        readmePaths.push('');
        readmePaths.push(`\`kubernetes/${groupId}/${artifactId}/batch/cronjob.json\` contains the cron job to launch your batch (by default set to \`@yearly\` to not run unexpetedly).`);
        readmePaths.push('');

        moduleFolder.push({
            id: idGenerator(),
            name: 'configmap.json',
            content: configMap(name, [
                '    "SIMPLEBATCH_SKIPTRACING":"{{bundlebee.cronjob.simplebatch.configuration.skipTracing:-true}}",',
                '    "SIMPLEBATCH_TRACING_DATASOURCE_DRIVER":"{{bundlebee.cronjob.simplebatch.configuration.driver:-TBD}}",',
                '    "SIMPLEBATCH_TRACING_DATASOURCE_URL":"{{bundlebee.cronjob.simplebatch.configuration.url:-TBD}}",',
                '    "SIMPLEBATCH_TRACING_DATASOURCE_USERNAME":"{{bundlebee.cronjob.simplebatch.configuration.username:-TBD}}",',
                '    "SIMPLEBATCH_TRACING_DATASOURCE_PASSWORD":"{{bundlebee.cronjob.simplebatch.configuration.password:-TBD}}"',
            ]),
        });
        moduleFolder.push({
            id: idGenerator(),
            name: 'cronjob.json',
            content: [
                '{',
                '  "apiVersion": "batch/v1",',
                '  "kind": "CronJob",',
                '  "metadata": {',
                `    "name": "${name}",`,
                '    "labels": {',
                `      "app": "${name}",`,
                '      "deploy.by":"{{user.name:-unknown}}"',
                '    }',
                '  },',
                '  "spec":{',
                '    "jobTemplate":{',
                '      "spec":{',
                '        "backoffLimit":1,',
                '        "activeDeadlineSeconds":720,',
                '        "template":{',
                '          "metadata":{',
                '            "labels":{',
                `              "app": "${name}",`,
                `              "deploy.by":"{{user.name:-unknown}}",`,
                `              "deploy.at":"{{app.deploytime:-unset}}",`,
                `              "app.environment":"{{bundlebee.environment}}"`,
                '            }',
                '          },',
                '          "spec":{',
                '            "restartPolicy":"Never",',
                '            "containers": [',
                '              {',
                `                "app": "${name}",`,
                `                "image":"{{image.registry}}/${artifactId}:{{project.version}}",`,
                '                "imagePullPolicy": "{{bundlebee.image.pullPolicy:-IfNotPresent}}",',
                ...(singleModule ? [
                    '                "command": [',
                    '                  "java",',
                    '                  "-Djava.util.logging.manager=io.yupiik.logging.jul.YupiikLogManager",',
                    '                  "-Dio.yupiik.logging.jul.handler.StandardHandler.formatter=json",',
                    '                  "-Djava.security.egd=file:/dev/./urandom",',
                    '                  "-cp",',
                    `                  "@/opt/applications/${artifactId}/jib-classpath-file",`,
                    `                  "${pck}.batch.SimpleBatch"`,
                    '                ],',
                ] : []),

                '                "env": [',
                '                  {',
                '                    "name": "K8S_POD_NAME",',
                '                    "valueFrom": {',
                '                      "fieldRef": {',
                '                        "fieldPath":"metadata.name"',
                '                      }',
                '                    }',
                '                  },',
                '                  {',
                '                    "name": "K8S_POD_NAMESPACE",',
                '                    "valueFrom": {',
                '                      "fieldRef": {',
                '                        "fieldPath":"metadata.namespace"',
                '                      }',
                '                    }',
                '                  }',
                '                ],',
                '                "envFrom": [',
                '                  {',
                '                    "configMapRef": {',
                `                      "name": "${name}"`,
                '                    }',
                '                  }',
                '                ]',
                '              }',
                '            ]',
                '          }',
                '        }',
                '      }',
                '    },',
                `    "schedule":"{{bundlebee.cronjob.${artifactId}.schedule:-@yearly}}",`,
                `    "successfulJobsHistoryLimit": {{bundlebee.cronjob.${artifactId}.successfulJobsHistoryLimit:-14}},`,
                `    "failedJobsHistoryLimit": {{bundlebee.cronjob.${artifactId}.failedJobsHistoryLimit:-7}},`,
                `    "startingDeadlineSeconds": {{bundlebee.cronjob.${artifactId}.startingDeadlineSeconds:-500}},`,
                `    "concurrencyPolicy":"Forbid"`,
                '  }',
                '}',
            ].join('\n'),
        });
    }
    readmePaths.push('TIP: If you enabled documentation feature you can see the environment names to use there.');
    readmePaths.push('');
};

const injectHealthCheck = (files, groupId, artifactId, idGenerator, readmePaths, spec) => {
    const { main /*, test */ } = ensureBasePackage(files, idGenerator, groupId, artifactId);
    const pck = toPackage(groupId, artifactId);
    const mainProbe = getOrCreateFolder(main, 'probe', idGenerator);
    const useFusion = isUsingFusion(spec);

    readmePaths.push('Health checks are used by orchestrators (kubernetes typically) to check if an application is started, ready, live, ...');
    readmePaths.push('');
    if (useFusion) {
        readmePaths.push('The `HealthCheckEndpoints` provides a base implementation for ready and live checks.');
    } else {
        readmePaths.push('The `HealthCheckServlet` provides a base implementation for ready and live checks.');
    }
    readmePaths.push('First one (generally) must check if the application has the required dependencies and last one if the application is well behaving at runtime.');
    readmePaths.push('');
    readmePaths.push('To customize it at need in your application you should fill the `specific checks` parts.');
    readmePaths.push('');
    readmePaths.push('A common example is to `@Inject DataSource datasource;` if your application configured a datasource (not done in the generator) and check it is up:');
    readmePaths.push('');
    readmePaths.push('[source,java]');
    readmePaths.push('----');
    readmePaths.push('try (final var connection = dataSource.getConnection()) {');
    readmePaths.push('    if (!connection.isValid(10_000)) {');
    readmePaths.push('        throw new IllegalStateException("datasource not valid");');
    readmePaths.push('    }');
    readmePaths.push('}');
    readmePaths.push('----');
    readmePaths.push('');
    readmePaths.push('These probes are then wired to Kubernetes (or any orchestrator) to report the application status.');
    readmePaths.push('');

    if (useFusion) {
        mainProbe.push({
            id: idGenerator(),
            name: 'HealthCheckEndpoints.java',
            content: [
                `package ${pck}.probe;`,
                '',
                `import ${pck}.configuration.ApplicationConfiguration;`,
                'import io.yupiik.fusion.framework.api.scope.ApplicationScoped;',
                'import io.yupiik.fusion.framework.build.api.http.HttpMatcher;',
                'import io.yupiik.fusion.framework.build.api.http.HttpMatcher.PathMatching;',
                'import io.yupiik.fusion.http.server.api.Request;',
                'import io.yupiik.fusion.http.server.api.Response;',
                'import java.util.Objects;',
                '',
                'import static java.util.Locale.ROOT;',
                'import static java.util.Optional.ofNullable;',
                '',
                '@ApplicationScoped',
                'public class HealthCheckEndpoints {',
                '    private final ApplicationConfiguration configuration;',
                '',
                '    public HealthCheckEndpoints(final ApplicationConfiguration configuration) {',
                '        this.configuration = configuration;',
                '    }',
                '',
                '    @HttpMatcher(methods = "GET", path = "/health", pathMatching = PathMatching.EXACT)',
                '    protected Response health(final Request req) {',
                '        // heck the caller is allowed to access the probe (~security)',
                '        if (!Objects.equals(req.header("Health-Key"), configuration.healthKey())) {',
                '            return Response.of().status(404).build();',
                '        }',
                '',
                '        // no need of another server nor to pollute access log with this probe',
                '        req.setAttribute("skip-access-log", true);',
                '',
                '        // extract the kind of health probe',
                '        final var healthCheckType = ofNullable(req.query())',
                '                .map(it -> it.toLowerCase(ROOT))',
                '                .map(q -> q.contains("ready") ? "ready" : "live")',
                '                .orElse("live");',
                '',
                '        // do the needed checks, do fail (exception) if there is an issue',
                '        switch (healthCheckType) {',
                '           case "ready":',
                '               // do "readiness" specific checks',
                '               break;',
                '           case "live":',
                '           default:',
                '               // do "liveness" specific checks',
                '        }',
                '',
                '        // optional, returns something in success case',
                '        return Response.of().status(200).body("{\\"status\\":\\"OK\\"}").build();',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    } else {
        mainProbe.push({
            id: idGenerator(),
            name: 'HealthCheckServlet.java',
            content: [
                `package ${pck}.probe;`,
                '',
                `import ${pck}.configuration.ApplicationConfiguration;`,
                'import jakarta.enterprise.context.Dependent;',
                'import jakarta.inject.Inject;',
                'import jakarta.servlet.http.HttpServlet;',
                'import jakarta.servlet.http.HttpServletRequest;',
                'import jakarta.servlet.http.HttpServletResponse;',
                'import java.io.IOException;',
                'import java.util.Objects;',
                '',
                'import static java.util.Locale.ROOT;',
                'import static java.util.Optional.ofNullable;',
                '',
                '@Dependent',
                'public class HealthCheckServlet extends HttpServlet {',
                '    @Inject',
                '    private ApplicationConfiguration configuration;',
                '',
                '    @Override',
                '    protected void doGet(final HttpServletRequest req, final HttpServletResponse resp) throws IOException {',
                '        // heck the caller is allowed to access the probe (~security)',
                '        if (!Objects.equals(req.getHeader("Health-Key"), configuration.getHealthKey())) {',
                '            resp.sendError(HttpServletResponse.SC_NOT_FOUND);',
                '            return;',
                '        }',
                '',
                '        // no need of another server nor to pollute access log with this probe',
                '        req.setAttribute("skip-access-log", true);',
                '',
                '        // extract the kind of health probe',
                '        final var healthCheckType = ofNullable(req.getQueryString())',
                '                .map(it -> it.toLowerCase(ROOT))',
                '                .map(q -> q.contains("ready") ? "ready" : "live")',
                '                .orElse("live");',
                '',
                '        // do the needed checks, do fail (exception) if there is an issue',
                '        switch (healthCheckType) {',
                '           case "ready":',
                '               // do "readiness" specific checks',
                '               break;',
                '           case "live":',
                '           default:',
                '               // do "liveness" specific checks',
                '        }',
                '',
                '        // optional, returns something in success case',
                '        try (final var writer = resp.getWriter()) {',
                '            writer.write("{\\"status\\":\\"OK\\"}");',
                '        }',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
        mainProbe.push({
            id: idGenerator(),
            name: 'HealthCheckServletRegistrar.java',
            content: [
                `package ${pck}.probe;`,
                '',
                'import jakarta.enterprise.context.Dependent;',
                'import jakarta.inject.Inject;',
                'import jakarta.servlet.ServletContainerInitializer;',
                'import jakarta.servlet.ServletContext;',
                'import java.util.Set;',
                '',
                '// thanks uship tomcat-webserver, we can register the health servlet this way',
                '@Dependent',
                'public class HealthCheckServletRegistrar implements ServletContainerInitializer {',
                '    @Inject',
                '    private HealthCheckServlet healthServlet;',
                '',
                '    @Override',
                '    public void onStartup(final Set<Class<?>> c, final ServletContext ctx) {',
                '        final var health = ctx.addServlet("health", healthServlet);',
                '        health.setLoadOnStartup(1);',
                '        health.addMapping("/health");',
                '        ctx.log("Registered health check");',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    }
};

const injectJsonRpc = (files, groupId, artifactId, idGenerator, hasFeature, readmePaths, spec) => {
    const { main, test } = ensureBasePackage(files, idGenerator, groupId, artifactId);
    const pck = toPackage(groupId, artifactId);
    const hasK8sClient = hasFeature('kubernetesClient');
    const frontend = hasFeature('frontend');
    const useFusion = isUsingFusion(spec);

    if (useFusion) {
        readmePaths.push('The application uses Yupiik Fusion IoC.');
    } else {
        readmePaths.push('The application uses CDI as IoC, this is why `beans.xml` file is there - but you don\'t need to edit it in general.');
    }
    readmePaths.push('');
    readmePaths.push('`ServerConfigurationProducer` file configured from the application specific configuration the embedded Tomcat.');
    readmePaths.push('');
    if (!spec.skipGeneration) {
        readmePaths.push('`GreetingEndpoint` is a sample JSON-RPC endpoint. You can add as much `@JsonRpcMethod` you need in this class or another one marked with `@JsonRpc`.');
        if (useFusion) {
            readmePaths.push('These endpoints use Fusion JSON to map the models, you have to use records and `@JsonXXX` annotations.');
        } else {
            readmePaths.push('These endpoints use JSON-B to map the models, you can use POJO or records and `@JsonbXXX` annotations.');
        }
        readmePaths.push('');
        readmePaths.push('Finally, `GreetingEndpointTest` shows a basic test using a random port for Tomcat server.');
        readmePaths.push('It relies on a JUnit5 stereotype `@ApplicationSupport` which ensure the test is executed in the application context.');
        if (!useFusion) {
            readmePaths.push('By default (`@Cdi(reusable = true)`), the context is reused accross tests so ensure to not leak any state.');
        }
        readmePaths.push('');
        if (useFusion) {
            readmePaths.push('TIP: the test is written as a client test but you can also inject your `GreetingEndpoint` bean marking a method parameter with `@Fusion` and test it as a standard bean in such a test.');
        } else {
            readmePaths.push('TIP: the test is written as a client test but you can also `@Inject` your `GreetingEndpoint` bean and test it as a standard bean in such a test.');
        }
        readmePaths.push('');
    }

    if (!useFusion) { // ensure CDI is enabled
        getOrCreateFolder(files, 'src/main/resources/META-INF', idGenerator).push({
            id: idGenerator(),
            name: 'beans.xml',
            content: [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<beans bean-discovery-mode="all" version="2.0"',
                '       xmlns="http://xmlns.jcp.org/xml/ns/javaee"',
                '       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
                '       xsi:schemaLocation="',
                '        http://xmlns.jcp.org/xml/ns/javaee',
                '        http://xmlns.jcp.org/xml/ns/javaee/beans_2_0.xsd">',
                '  <trim/>',
                '</beans>',
                '',
            ].join('\n'),
        });
    }

    // customize the configuration of tomcat server
    const webServer = getOrCreateFolder(main, 'web/server', idGenerator);
    if (!useFusion) {
        webServer.push({
            id: idGenerator(),
            name: 'ServerConfigurationProducer.java',
            content: [
                `package ${pck}.web.server;`,
                '',
                'import org.apache.catalina.Lifecycle;',
                'import org.apache.catalina.servlets.DefaultServlet;',
                `import ${pck}.configuration.ApplicationConfiguration;`,
                'import io.yupiik.uship.webserver.tomcat.TomcatWebServerConfiguration;',
                'import jakarta.enterprise.context.ApplicationScoped;',
                'import jakarta.enterprise.inject.Produces;',
                'import org.apache.catalina.valves.AbstractAccessLogValve;',
                ...(frontend ? ['import org.apache.catalina.startup.Tomcat;'] : []),
                'import java.util.List;',
                'import java.util.stream.Stream;',
                '',
                '@ApplicationScoped',
                'public class ServerConfigurationProducer {',
                '    // propagate our configuration to Tomcat Server (unified configuration key)',
                '    @Produces',
                '    @ApplicationScoped',
                '    public TomcatWebServerConfiguration configuration(',
                '            final ApplicationConfiguration configuration) {',
                '        final var tomcat = new TomcatWebServerConfiguration();',
                '        tomcat.setPort(configuration.getPort());',
                '        tomcat.setAccessLogPattern(configuration.getAccessLogPattern());',
                '',
                '        // ensure we can set skip-access-log attribute in servlet request to skip the access log',
                '        // it is very useful for probes for example',
                '        tomcat.setContextCustomizers(List.of(ctx -> {',
                '            ctx.setParentClassLoader(Thread.currentThread().getContextClassLoader());',
                '',
                '            Stream.of(ctx.getPipeline().getValves())',
                '                .filter(AbstractAccessLogValve.class::isInstance)',
                '                .map(AbstractAccessLogValve.class::cast)',
                '               .forEach(v -> v.setCondition("skip-access-log"));',
                ...(frontend ? [
                    '',
                    '               // configure frontend resource binding when set up',
                    '               final var resources = configuration.getResources();',
                    '               if (resources != null && resources.getDocBase() != null) {',
                    '                   ctx.setDocBase(resources.getDocBase());',
                    '                   if (!resources.isWebResourcesCached()) {',
                    '                       ctx.addLifecycleListener(event -> {',
                    '                           if (Lifecycle.CONFIGURE_START_EVENT.equals(event.getType())) {',
                    '                               ctx.getResources().setCachingAllowed(resources.isWebResourcesCached());',
                    '                           }',
                    '                       });',
                    '                   }',
                    '                   final var defaultServlet = Tomcat.addServlet(ctx, "default", DefaultServlet.class.getName());',
                    '                   defaultServlet.setLoadOnStartup(1);',
                    '                   ctx.addServletMappingDecoded("/", "default");',
                    '                   ctx.addMimeMapping("css", "text/css");',
                    '                   ctx.addMimeMapping("js", "application/javascript");',
                    '                   ctx.addMimeMapping("html", "text/html");',
                    '                   ctx.addMimeMapping("svg", "image/svg+xml");',
                    '                   ctx.addMimeMapping("png", "image/png");',
                    '                   ctx.addMimeMapping("jpg", "image/jpg");',
                    '                   ctx.addMimeMapping("jpeg", "image/jpeg");',
                    '                   ctx.addWelcomeFile("index.html");',
                    '                   ctx.getLogger().info("Registered frontend");',
                    '               }',
                ] : []),
                '        }));',
                '        return tomcat;',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    } else {
        webServer.push({
            id: idGenerator(),
            name: 'ServerConfigurationProducer.java',
            content: [
                `package ${pck}.web.server;`,
                '',
                ...(frontend ? [
                    'import org.apache.catalina.Lifecycle;',
                    'import org.apache.catalina.servlets.DefaultServlet;',
                ] : []),
                `import ${pck}.configuration.ApplicationConfiguration;`,
                'import io.yupiik.fusion.framework.api.scope.DefaultScoped;',
                'import io.yupiik.fusion.framework.build.api.event.OnEvent;',
                'import io.yupiik.fusion.http.server.api.WebServer;',
                ...(frontend ? [
                    'import io.yupiik.fusion.http.server.impl.tomcat.TomcatWebServerConfiguration;',
                    'import org.apache.catalina.startup.Tomcat;',
                    'import java.util.List;',
                ] : []),
                '',
                '@DefaultScoped',
                'public class ServerConfigurationProducer {',
                '    // propagate our configuration to Tomcat Server (unified configuration key)',
                '    public void configuration(',
                '            @OnEvent final WebServer.Configuration webConf,',
                '            final ApplicationConfiguration configuration) {',
                '        webConf.port(configuration.port());',
                '        webConf.accessLogPattern(configuration.accessLogPattern());',
                ...(frontend ? [
                    '',
                    '        final var tomcat = webConf.unwrap(TomcatWebServerConfiguration.class);',
                    '        tomcat.setContextCustomizers(List.of(ctx -> {',
                    '               // configure frontend resource binding when set up',
                    '               final var resources = configuration.resources();',
                    '               if (resources != null && resources.docBase() != null) {',
                    '                   ctx.setDocBase(resources.docBase());',
                    '                   if (!resources.webResourcesCached()) {',
                    '                       ctx.addLifecycleListener(event -> {',
                    '                           if (Lifecycle.CONFIGURE_START_EVENT.equals(event.getType())) {',
                    '                               ctx.getResources().setCachingAllowed(resources.webResourcesCached());',
                    '                           }',
                    '                       });',
                    '                   }',
                    '                   final var defaultServlet = Tomcat.addServlet(ctx, "default", DefaultServlet.class.getName());',
                    '                   defaultServlet.setLoadOnStartup(1);',
                    '                   ctx.addServletMappingDecoded("/", "default");',
                    '                   ctx.addMimeMapping("css", "text/css");',
                    '                   ctx.addMimeMapping("js", "application/javascript");',
                    '                   ctx.addMimeMapping("html", "text/html");',
                    '                   ctx.addMimeMapping("svg", "image/svg+xml");',
                    '                   ctx.addMimeMapping("png", "image/png");',
                    '                   ctx.addMimeMapping("jpg", "image/jpg");',
                    '                   ctx.addMimeMapping("jpeg", "image/jpeg");',
                    '                   ctx.addWelcomeFile("index.html");',
                    '                   ctx.getLogger().info("Registered frontend");',
                    '               }',
                    '        }));',
                ] : []),
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    }

    if (hasK8sClient) { // if there is a k8s client, ensure it is a CDI bean available in the application
        const k8sClient = getOrCreateFolder(main, 'k8s/client', idGenerator);
        if (!useFusion) {
            k8sClient.push({
                id: idGenerator(),
                name: 'K8sClientProducer.java',
                content: [
                    `package ${pck}.k8s.client;`,
                    '',
                    `import ${pck}.configuration.ApplicationConfiguration;`,
                    'import io.yupiik.uship.kubernetes.client.KubernetesClient;',
                    'import io.yupiik.uship.kubernetes.client.KubernetesClientConfiguration;',
                    'import jakarta.inject.Inject;',
                    'import jakarta.enterprise.context.ApplicationScoped;',
                    'import jakarta.enterprise.inject.Produces;',
                    'import jakarta.annotation.PostConstruct;',
                    'import jakarta.annotation.PreDestroy;',
                    '',
                    '@ApplicationScoped',
                    'public class K8sClientProducer {',
                    '    @Inject',
                    '    private ApplicationConfiguration configuration;',
                    '',
                    '    private KubernetesClient client;',
                    '',
                    '    @PostConstruct',
                    '    private void create() {',
                    '        client = new KubernetesClient(configuration.getK8sClient());',
                    '    }',
                    '',
                    '    @PreDestroy',
                    '    private void release() {',
                    '        client.close();',
                    '    }',
                    '',
                    '    @Produces',
                    '    public KubernetesClient client() {',
                    '        return client;',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            });
        } else {
            k8sClient.push({
                id: idGenerator(),
                name: 'K8sClientProducer.java',
                content: [
                    `package ${pck}.k8s.client;`,
                    '',
                    `import ${pck}.configuration.ApplicationConfiguration;`,
                    'import io.yupiik.fusion.kubernetes.client.KubernetesClient;',
                    'import io.yupiik.fusion.kubernetes.client.KubernetesClientConfiguration;',
                    'import io.yupiik.fusion.framework.api.scope.ApplicationScoped;',
                    'import io.yupiik.fusion.framework.api.scope.DefaultScoped;',
                    'import io.yupiik.fusion.framework.build.api.scanning.Bean;',
                    '',
                    '@DefaultScoped',
                    'public class K8sClientProducer {',
                    '    @Bean',
                    '    @ApplicationScoped',
                    '    public KubernetesClient client(final ApplicationConfiguration configuration) {',
                    '        // TODO: wire more confguration from this.configuration to enable "out of cluster" clients for example, depends your need',
                    '        return new KubernetesClient(new KubernetesClientConfiguration());',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            });
        }
    }

    if (spec.skipGeneration) {
        return;
    }

    // one sample endpoint
    const mainJsonRpc = getOrCreateFolder(main, 'jsonrpc', idGenerator);
    mainJsonRpc.push({
        id: idGenerator(),
        name: 'Greeting.java',
        content: [
            `package ${pck}.jsonrpc;`,
            '',
            ...(useFusion ? [
                'import io.yupiik.fusion.framework.build.api.json.JsonModel;',
                '',
                '@JsonModel',
            ] : []),
            'public record Greeting(String message) {',
            '}',
            '',
        ].join('\n'),
    });
    if (!useFusion) {
        mainJsonRpc.push({
            id: idGenerator(),
            name: 'GreetingEndpoint.java',
            content: [
                `package ${pck}.jsonrpc;`,
                '',
                'import io.yupiik.uship.jsonrpc.core.api.JsonRpc;',
                'import io.yupiik.uship.jsonrpc.core.api.JsonRpcError;',
                'import io.yupiik.uship.jsonrpc.core.api.JsonRpcMethod;',
                'import io.yupiik.uship.jsonrpc.core.api.JsonRpcParam;',
                'import jakarta.enterprise.context.ApplicationScoped;',
                '',
                '@JsonRpc',
                '@ApplicationScoped',
                'public class GreetingEndpoint {',
                '',
                '    // if needed you can inject other beans:',
                '    // @Inject ApplicationConfiguration configuration;',
                ...(hasK8sClient ? ['    // @Inject KubernetesClient k8sClient;'] : []),
                '',
                '    @JsonRpcError(code = 400, documentation = "Invalid incoming data.")',
                '    @JsonRpcMethod(name = "greet", documentation = "Returns some greeting.")',
                '    public Greeting greet(',
                '          @JsonRpcParam(documentation = "Name of the person.", required = true)',
                '          final String name) {',
                '        return new Greeting("Hi " + name);',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    } else {
        mainJsonRpc.push({
            id: idGenerator(),
            name: 'GreetingEndpoint.java',
            content: [
                `package ${pck}.jsonrpc;`,
                '',
                'import io.yupiik.fusion.framework.api.scope.ApplicationScoped;',
                'import io.yupiik.fusion.framework.build.api.jsonrpc.JsonRpc;',
                'import io.yupiik.fusion.framework.build.api.jsonrpc.JsonRpcError;',
                'import io.yupiik.fusion.framework.build.api.jsonrpc.JsonRpcParam;',
                '',
                '@ApplicationScoped',
                'public class GreetingEndpoint {',
                '    // if needed you can inject other beans inject them using a constructor:',
                '    // public GreetingEndpoint(',
                '    //    final ApplicationConfiguration configuration' + (hasK8sClient ? ',' : ''),
                ...(hasK8sClient ? ['    // final KubernetesClient k8sClient'] : []),
                '    // ) {',
                '    //     this.configuration = configuration;',
                ...(hasK8sClient ? ['    //     this.k8sClient = k8sClient;'] : []),
                '    // }',
                '',
                '    @JsonRpc(',
                '        value = "greet", documentation = "Returns some greeting.",',
                '        errors = @JsonRpcError(code = 400, documentation = "Invalid incoming data."))',
                '    public Greeting greet(',
                '          @JsonRpcParam(documentation = "Name of the person.", required = true)',
                '          final String name) {',
                '        return new Greeting("Hi " + name);',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    }

    // tests
    const testJsonRpc = getOrCreateFolder(test, 'jsonrpc', idGenerator);
    const testInfra = getOrCreateFolder(test, 'test', idGenerator);
    if (!useFusion) {
        testInfra.push({
            id: idGenerator(),
            name: 'ApplicationSupport.java',
            content: [
                `package ${pck}.test;`,
                '',
                'import org.apache.openwebbeans.junit5.Cdi;',
                'import org.junit.jupiter.api.extension.ExtendWith;',
                '',
                'import java.lang.annotation.Retention;',
                'import java.lang.annotation.Target;',
                '',
                'import static java.lang.annotation.ElementType.TYPE;',
                'import static java.lang.annotation.RetentionPolicy.RUNTIME;',
                '',
                '@Target(TYPE)',
                '@Retention(RUNTIME)',
                '@ExtendWith({',
                '  SetEnvironment.class',
                '  // add your other extensions there to ensure they are available for all tests',
                '})',
                '@Cdi(reusable = true)',
                'public @interface ApplicationSupport {',
                '}',
                '',
            ].join('\n'),
        });
    } else {
        testInfra.push({
            id: idGenerator(),
            name: 'ApplicationSupport.java',
            content: [
                `package ${pck}.test;`,
                '',
                'import io.yupiik.fusion.testing.MonoFusionSupport;',
                'import org.junit.jupiter.api.extension.ExtendWith;',
                '',
                'import java.lang.annotation.Retention;',
                'import java.lang.annotation.Target;',
                '',
                'import static java.lang.annotation.ElementType.TYPE;',
                'import static java.lang.annotation.RetentionPolicy.RUNTIME;',
                '',
                '@Target(TYPE)',
                '@Retention(RUNTIME)',
                '@ExtendWith({',
                '  SetEnvironment.class',
                '  // add your other extensions there to ensure they are available for all tests',
                '})',
                '@MonoFusionSupport',
                'public @interface ApplicationSupport {',
                '}',
                '',
            ].join('\n'),
        });
    }
    testInfra.push({
        id: idGenerator(),
        name: 'SetEnvironment.java',
        content: [
            `package ${pck}.test;`,
            '',
            'import org.junit.jupiter.api.extension.Extension;',
            '',
            'public class SetEnvironment implements Extension {',
            '    static {',
            '        // You can configure your test environment there, it is setup before CDI container starts',
            '',
            '        // use a random tomcat port for tests using our specific configuration' + (useFusion ? ', fusion.http-server.port would work too' : ''),
            `        System.setProperty("${artifactId}-tomcat-port", "0");`,
            '    }',
            '}',
            '',
        ].join('\n'),
    });
    if (!useFusion) {
        testJsonRpc.push({
            id: idGenerator(),
            name: 'GreetingEndpointTest.java',
            content: [
                `package ${pck}.jsonrpc;`,
                '',
                `import io.yupiik.uship.webserver.tomcat.TomcatWebServerConfiguration;`,
                `import ${pck}.test.ApplicationSupport;`,
                'import jakarta.inject.Inject;',
                'import jakarta.json.JsonBuilderFactory;',
                'import org.junit.jupiter.api.Test;',
                'import org.junit.jupiter.api.TestInstance;',
                'import java.io.IOException;',
                'import java.net.URI;',
                'import java.net.http.HttpClient;',
                'import java.net.http.HttpRequest;',
                'import java.net.http.HttpResponse;',
                '',
                'import static java.nio.charset.StandardCharsets.UTF_8;',
                'import static org.junit.jupiter.api.Assertions.assertEquals;',
                'import static org.junit.jupiter.api.TestInstance.Lifecycle.PER_CLASS;',
                '',
                '@ApplicationSupport',
                '@TestInstance(PER_CLASS)',
                'public class GreetingEndpointTest {',
                '    @Inject',
                '    private JsonBuilderFactory json;',
                '',
                '    @Inject // enables to get the random server port',
                '    private TomcatWebServerConfiguration server;',
                '',
                '    private final HttpClient client = HttpClient.newHttpClient();',
                '',
                '    @Test',
                '    void greet() throws IOException, InterruptedException {',
                '        final var res = client.send(',
                '            HttpRequest.newBuilder()',
                '                .POST(HttpRequest.BodyPublishers.ofString(json.createObjectBuilder()',
                '                    .add("jsonrpc", "2.0")',
                '                    .add("method", "greet")',
                '                    .add("params", json.createObjectBuilder()',
                '                        .add("name", "test"))',
                '                    .build()',
                '                    .toString(), UTF_8))',
                '                .uri(URI.create("http://localhost:" + server.getPort() + "/jsonrpc"))',
                '                .header("Accept", "application/json")',
                '                .header("Content-Type", "application/json")',
                '                .build(),',
                '            HttpResponse.BodyHandlers.ofString(UTF_8));',
                '        assertEquals(200, res.statusCode());',
                '        assertEquals("{\\"jsonrpc\\":\\"2.0\\",\\"result\\":{\\"message\\":\\"Hi test\\"}}", res.body());',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    } else {
        testJsonRpc.push({
            id: idGenerator(),
            name: 'GreetingEndpointTest.java',
            content: [
                `package ${pck}.jsonrpc;`,
                '',
                `import io.yupiik.fusion.http.server.api.WebServer;`,
                `import io.yupiik.fusion.json.JsonMapper;`,
                `import io.yupiik.fusion.testing.Fusion;`,
                `import ${pck}.test.ApplicationSupport;`,
                'import org.junit.jupiter.api.Test;',
                'import org.junit.jupiter.api.TestInstance;',
                'import java.util.Map;',
                'import java.io.IOException;',
                'import java.net.URI;',
                'import java.net.http.HttpClient;',
                'import java.net.http.HttpRequest;',
                'import java.net.http.HttpResponse;',
                '',
                'import static java.nio.charset.StandardCharsets.UTF_8;',
                'import static org.junit.jupiter.api.Assertions.assertEquals;',
                'import static org.junit.jupiter.api.TestInstance.Lifecycle.PER_CLASS;',
                '',
                '@ApplicationSupport',
                '@TestInstance(PER_CLASS)',
                'public class GreetingEndpointTest {',
                '    private final HttpClient client = HttpClient.newHttpClient();',
                '',
                '    @Test',
                '    void greet(@Fusion final WebServer.Configuration server, @Fusion final JsonMapper json) throws IOException, InterruptedException {',
                '        final var res = client.send(',
                '            HttpRequest.newBuilder()',
                '                .POST(HttpRequest.BodyPublishers.ofString(json.toString(Map.of(',
                '                    "jsonrpc", "2.0", "method", "greet", "params", Map.of("name", "test"))), UTF_8))',
                '                .uri(URI.create("http://localhost:" + server.port() + "/jsonrpc"))',
                '                .header("Accept", "application/json")',
                '                .header("Content-Type", "application/json")',
                '                .build(),',
                '            HttpResponse.BodyHandlers.ofString(UTF_8));',
                '        assertEquals(200, res.statusCode());',
                '        assertEquals("{\\"jsonrpc\\":\\"2.0\\",\\"result\\":{\\"message\\":\\"Hi test\\"}}", res.body());',
                '    }',
                '}',
                '',
            ].join('\n'),
        });
    }
};

const injectConfiguration = (files, { groupId, artifactId }, idGenerator, hasFeature, readmePaths, spec) => {
    const pck = toPackage(groupId, artifactId);
    const hasJsonRpc = hasFeature('jsonRpc');
    const hasK8sClient = hasFeature('kubernetesClient');
    const frontend = hasFeature('frontend');
    const health = hasFeature('jib') || hasFeature('bundlebee');
    const useFusion = isUsingFusion(spec);

    readmePaths.push('`ApplicationConfiguration` contains the application configuration.');
    readmePaths.push('');
    if (useFusion) {
        readmePaths.push('It uses Yupiik Fusion Configuration mecanism which uses system properties and environment variable to bind values on a record.');
    } else {
        readmePaths.push('It uses Yupiik `simple-configuration` and `@Param` to bind the configuration.');
    }
    readmePaths.push('');
    readmePaths.push('It enables to inject the configuration from system properties or environment variable.');
    readmePaths.push('');

    const base = getOrCreateFolder(ensureBasePackage(files, idGenerator, groupId, artifactId).main, 'configuration', idGenerator);
    if (useFusion) {
        base.push({
            id: idGenerator(),
            name: 'ApplicationConfiguration.java',
            content: [
                `package ${pck}.configuration;`,
                '',
                'import io.yupiik.fusion.framework.api.scope.ApplicationScoped;',
                'import io.yupiik.fusion.framework.build.api.configuration.Property;',
                'import io.yupiik.fusion.framework.build.api.configuration.RootConfiguration;',
                '',
                '// hosts the application configuration, you can add @Param as you need',
                '// by default fusion makes it injectable directly in any bean',
                '@ApplicationScoped',
                `@RootConfiguration("${artifactId}") // will be the prefix of the system properties filtered to bind on the instance`,
                'public record ApplicationConfiguration(',
                ...(hasJsonRpc ? [
                    '    @Property(value = "tomcat-port", documentation = "Tomcat port.", defaultValue = "8080")',
                    '    int port,',
                    '',
                    '    @Property(value = "tomcat-accessLogPattern", documentation = "Tomcat access log pattern.", defaultValue = "\\"common\\"")',
                    '    String accessLogPattern' + (frontend || health ? ',' : ''),
                    ''
                ] : []),
                ...(frontend ? [
                    '    @Property(value = "resources", documentation = "Frontend resources configuration.", defaultValue = "new ApplicationConfiguration.ResourceConfiguration()")',
                    '    ResourceConfiguration resources' + (health ? ',' : ''),
                    ''
                ] : []),
                ...(health ? [
                    '    @Property(value = "health-key", documentation = "The value of the \'Health-Key\'/api key header to access health probe.", defaultValue = "\\"changeit\\"")',
                    '    String healthKey',
                    ''
                ] : []),
                ') {',
                ...(frontend ? [
                    '',
                    '    public record ResourceConfiguration(',
                    '        @Property(documentation = "If set, the folder is served through HTTP.")',
                    '        String docBase,',
                    '',
                    '        @Property(documentation = "Should web resource be cached, mainly useful when docBase is set.", defaultValue = "true")',
                    '        boolean webResourcesCached',
                    '    ) {',
                    '    }',
                ] : []),
                '}',
                '',
            ].join('\n'),
        });
    } else {
        base.push({
            id: idGenerator(),
            name: 'ApplicationConfiguration.java',
            content: [
                `package ${pck}.configuration;`,
                '',
                'import io.yupiik.batch.runtime.configuration.Binder;',
                'import io.yupiik.batch.runtime.configuration.Param;',
                'import io.yupiik.batch.runtime.configuration.Prefix;',
                ...(hasK8sClient ? ['import io.yupiik.uship.kubernetes.client.KubernetesClientConfiguration;'] : []),
                'import jakarta.annotation.PostConstruct;',
                'import jakarta.enterprise.context.ApplicationScoped;',
                '',
                '// hosts the application configuration, you can add @Param as you need',
                '@ApplicationScoped',
                `@Prefix("${artifactId}") // will be the prefix of the system properties filtered to bind on the instance`,
                'public class ApplicationConfiguration {',
                ...(hasJsonRpc ? [
                    `    @Param(name = "${artifactId}-tomcat-port", description = "Tomcat port.")`,
                    '    private int port = 8080;',
                    '',
                    `    @Param(name = "${artifactId}-tomcat-accessLogPattern", description = "Tomcat access log pattern.")`,
                    '    private String accessLogPattern = "common";',
                    ''
                ] : []),
                ...(frontend ? [
                    `    @Param(name = "${artifactId}-resources", description = "Frontend resources configuration.")`,
                    '    private ResourceConfiguration resources = new ResourceConfiguration();',
                    ''
                ] : []),
                ...(health ? [
                    `    @Param(name = "${artifactId}-health-key", description = "The value of the 'Health-Key'/api key header to access health probe.")`,
                    '    private String healthKey = "changeit";',
                    ''
                ] : []),
                ...(hasK8sClient ? [
                    `    @Param(name = "${artifactId}-kubernetes-client", description = "Kubernetes client configuration.")`,
                    '    private KubernetesClientConfiguration k8sClient = new KubernetesClientConfiguration();',
                    ''
                ] : []),
                '    @PostConstruct',
                '    private void init() {',
                '        Binder.bindPrefixed(this);',
                '    }',
                ...(hasJsonRpc ? [
                    '',
                    '    public int getPort() {',
                    '        return port;',
                    '    }',
                    '',
                    '    public String getAccessLogPattern() {',
                    '        return accessLogPattern;',
                    '    }',
                ] : []),
                ...(frontend ? [
                    '',
                    '    public ResourceConfiguration getResources() {',
                    '        return resources;',
                    '    }',
                ] : []),
                ...(health ? [
                    '',
                    '    public String getHealthKey() {',
                    '        return healthKey;',
                    '    }',
                ] : []),
                ...(hasK8sClient ? [
                    '',
                    '    public KubernetesClientConfiguration getK8sClient() {',
                    '        return k8sClient;',
                    '    }',
                ] : []),
                ...(frontend ? [
                    '',
                    '    public static class ResourceConfiguration {',
                    '        @Param(description = "If set, the folder is served through HTTP.")',
                    '        private String docBase;',
                    '',
                    '        @Param(description = "Should web resource be cached, mainly useful when docBase is set.")',
                    '        private boolean webResourcesCached = true;',
                    '',
                    '        public String getDocBase() {',
                    '            return docBase;',
                    '        }',
                    '',
                    '        public boolean isWebResourcesCached() {',
                    '            return webResourcesCached;',
                    '        }',
                    '    }',
                    ''
                ] : []),
                '}',
                '',
            ].join('\n'),
        });
    }
};

const injectFrontend = (files, groupId, artifactId, idGenerator, hasFeature, singleModule, readmePaths) => {
    const root = singleModule ? getOrCreateFolder(files, 'src/main/frontend', idGenerator) : files;

    readmePaths.push('The frontend module sets up:');
    readmePaths.push('');
    readmePaths.push('* ESBuild to build quickly your application with an extension to enable to import CSS and one to synchronize resources');
    readmePaths.push('* Preact to write components (like React but way lighter)');
    readmePaths.push('');

    // TODO: setup a server - if jsonrpc is not there - and add a servlet and registrar to serve the resource + exec-plugin to launch it

    // build setup
    root.push({
        id: idGenerator(),
        name: 'package.json',
        content: `{
            "private": true,
            "description": "${artifactId}",
            "scripts": {
                "build": "node ./esbuild",
                "watch": "NODE_ENV=dev npm run build"
            },
            "devDependencies": {
                "postcss": "^8.4.12",
                "postcss-modules": "^4.3.1",
                "preact": "^10.7.1",
                "esbuild": "^0.14.9",
                "fs-extra": "^10.0.0",
                "tmp": "^0.2.1"
            }
        }`.trim().replace(/^        /gm, ''),
    });
    const esbuild = getOrCreateFolder(root, 'esbuild', idGenerator);
    esbuild.push({
        id: idGenerator(),
        name: 'index.js',
        content: [
            'const dev = process.env.NODE_ENV === \'dev\';',
            '',
            'const resourcesPlugin = require(\'./resources.js\');',
            'const cssBundlePlugin = require(\'./css.js\');',
            '',
            'const outDir = \'../../../target/classes/META-INF/resources/\';',
            'const projectVersion = process.env.PROJECT_VERSION || \'dev\';',
            'const indexHtmlVersion = projectVersion.endsWith(\'-SNAPSHOT\') ?',
            '    process.env.BUILD_DATE.replace(\':\', \'-\') :',
            '    projectVersion;',
            '',
            'const onRebuild = () => resourcesPlugin({',
            '    assets: [',
            '        // resources to copy in target folder,',
            '        // from/to can be folders if an array of extensions to keep is passed in _extensions_ attribute',
            '        {',
            '            from: \'./index.html\',',
            '            to: outDir + \'index.html\',',
            '            replacements: [',
            '                {',
            '                    from: \'{{static.marker}}\',',
            '                    to: indexHtmlVersion,',
            '                },',
            '            ],',
            '        },',
            '    ],',
            '});',
            '',
            'require(\'esbuild\').build({',
            '    loader: { \'.js\': \'jsx\' },',
            '    entryPoints: [ \'./index.js\' ],',
            '    bundle: true,',
            '    metafile: dev,',
            '    minify: !dev,',
            '    sourcemap: dev,',
            '    legalComments: \'none\',',
            '    logLevel: \'info\',',
            '    target: [ \'chrome58\', \'firefox57\', \'safari11\' ],',
            '    outfile: outDir + \'js/app.js\',',
            '    jsxFactory: \'h\',',
            '    jsxFragment: \'Fragment\',',
            '    plugins: [ cssBundlePlugin() ],',
            '    watch: dev && { onRebuild },',
            '})',
            '.catch(() => process.exit(1))',
            '.finally(onRebuild);',
            '',
        ].join('\n'),
    });
    esbuild.push({
        id: idGenerator(),
        name: 'resources.js',
        content: resourcesTemplate,
    });
    esbuild.push({
        id: idGenerator(),
        name: 'css.js',
        content: cssTemplate,
    });

    // basic sources
    root.push({
        id: idGenerator(),
        name: 'index.html',
        content: indexTemplate.replace('{{artifactId}}', artifactId),
    });
    root.push({
        id: idGenerator(),
        name: 'index.js',
        content: `
        import { h, render } from 'preact';
        import { App } from './components/App';
        import './main.module.css';

        render(<App />, document.getElementById('app'));
        `.trim().replace(/^        /gm, ''),
    });
    getOrCreateFolder(root, 'components', idGenerator).push({
        id: idGenerator(),
        name: 'App.js',
        content: `
        import { h } from 'preact';

        export const App = () => (
            <h1>Hello ${artifactId}</h1>
        );
        `.trim().replace(/^        /gm, ''),
    });
    root.push({
        id: idGenerator(),
        name: 'main.module.css',
        content: `
        html {
          padding: 0;
          margin: 0;
        }
        `.trim().replace(/^        /gm, ''),
    });
};

const injectDocumentation = (files, groupId, artifactId, idGenerator, hasFeature, readmePaths, spec) => {
    const batch = hasFeature('batch');
    const jsonRpc = hasFeature('jsonRpc');
    const useFusion = isUsingFusion(spec);

    const srcMain = getOrCreateFolder(files, 'src/main', idGenerator);
    const { main } = ensureBasePackage(files, idGenerator, groupId, artifactId);
    const root = getOrCreateFolder(srcMain, 'minisite', idGenerator);
    const content = getOrCreateFolder(root, 'content', idGenerator);

    readmePaths.push('The documentation module sets up:');
    readmePaths.push('');
    readmePaths.push('* Documentation using yupiik minisite in `src/main/minisite/content`');
    readmePaths.push('');
    readmePaths.push('You can visualize the documentation running: `mvn process-classes yupiik-tools:serve-minisite [-Dyupiik.minisite.port=8080 [-Dyupiik.minisite.openBrowser=false]]`.');
    readmePaths.push('');

    // add doc generator
    const pck = toPackage(groupId, artifactId);
    const build = getOrCreateFolder(main, 'build', idGenerator);

    if (!useFusion) {
        build.push({
            id: idGenerator(),
            name: 'ConfigurationGenerator.java',
            content: [
                `package ${pck}.build;`,
                '',
                ...(batch ? [`import ${pck}.batch.SimpleBatch;`] : []),
                ...(jsonRpc ? [
                    `import ${pck}.configuration.ApplicationConfiguration;`,
                    `import ${pck}.jsonrpc.GreetingEndpoint;`,
                    `import io.yupiik.uship.jsonrpc.doc.AsciidoctorJsonRpcDocumentationGenerator;`,
                    'import io.yupiik.batch.runtime.batch.Batch;',
                ] : []),
                'import io.yupiik.batch.runtime.documentation.ConfigurationParameterCollector;',
                'import java.io.IOException;',
                'import java.io.PrintStream;',
                'import java.nio.file.Files;',
                'import java.nio.file.Path;',
                'import java.util.List;',
                'import java.util.Map;',
                '',
                'import static java.util.Locale.ROOT;',
                'import static java.util.stream.Collectors.joining;',
                '',
                '// used by minisite at build time to enrich the doc content',
                'public class ConfigurationGenerator implements Runnable {',
                '    private final Path sourceBase;',
                '',
                '    public ConfigurationGenerator(final Path sourceBase) {',
                '        this.sourceBase = sourceBase;',
                '    }',
                '',
                '    @Override',
                '    public void run() {',
                '        // here you can generate anything you want in generated partials dir and include it in your .adoc',
                '        final var base = sourceBase.resolve("content/_partials/generated");',
                '        try { // ensure base exists',
                '            Files.createDirectories(base);',
                '        } catch (final IOException e) {',
                '            throw new IllegalStateException(e);',
                '        }',
                ...(batch ? [
                    '',
                    `        generateConfiguration(base.resolve("${artifactId}.batch.configuration.adoc"), SimpleBatch.class);`,
                ] : []),
                ...(jsonRpc ? [
                    '',
                    `        generateConfiguration(base.resolve("${artifactId}.application.configuration.adoc"), AppFakeBatch.class);`,
                    `        generateJsonRpcApi("${artifactId} API", base.resolve("${artifactId}.jsonrpc.adoc"), List.of(GreetingEndpoint.class));`,
                ] : []),
                '    }',
                '',
                '    private void generateJsonRpcApi(final String name, final Path target, final List<Class<?>> classes) {',
                '        try (final var out = new PrintStream(Files.newOutputStream(target))) {',
                `            new AsciidoctorJsonRpcDocumentationGenerator(name, classes, out).run();`,
                '        } catch (final IOException e) {',
                '            throw new IllegalStateException(e);',
                '        }',
                '    }',
                '',
                '    private void generateConfiguration(final Path target, final Class<?> clazz) {',
                '        final var collector = new ConfigurationParameterCollector(List.of(Class.class.cast(clazz)));',
                '        final var params = collector.getWithPrefix(c -> null);',
                '        final var name = target.getFileName().toString().replace(".configuration.adoc", "");',
                '        final var adoc = "" +',
                '                "++++\\n" +',
                '                "<input table-filter=\\"" + name + "-configuration\\" class=\\"form-control\\" type=\\"text\\" placeholder=\\"Filter...\\">\\n" +',
                '                "++++\\n" +',
                '                "[." + name + "-configuration,options=\\"header\\",cols=\\"a,a,2\\",role=\\"autowrap\\"]\\n" +',
                '                "|===\\n" +',
                '                "|Name|Env Variable|Description\\n" +',
                '                params.entrySet().stream()',
                '                    .sorted(Map.Entry.comparingByKey())',
                '                    .map(e -> "" +',
                '                        "| `--" + e.getKey() + "` " + (e.getValue().param().required() ? "*" : "") +',
                '                        "| `" + e.getKey().replaceAll("[^A-Za-z0-9]", "_").toUpperCase(ROOT) + "` " +',
                '                        "| " + e.getValue().param().description() + "\\n")',
                '                    .sorted()',
                '                    .collect(joining()) + "\\n" +',
                '                "|===\\n" +',
                '                "";',
                '',
                '        try {',
                '            Files.writeString(target, adoc);',
                '        } catch (final IOException e) {',
                '            throw new IllegalStateException(e);',
                '        }',
                '    }',
                ...(jsonRpc ? [
                    '',
                    '    // fake batch class to use the parameter collector',
                    '    public static class AppFakeBatch implements Batch<ApplicationConfiguration> {',
                    '        @Override public void accept(final ApplicationConfiguration conf) {}',
                    '    }',
                ] : []),
                '}',
                '',
            ].join('\n'),
        });
    } else {
        // todo: fusion conf
        build.push({
            id: idGenerator(),
            name: 'ConfigurationGenerator.java',
            content: [
                `package ${pck}.build;`,
                '',
                ...(batch ? [
                    'import io.yupiik.batch.runtime.documentation.ConfigurationParameterCollector;',
                    `import ${pck}.batch.SimpleBatch;`,
                ] : []),
                ...(jsonRpc ? [
                    'import io.yupiik.fusion.documentation.OpenRpcGenerator;',
                    'import io.yupiik.fusion.documentation.OpenRPC2Adoc;',
                ] : []),
                'import java.io.IOException;',
                'import java.io.PrintStream;',
                'import java.nio.file.Files;',
                'import java.nio.file.Path;',
                'import java.util.List;',
                'import java.util.Map;',
                '',
                'import static java.util.Locale.ROOT;',
                'import static java.util.stream.Collectors.joining;',
                '',
                '// used by minisite at build time to enrich the doc content',
                'public class ConfigurationGenerator implements Runnable {',
                '    private final Path sourceBase;',
                '',
                '    public ConfigurationGenerator(final Path sourceBase) {',
                '        this.sourceBase = sourceBase;',
                '    }',
                '',
                '    @Override',
                '    public void run() {',
                '        // here you can generate anything you want in generated partials dir and include it in your .adoc',
                '        final var base = sourceBase.resolve("content/_partials/generated");',
                '        try { // ensure base exists',
                '            Files.createDirectories(base);',
                '        } catch (final IOException e) {',
                '            throw new IllegalStateException(e);',
                '        }',
                ...(batch ? [
                    '',
                    `        generateConfiguration(base.resolve("${artifactId}.batch.configuration.adoc"), SimpleBatch.class);`,
                ] : []),
                ...(jsonRpc ? [
                    `        generateJsonRpcApi("${artifactId} API", base.resolve("${artifactId}.openrpc.json"), base.resolve("${artifactId}.openrpc.adoc"));`,
                ] : []),
                '    }',
                ...(jsonRpc ? [
                    '',
                    '    private void generateJsonRpcApi(final String name, final Path targetJson, final Path targetAdoc) {',
                    '        new OpenRpcGenerator(Map.of("output", targetJson.toString(), "title", name)).run();',
                    '        new OpenRPC2Adoc(Map.of("input", targetJson.toString(), "output", targetAdoc.toString())).run();',
                    ...(useFusion ? [
                        `        new DocumentationGenerator(Map.of("includeEnvironmentNames", "true", "formatter", "definitionlist", "module", "${artifactId}")).run();`,
                    ] : []),
                    '    }',
                    '',
                ] : []),
                ...(batch ? [
                    '',
                    '    private void generateConfiguration(final Path target, final Class<?> clazz) {',
                    '        final var collector = new ConfigurationParameterCollector(List.of(Class.class.cast(clazz)));',
                    '        final var params = collector.getWithPrefix(c -> null);',
                    '        final var name = target.getFileName().toString().replace(".configuration.adoc", "");',
                    '        final var adoc = "" +',
                    '                "++++\\n" +',
                    '                "<input table-filter=\\"" + name + "-configuration\\" class=\\"form-control\\" type=\\"text\\" placeholder=\\"Filter...\\">\\n" +',
                    '                "++++\\n" +',
                    '                "[." + name + "-configuration,options=\\"header\\",cols=\\"a,a,2\\",role=\\"autowrap\\"]\\n" +',
                    '                "|===\\n" +',
                    '                "|Name|Env Variable|Description\\n" +',
                    '                params.entrySet().stream()',
                    '                    .sorted(Map.Entry.comparingByKey())',
                    '                    .map(e -> "" +',
                    '                        "| `--" + e.getKey() + "` " + (e.getValue().param().required() ? "*" : "") +',
                    '                        "| `" + e.getKey().replaceAll("[^A-Za-z0-9]", "_").toUpperCase(ROOT) + "` " +',
                    '                        "| " + e.getValue().param().description() + "\\n")',
                    '                    .sorted()',
                    '                    .collect(joining()) + "\\n" +',
                    '                "|===\\n" +',
                    '                "";',
                    '',
                    '        try {',
                    '            Files.writeString(target, adoc);',
                    '        } catch (final IOException e) {',
                    '            throw new IllegalStateException(e);',
                    '        }',
                    '    }',
                ] : []),
                '}',
                '',
            ].join('\n'),
        });
    }


    // doc itself
    content.push({
        id: idGenerator(),
        name: 'getting-started.adoc',
        content: [
            '= Getting Started',
            ':minisite-index: 100',
            ':minisite-index-title: Getting Started',
            ':minisite-index-description: Demo documentation page.',
            ':minisite-index-icon: desktop',
            ':minisite-keywords: demo, documentation',
            ':minisite-breadcrumb: Home[/] > Getting Started',
            '',
            'This documentation is generated by Yupiik minisite.',
            '',
        ].join('\n'),
    });

    if (hasFeature('jsonRpc')) {
        content.push({
            id: idGenerator(),
            name: 'json-rpc.adoc',
            content: [
                '= JSON-RPC API',
                ':minisite-index: 300',
                ':minisite-index-title: JSON-RPC',
                ':minisite-index-description: JSON-RPC API.',
                ':minisite-index-icon: laptop-house',
                ':minisite-keywords: api, json-rpc, documentation',
                ':minisite-breadcrumb: Home[/] > JSON-RPC API',
                '',
                '== Configuration',
                '',
                `include::{partialsdir}/generated/documentation.${artifactId}.adoc[]`,
                '',
                '== API',
                '',
                useFusion ?
                    `[source,json]\n----\ninclude::{partialsdir}/generated/${artifactId}.openrpc.adpc[leveloffset=+1]\n\n` +
                    `=== JSON\n\n[source,json]\n----\ninclude::{partialsdir}/generated/${artifactId}.openrpc.json[]\n----\n\n` :
                    `include::{partialsdir}/generated/${artifactId}.jsonrpc.adoc[lines=3..-1,leveloffset=+1]`,
                '',
            ].join('\n'),
        });
    }
    if (hasFeature('batch')) {
        // TODO: document batch specific configuration
        content.push({
            id: idGenerator(),
            name: 'batch.adoc',
            content: [
                '= Batch',
                ':minisite-index: 400',
                ':minisite-index-title: Batch',
                ':minisite-index-description: Batch API.',
                ':minisite-index-icon: code',
                ':minisite-keywords: batch, configuration, documentation',
                ':minisite-breadcrumb: Home[/] > Batch',
                '',
                'Here is the batch configuration:',
                '',
                `include::{partialsdir}/generated/${artifactId}.batch.configuration.adoc[]`,
                '',
            ].join('\n'),
        });
    }
    if (useFusion) {
        content.push({
            id: idGenerator(),
            name: 'configuration.adoc',
            content: [
                '= Configuration',
                ':minisite-index: 300',
                ':minisite-index-title: Configuration',
                ':minisite-index-description: Application Configuration.',
                ':minisite-index-icon: code',
                ':minisite-keywords: configuration, json-rpc, documentation',
                ':minisite-breadcrumb: Home[/] > Configuration',
                '',
                'Here is the application configuration:',
                '',
                `include::{partialsdir}/generated/documentation.${artifactId}.adoc[]`,
                '',
            ].join('\n'),
        });
    }
};

const injectGithub = (files, idGenerator, hasFeature, readmePaths, data) => {
    const documentation = hasFeature('documentation');

    readmePaths.push('Github workflow enables you to automatically execute command for your project for commits/pr.');
    readmePaths.push('');
    readmePaths.push('The `github` feature generated a basic Github workflow in `.github/workflows/maven.yaml` which builds the project automatically on commit.');
    if (documentation) {
        readmePaths.push('');
        readmePaths.push('IMPORTANT: since you enabled documentation feature the project set up a deployment skeleton (commented by default in `maven.yaml`).');
        readmePaths.push('If you want to enable continuous documentation deployment, ensure to create a `gh-pages` branch and to enable Github Pages for it.');
        readmePaths.push('See `DOC: ` comments in the yaml.');
    }
    readmePaths.push('');

    const github = getOrCreateFolder(files, '.github', idGenerator);
    github.push({
        id: idGenerator(),
        name: 'settings.xml',
        content: [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<settings>',
            '  <servers>',
            '    <id>github.com</id>',
            '    <!-- DOC: you can also setup a custom token in your secrets and wire it there and env: of the maven.yaml -->',
            '    <password>${env.GITHUB_TOKEN}</password>',
            '  </servers>',
            '</settings>',
            '',
        ].join('\n'),
    });

    const runsOn = 'ubuntu-20.04';
    const sharedStepsBefore = [
        '      - name: Clone',
        '        id: clone',
        '        uses: actions/checkout@v4',
        `      - name: Set up JDK ${data.nav.javaVersion}`,
        `        id: java${data.nav.javaVersion}`,
        '        uses: actions/setup-java@v4',
        '        with:',
        '          distribution: \'zulu\'',
        `          java-version: \'${data.nav.javaVersion}\'`,
        '          cache: \'maven\'',
    ];
    const sharedStepsAfter = [
        '      - name: Remove Snapshots Before Caching',
        '        run: find ~/.m2/repository -name \'*SNAPSHOT\' | xargs rm -Rf',
    ];
    getOrCreateFolder(github, 'workflows', idGenerator).push({
        id: idGenerator(),
        name: 'maven.yaml',
        content: [
            'name: Github CI',
            '',
            'on: [ push, pull_request ]',
            '',
            'env:',
            '  MAVEN_OPTS: -Dmaven.artifact.threads=256 -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn',
            ...(documentation ? [
                '  GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}',
            ] : []),
            '',
            'jobs:',
            '  build:',
            '    name: Main Build',
            `    runs-on: ${runsOn}`,
            '    steps:',
            ...sharedStepsBefore,
            '      - name: Build',
            `        run: mvn package -e`,
            ...sharedStepsAfter,
            ...(documentation ? [
                '  DOC: ensure to set the needed secrets (see README.adoc)',
                '  deploy-doc:',
                '    if: github.ref == \'refs/heads/main\'',
                '    name: Documentation',
                `    runs-on: ${runsOn}`,
                '    steps:',
                ...sharedStepsBefore,
                '      - name: Deploy-Documentation',
                '        run: mvn package -Pgh-pages -e',
                ...sharedStepsAfter,
            ].map(it => it.replace('  ', '  # ')) : []),
            '',
        ].join('\n'),
    });
};

const injectSingle = (files, { groupId, artifactId }, feature, idGenerator, hasFeature, readmePaths, data) => {
    switch (feature.key) {
        case 'jsonRpc': {
            // for now config is linked to JSON-RPC (but should be linked to frontend too)
            readmePaths.push('== Application Configuration');
            readmePaths.push('');
            injectConfiguration(files, { groupId, artifactId }, idGenerator, hasFeature, readmePaths, feature);

            readmePaths.push('== JSON-RPC server');
            readmePaths.push('');
            injectJsonRpc(files, groupId, artifactId, idGenerator, hasFeature, readmePaths, feature);
            break;
        }
        case 'kubernetesClient': {
            // it is handled in JSON-RPC/config generators
            break;
        }
        case 'frontend':
            readmePaths.push('== Frontend application');
            readmePaths.push('');
            injectFrontend(files, groupId, artifactId, idGenerator, hasFeature, true, readmePaths);
            break;
        case 'batch': {
            readmePaths.push('== Batch job');
            readmePaths.push('');
            injectBatch(files, groupId, artifactId, idGenerator, hasFeature, readmePaths);
            break;
        }
        // todo
        case 'jib':
            if (!hasFeature('bundlebee') && hasFeature('jsonRpc')) {
                readmePaths.push('== Health Probe');
                readmePaths.push('');
                injectHealthCheck(files, groupId, artifactId, idGenerator, readmePaths, data.features.jsonRpc);
            }
            readmePaths.push('== Jib/Docker images');
            readmePaths.push('');
            readmePaths.push('You can build the project docker image using: `mvn package jib:dockerBuild [-DskipTests]` (docker) or `mvn package jib:build [-DskipTests]` (remote registry if configured with related properties).');
            readmePaths.push('');
            // todo: detail more about image registry etc
            break;
        case 'bundlebee':
            if (hasFeature('jsonRpc')) {
                readmePaths.push('== Health Probe');
                readmePaths.push('');
                injectHealthCheck(files, groupId, artifactId, idGenerator, readmePaths, data.features.jsonRpc);
            }
            injectBundleBee(files, groupId, artifactId, idGenerator, hasFeature, true, readmePaths, isUsingFusion(data.features.jsonRpc));
            break;
        case 'documentation':
            readmePaths.push('== Documentation');
            readmePaths.push('');
            injectDocumentation(files, groupId, artifactId, idGenerator, hasFeature, readmePaths, data.features.jsonRpc);
            break;
        case 'github':
            readmePaths.push('== Github Workflow');
            readmePaths.push('');
            injectGithub(files, idGenerator, hasFeature, readmePaths, data);
            break;
        default:
            throw new Error(`Unknown feature: ${feature.key}.`);
    }
};
const injectMulti = (fileIndex, files, { artifactId }, feature, idGenerator, readmePaths) => {
    // TODO
    readmePaths.push('Multimodule generator not yet implemented');
};

export const filterEnabled = features => Object.keys(features)
    .map(key => ({ ...features[key], key }))
    .filter(it => it.enabled);
export const isSingleModule = activeFeatures => activeFeatures.length == 0 || activeFeatures
    .filter(it => it.supportSubModule && it.useParent)
    .length == 0;

// for now frontend feature depends on jsonRpc (~server) feature so we force it with skipGeneration hint
const fixFeatures = (all, userFeatures) =>
    userFeatures.filter(it => it.key == 'frontend').length == 1 &&
        userFeatures.filter(it => it.key == 'jsonRpc').length == 0 ?
        [...userFeatures, { ...all.jsonRpc, key: 'jsonRpc', skipGeneration: true }] : userFeatures;

export const generateFiles = data => {
    const enabledFeatures = fixFeatures(data.features, filterEnabled(data.features));
    const singleModule = isSingleModule(enabledFeatures);

    const files = [];
    let id = 0;

    files.push({
        id: id++,
        name: 'pom.xml',
        content: generatePom(data),
    });
    files.push({
        id: id++,
        name: '.gitignore',
        content: '.idea\n*.iml\n*.ipr\n*.iws\n.settings\n.classpath\n.vscode\n.code\n.node\ntarget\ngenerated\ngenerated_*\nnode_modules\n',
    });

    const idGenerator = () => {
        const v = id++;
        return v;
    };
    const hasFeature = name => enabledFeatures.filter(it => it.key == name).length > 0;
    const readmePaths = [];
    enabledFeatures.forEach(feature => {
        if (singleModule) {
            injectSingle(files, data.nav, feature, idGenerator, hasFeature, readmePaths, data);
        } else { // not yet implemented
            injectMulti(files, data.nav, feature, idGenerator, hasFeature);
        }
    });

    files.push({
        id: id++,
        name: 'README.adoc',
        content: `= ${data.nav.artifactId}\n:toc:\n\nGenerated project.\n\nIMPORTANT: ensure to use maven >= 3.8 and Java >= ${data.nav.javaVersion}.\n\n${readmePaths.join('\n')}`,
    });

    return files;
};
