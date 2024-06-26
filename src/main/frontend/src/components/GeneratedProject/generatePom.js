import { filterEnabled, isSingleModule } from "./generateFiles";
import { toPackage } from "./generationUtils";

const desindent = (lines, len) => lines.map(it => it.substring(len));

const testProperties = [
    '    <!-- Main Dependencies -->',
    '    <junit5.version>5.10.0</junit5.version>',
];
const yupiikBatchProperties = [
    '    <yupiik-batch.version>1.0.5</yupiik-batch.version>',
];
const yupiikConstantProperties = [
    '    <yupiik-logging.version>1.0.8</yupiik-logging.version>',
];
const frontendProperties = [
    '',
    '    <!-- Node/frontend related configuration -->',
    '    <node.environment>production</node.environment>',
    '    <node.version>v18.0.0</node.version>',
    '    <npm.version>8.6.0</npm.version>',
];
const simpleConfigurationDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.batch</groupId>',
    '        <artifactId>simple-configuration</artifactId>',
    '        <version>${yupiik-batch.version}</version>',
    '        <exclusions>',
    '          <exclusion>',
    '            <groupId>io.yupiik.logging</groupId>',
    '            <artifactId>yupiik-logging-jul</artifactId>',
    '          </exclusion>',
    '        </exclusions>',
    '      </dependency>',
];
const batchDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.batch</groupId>',
    '        <artifactId>yupiik-batch-runtime</artifactId>',
    '        <version>${yupiik-batch.version}</version>',
    '        <exclusions>',
    '          <exclusion>',
    '            <groupId>io.yupiik.logging</groupId>',
    '            <artifactId>yupiik-logging-jul</artifactId>',
    '          </exclusion>',
    '        </exclusions>',
    '      </dependency>',
];
const jsonRpcFusionProperties = [
    '    <yupiik-fusion.version>1.0.18</yupiik-fusion.version>',
];
const jsonRpcTransitiveProperties = [
    '    <owb.version>2.0.27</owb.version>',
    '    <johnzon.version>1.2.21</johnzon.version>',
    '    <tomcat.version>10.1.24</tomcat.version>',
    '    <xbean.version>4.25</xbean.version>',
];
const jsonrpcFusionDocumentationDependency = [
    '      <dependency> <!-- for the doc -->',
    '        <groupId>io.yupiik.fusion</groupId>',
    '        <artifactId>fusion-documentation</artifactId>',
    '        <version>${yupiik-fusion.version}</version>',
    '        <scope>provided</scope>',
    '      </dependency>',
];
const jsonrpcDocumentationDependency = [
    '      <dependency> <!-- for the doc -->',
    '        <groupId>io.yupiik.uship</groupId>',
    '        <artifactId>jsonrpc-documentation</artifactId>',
    '        <version>${yupiik-uship.version}</version>',
    '        <scope>provided</scope>',
    '      </dependency>',
];
const jsonRpcFusionDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.fusion</groupId>',
    '        <artifactId>fusion-build-api</artifactId>',
    '        <version>${yupiik-fusion.version}</version>',
    '        <scope>provided</scope>',
    '      </dependency>',
    '      <dependency>',
    '        <groupId>io.yupiik.fusion</groupId>',
    '        <artifactId>fusion-processor</artifactId>',
    '        <version>${yupiik-fusion.version}</version>',
    '        <scope>provided</scope>',
    '      </dependency>',
    '      <dependency>',
    '        <groupId>io.yupiik.fusion</groupId>',
    '        <artifactId>fusion-jsonrpc</artifactId>',
    '        <version>${yupiik-fusion.version}</version>',
    '      </dependency>',
];
const jsonRpcDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.uship</groupId>',
    '        <artifactId>jsonrpc-core</artifactId>',
    '        <version>${yupiik-uship.version}</version>',
    '      </dependency>',
    '      <dependency>',
    '        <groupId>org.apache.tomcat</groupId>',
    '        <artifactId>tomcat-catalina</artifactId>',
    '        <version>${tomcat.version}</version>',
    '      </dependency>',
    '      <dependency>',
    '        <groupId>org.apache.johnzon</groupId>',
    '        <artifactId>johnzon-core</artifactId>',
    '        <version>${johnzon.version}</version>',
    '        <exclusions>',
    '          <exclusion>',
    '            <groupId>*</groupId>',
    '            <artifactId>*</artifactId>',
    '          </exclusion>',
    '        </exclusions>',
    '      </dependency>',
    '      <dependency>',
    '        <groupId>org.apache.johnzon</groupId>',
    '        <artifactId>johnzon-mapper</artifactId>',
    '        <version>${johnzon.version}</version>',
    '        <exclusions>',
    '          <exclusion>',
    '            <groupId>*</groupId>',
    '            <artifactId>*</artifactId>',
    '          </exclusion>',
    '        </exclusions>',
    '      </dependency>',
    '      <dependency>',
    '        <groupId>org.apache.johnzon</groupId>',
    '        <artifactId>johnzon-jsonb</artifactId>',
    '        <version>${johnzon.version}</version>',
    '        <exclusions>',
    '          <exclusion>',
    '            <groupId>*</groupId>',
    '            <artifactId>*</artifactId>',
    '          </exclusion>',
    '        </exclusions>',
    '      </dependency>',
];
const fusionTestingDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.fusion</groupId>',
    '        <artifactId>fusion-testing</artifactId>',
    '        <version>${yupiik-fusion.version}</version>',
    '        <scope>test</scope>',
    '      </dependency>',
];
const openwebbeansTestingDependencies = [
    '      <dependency>',
    '        <groupId>org.apache.openwebbeans</groupId>',
    '        <artifactId>openwebbeans-junit5</artifactId>',
    '        <version>${owb.version}</version>',
    '        <classifier>jakarta</classifier>',
    '        <scope>test</scope>',
    '        <exclusions>',
    '          <exclusion>',
    '            <groupId>*</groupId>',
    '            <artifactId>*</artifactId>',
    '          </exclusion>',
    '        </exclusions>',
    '      </dependency>',
];
const fusionKubernetesClientDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.fusion</groupId>',
    '        <artifactId>fusion-kubernetes-client</artifactId>',
    '        <version>${yupiik-fusion.version}</version>',
    '      </dependency>',
];
const kubernetesClientDependencies = [
    '      <dependency>',
    '        <groupId>io.yupiik.uship</groupId>',
    '        <artifactId>kubernetes-client</artifactId>',
    '        <version>${yupiik-uship.version}</version>',
    '      </dependency>',
];
const documentationProperties = [
    '    <yupiik-tools.version>1.2.1</yupiik-tools.version>',
];
const bundlebeeProperties = [
    '    <yupiik-bundlebee.version>1.0.27</yupiik-bundlebee.version>',
];
const ushipProperties = [
    '    <yupiik-uship.version>1.0.19</yupiik-uship.version>',
];
const jibProperties = javaVersion => [
    '',
    '    <!-- Image related configuration -->',
    javaVersion === 21 ?
        '    <image.base>azul/zulu-openjdk-alpine:21.0.1@sha256:d45f86fffd7ccd63839d0518f7aa69dd8c8e1703e2c9b6a62dabb813300946cd</image.base>' :
        '    <image.base>ossyupiik/java:17.0.9.1@sha256:a07fca34db597cdf364af84e50a5aefec9b3fc5f88145073f6e0719c85506119</image.base>',
    '    <image.workdir>/opt/applications/${project.artifactId}</image.workdir>',
    '    <image.version>${project.version}</image.version>',
    '    <image.name>${project.artifactId}/${project.artifactId}:${image.version}</image.name>',
    '    <image.registry>${project.artifactId}</image.registry>',
    '    <jib.disableUpdateChecks>true</jib.disableUpdateChecks>',
];
const bundlebeeJibProperties = alveolus => [
    '    <bundlebee.kube.verbose>false</bundlebee.kube.verbose>',
    '    <bundlebee.namespace>default</bundlebee.namespace>',
    '    <bundlebee.environment>default</bundlebee.environment>',
    `    <bundlebee.alveolus>${alveolus}</bundlebee.alveolus>`,
];
const bundlebeeConfiguration = minisite => [
    ...(minisite ? [
        '        <executions>',
        '          <execution>',
        '            <id>doc</id>',
        '            <goals>',
        '              <goal>placeholder-extract</goal>',
        '            </goals>',
        '            <phase>compile</phase>',
        '            <configuration>',
        '              <outputType>FILE</outputType>',
        '              <failOnInvalidDescription>true</failOnInvalidDescription>',
        '              <dumpLocation>${project.basedir}/src/main/minisite/content/_partials/generated/deployment</dumpLocation>',
        '              <descriptions>${project.basedir}/src/main/bundlebee/placeholders.descriptions.properties</descriptions>',
        '            </configuration>',
        '          </execution>',
        '        </executions>'] : []),
    '        <configuration>',
    '          <manifest>${project.basedir}/src/main/bundlebee/manifest.json</manifest>',
    '          <alveolus>${bundlebee.alveolus}</alveolus>',
    '          <mavenRepositoriesDownloadsEnabled>true</mavenRepositoriesDownloadsEnabled>',
    '          <mavenRepositoriesSnapshot>https://oss.sonatype.org/content/repositories/snapshots/</mavenRepositoriesSnapshot>',
    '          <kubeVerbose>${bundlebee.kube.verbose}</kubeVerbose>',
    '          <kubeNamespace>${bundlebee.namespace}</kubeNamespace>',
    '          <skipPackaging>',
    '            <skipPackaging>none</skipPackaging>',
    '          </skipPackaging>',
    '          <customPlaceholders>',
    '            <app.deploytime>${maven.build.timestamp}</app.deploytime>',
    '            <!-- to extract the environment configuration in a file (supports maven placeholders)',
    '            <bundlebee-placeholder-import>${project.basedir}/environment/${bundlebee.environment}.properties</bundlebee-placeholder-import>',
    '            -->',
    '          </customPlaceholders>',
    '        </configuration>',
];
const loggingDependencies = [
    '    <dependency>',
    '      <groupId>io.yupiik.logging</groupId>',
    '      <artifactId>yupiik-logging-jul</artifactId>',
    '      <version>${yupiik-logging.version}</version>',
    '      <scope>runtime</scope>',
    '    </dependency>'
];
const junit5Dependencies = [
    '    <dependency>',
    '      <groupId>org.junit.jupiter</groupId>',
    '      <artifactId>junit-jupiter</artifactId>',
    '      <version>${junit5.version}</version>',
    '      <scope>test</scope>',
    '    </dependency>',
];
const githubDocProfileProfile = `
<profile> <!--  mvn clean package -Pgh-pages  -->
  <id>gh-pages</id>
  <properties>
    <minisite.serverId>github.com</minisite.serverId>
  </properties>
  <build>
  <plugins>
    <plugin>
      <groupId>io.yupiik.maven</groupId>
      <artifactId>yupiik-tools-maven-plugin</artifactId>
      <executions>
        <execution>
          <id>gh-pages</id>
          <phase>prepare-package</phase>
          <goals>
              <goal>minisite</goal>
          </goals>
          <configuration>
            <git>
              <ignore>false</ignore>
              <noJekyll>true</noJekyll>
              <serverId>\${minisite.serverId}</serverId>
              <branch>refs/heads/gh-pages</branch>
              <url>\${project.scm.url}</url>
            </git>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
  </build>
</profile>`.trim().split('\n');
const jibPiProfile = [
    '    <profile>',
    '      <!-- Represents a different docker registry environment (here a Raspberry PI) -->',
    '      <id>pi</id>',
    '      <properties>',
    '        <maven.build.timestamp.format>yyyyMMddHHmmss</maven.build.timestamp.format>',
    '        <jib.allowInsecureRegistries>true</jib.allowInsecureRegistries>',
    '        <pi.base>pi:32000/${project.artifactId}</pi.base>',
    '        <image.base>arm64v8/openjdk:17.0.1-slim-buster@sha256:9f4f3ad2b51467ec9dbb8b780cc82734b02f42a535ccf5f58492eec497f7cf4a</image.base>',
    '        <image.registry>${pi.base}/</image.registry>',
    '        <image.name>${image.registry}${project.artifactId}:${image.version}</image.name>',
    '      </properties>',
    '      <build>',
    '        <plugins>',
    '          <plugin>',
    '            <groupId>com.google.cloud.tools</groupId>',
    '            <artifactId>jib-maven-plugin</artifactId>',
    '            <configuration>',
    '              <from>',
    '                <image>${image.base}</image>',
    '                <platforms>',
    '                  <platform>',
    '                    <os>linux</os>',
    '                    <architecture>arm64</architecture>',
    '                  </platform>',
    '                </platforms>',
    '              </from>',
    '            </configuration>',
    '          </plugin>',
    '        </plugins>',
    '      </build>',
    '    </profile>',
];
const gitPlugin = [
    '      <!-- ENABLE WHEN PUSHED ON GIT',
    '      <plugin>',
    '        <groupId>io.github.git-commit-id</groupId>',
    '        <artifactId>git-commit-id-maven-plugin</artifactId>',
    '        <version>7.0.0</version>',
    '        <executions>',
    '          <execution>',
    '            <id>get-the-git-infos</id>',
    '            <phase>initialize</phase>',
    '            <goals>',
    '              <goal>revision</goal>',
    '            </goals>',
    '          </execution>',
    '        </executions>',
    '        <configuration>',
    '          <injectAllReactorProjects>true</injectAllReactorProjects>',
    '          <generateGitPropertiesFile>false</generateGitPropertiesFile>',
    '          <dateFormat>yyyy-MM-dd\'T\'HH:mm:ss\'Z\'</dateFormat>',
    '          <dateFormatTimeZone>GMT</dateFormatTimeZone>',
    '          <includeOnlyProperties>',
    '            <includeOnlyProperty>^git.branch$</includeOnlyProperty>',
    '            <includeOnlyProperty>^git.remote.origin.url$</includeOnlyProperty>',
    '            <includeOnlyProperty>^git.commit.id$</includeOnlyProperty>',
    '            <includeOnlyProperty>^git.commit.time$</includeOnlyProperty>',
    '          </includeOnlyProperties>',
    '        </configuration>',
    '      </plugin>',
    '      -->',
];
const resourcesPlugin = [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-resources-plugin</artifactId>',
    '        <version>3.3.1</version>',
    '        <configuration>',
    '          <encoding>UTF-8</encoding>',
    '        </configuration>',
    '      </plugin>',
];
const cleanPlugin = [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-clean-plugin</artifactId>',
    '        <version>3.3.2</version>',
    '      </plugin>',
];
const installPlugin = [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-install-plugin</artifactId>',
    '        <version>3.1.1</version>',
    '      </plugin>',
];
const compilerPlugin = data => [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-compiler-plugin</artifactId>',
    '        <version>3.11.0</version>',
    ...(data.nav.javaVersion === 21 ? [
        '        <executions>',
        '          <execution>',
        '            <id>default-process-annotations</id>',
        '            <goals>',
        '              <goal>compile</goal>',
        '            </goals>',
        '            <phase>generate-sources</phase>',
        '            <configuration>',
        '              <proc>only</proc>',
        '              <useIncrementalCompilation>true</useIncrementalCompilation>',
        '            </configuration>',
        '          </execution>',
        '          <execution>',
        '            <id>default-test-process-annotations</id>',
        '            <goals>',
        '              <goal>testCompile</goal>',
        '            </goals>',
        '            <phase>generate-test-sources</phase>',
        '            <configuration>',
        '              <proc>only</proc>',
        '              <useIncrementalCompilation>true</useIncrementalCompilation>',
        '            </configuration>',
        '          </execution>',
        '        </executions>',
    ] : []),
    '        <configuration>',
    `          <source>${data.nav.javaVersion}</source>`,
    `          <target>${data.nav.javaVersion}</target>`,
    `          <release>${data.nav.javaVersion}</release>`,
    '          <encoding>UTF-8</encoding>',
    ...(data.nav.javaVersion === 21 ? [
        '          <proc>none</proc>',
        '          <useIncrementalCompilation>false</useIncrementalCompilation>',
        '          <annotationProcessors>',
        '            <annotationProcessor>io.yupiik.fusion.framework.processor.FusionProcessor</annotationProcessor>',
        '          </annotationProcessors>',
    ] : []),
    `          <compilerArgs>`,
    `            <compilerArg>-parameters</compilerArg>`,
    `          </compilerArgs>`,
    '        </configuration>',
    '      </plugin>'
];
const ossIndexPlugin = [
    '      <plugin> <!--  mvn ossindex:audit -->',
    '        <groupId>org.sonatype.ossindex.maven</groupId>',
    '        <artifactId>ossindex-maven-plugin</artifactId>',
    '        <version>3.1.0</version>',
    '        <configuration>',
    '          <scope>compile,runtime</scope>',
    '        </configuration>',
    '      </plugin>',
];
const jibPlugin = (singleModule, frontend, jsonRpc, batchClass, useFusion) => [
    '      <plugin>',
    '        <groupId>com.google.cloud.tools</groupId>',
    '        <artifactId>jib-maven-plugin</artifactId>',
    '        <version>3.4.0</version>',
    '        <!--',
    '        mvn package jib:build [-Dimage.registry=...] -> will be pushed',
    '        mvn package jib:dockerBuild -> local docker image',
    '        -->',
    '        <configuration>',
    '          <containerizingMode>packaged</containerizingMode>',
    '          <from>',
    '            <image>${image.base}</image>',
    '          </from>',
    '          <to>',
    '            <image>${image.name}</image>',
    '          </to>',
    ...(singleModule && frontend ? [
        '          <extraDirectories>',
        '            <paths combine.children="append">',
        '              <path>',
        '                <from>${project.build.outputDirectory}/META-INF/resources</from>',
        '                <into>${image.workdir}/docs</into>',
        '              </path>',
        '            </paths>',
        '          </extraDirectories>',
    ] : []),
    '          <container>',
    `            <mainClass>${jsonRpc ? (useFusion ? 'io.yupiik.fusion.framework.api.main.Launcher' : 'org.apache.openwebbeans.se.CDILauncher') : (batchClass || 'OVERRIDEN_IN_CHILD')}</mainClass>`,
    ...(!useFusion && (jsonRpc || frontend) ? [
        '            <args>',
        '              <arg>--openwebbeans.main</arg>',
        '              <arg>uShipTomcatAwait</arg>',
        '            </args>',
    ] : []),
    '            <appRoot>${image.workdir}</appRoot>',
    '            <workingDirectory>${image.workdir}</workingDirectory>',
    '            <extraClasspath>${image.workdir}/custom/*:${image.workdir}/custom</extraClasspath>',
    '            <creationTime>USE_CURRENT_TIMESTAMP</creationTime>',
    '            <jvmFlags>',
    '              <jvmFlag>-Djava.util.logging.manager=io.yupiik.logging.jul.YupiikLogManager</jvmFlag>',
    '              <jvmFlag>-Dio.yupiik.logging.jul.handler.AsyncHandler.formatter=json</jvmFlag>',
    '              <jvmFlag>-Djava.security.egd=file:/dev/./urandom</jvmFlag>',
    '              <jvmFlag>-Djdk.serialFilter=!*</jvmFlag>',
    '              <jvmFlag>-Djdk.jndi.object.factoriesFilter=!*</jvmFlag>',
    '              <jvmFlag>-Dcom.sun.jndi.ldap.object.trustSerialData=false</jvmFlag>',
    '            </jvmFlags>',
    '            <labels>',
    '              <!-- ENABLE WHEN PUSHED ON GIT if you want these info in the attributes',
    '              <org.opencontainers.image.revision>${git.commit.id}</org.opencontainers.image.revision>',
    '              <org.opencontainers.image.ref.name>${git.branch}</org.opencontainers.image.ref.name>',
    '              <org.opencontainers.image.source>${git.remote.origin.url}</org.opencontainers.image.source>',
    '              <org.opencontainers.image.url>${project.scm.url}</org.opencontainers.image.url>',
    '              <org.opencontainers.image.documentation>\${project.parent.parent.scm.url}</org.opencontainers.image.documentation>',
    '              -->',
    '              <org.opencontainers.image.created>${maven.build.timestamp}</org.opencontainers.image.created>',
    '              <org.opencontainers.image.authors>${project.artifactId}</org.opencontainers.image.authors>',
    '              <org.opencontainers.image.vendor>${project.artifactId}</org.opencontainers.image.vendor>',
    '              <org.opencontainers.image.title>${project.artifactId}</org.opencontainers.image.title>',
    '              <org.opencontainers.image.description>${project.description}</org.opencontainers.image.description>',
    '              <org.opencontainers.image.version>${project.version}</org.opencontainers.image.version>',
    '              <com.application.params>_JAVA_OPTIONS=...</com.application.params>',
    '              <com.application.cmd>docker run ${image.name} &lt;args&gt;</com.application.cmd>',
    '            </labels>',
    '          </container>',
    '          <outputPaths>',
    '            <imageJson>${project.build.directory}/jib-image.json</imageJson>',
    '          </outputPaths>',
    '        </configuration>',
    '      </plugin>',
];
const minisiteConfiguration = (pck, useFusion, jsonRpc, batch, useBundlebee) => [
    '        <configuration>',
    '          <siteBase>https://${project.groupId}.github.io/${project.artifactId}</siteBase>',
    '          <logoText>${project.artifactId}</logoText>',
    '          <indexText>${project.artifactId}</indexText>',
    '          <copyright>${project.artifactId}</copyright>',
    '          <linkedInCompany>${project.artifactId}</linkedInCompany>',
    '          <indexSubTitle>${project.description}</indexSubTitle>',
    '          <injectYupiikTemplateExtensionPoints>false</injectYupiikTemplateExtensionPoints>',
    '          <preferYupiikAsciidoc>true</preferYupiikAsciidoc>',
    '          <preActions>',
    ...(!useFusion || batch ? [
        '            <preAction>',
        `              <type>${pck}.build.ConfigurationGenerator</type>`,
        '            </preAction>',
    ] : []),
    ...(useFusion ? [
        '            <preAction>',
        '              <type>io.yupiik.fusion.documentation.DocumentationGenerator</type>',
        '              <configuration>',
        '                <includeEnvironmentNames>true</includeEnvironmentNames>',
        '                <module>${project.artifactId}</module>',
        '                <urls>file://${project.build.outputDirectory}/META-INF/fusion/configuration/documentation.json</urls>',
        '              </configuration>',
        '            </preAction>',
        ...(jsonRpc ? [
            '            <preAction>',
            '              <type>io.yupiik.fusion.documentation.OpenRpcGenerator</type>',
            '              <configuration>',
            '                <output>${project.basedir}/src/main/minisite/content/_partials/generated/${artifactId}.openrpc.json</output>',
            '                <title>${artifactId} API</title>',
            '              </configuration>',
            '            </preAction>',
            '            <preAction>',
            '              <type>io.yupiik.fusion.documentation.OpenRPC2Adoc</type>',
            '              <configuration>',
            '                <input>${project.build.outputDirectory}/META-INF/fusion/jsonrpc/openrpc.json</input>',
            '                <output>${project.basedir}/src/main/minisite/content/_partials/generated/${artifactId}.openrpc.adoc</output>',
            '              </configuration>',
            '            </preAction>',
        ] : []),
    ] : []),
    ...(useBundlebee ? [
        '            <preAction>',
        '              <type>copy</type>',
        '              <configuration>',
        '                <from>${project.basedir}/src/main/minisite/content/_partials/generated/deployment/placeholders.completion.properties</from>',
        '                <to>${project.build.directory}/${project.build.finalName}/completion/placeholders.completion.properties</to>',
        '              </configuration>',
        '            </preAction>',
    ] : []),
    '          </preActions>',
    '          <customScripts>',
    '          <![CDATA[[',
    '          <script>',
    '          $(document).ready(function(){',
    '            function filterTables() {',
    '              $(\'input[table-filter]\').on(\'keyup\', function () {',
    '                var input = $(this);',
    '                var value = input.val().toLowerCase();',
    '                $(\'table.\' + input.attr(\'table-filter\') + \' tr\').filter(function () {',
    '                  $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);',
    '                });',
    '              });',
    '            }',
    '',
    '            filterTables();',
    '          });',
    '          </script>',
    '          ]]>',
    '          </customScripts>',
    '          <attributes>',
    '            <partialsdir>${project.basedir}/src/main/minisite/content/_partials</partialsdir>',
    '            <!-- ENABLE WHEN PUSHED ON GIT if you want these info in the attributes',
    '            <gitCommitId>${git.commit.id}</gitCommitId>',
    '            <gitBranch>${git.branch}</gitBranch>',
    '            <gitTime>${git.commit.time}</gitTime>',
    '            -->',
    '          </attributes>',
    '        </configuration>',
    '        <dependencies>',
    '          <dependency>',
    '            <groupId>io.yupiik.maven</groupId>',
    '            <artifactId>asciidoc-java</artifactId>',
    '            <version>${yupiik-tools.version}</version>',
    '          </dependency>',
    '        </dependencies>',
];
const frontendConfiguration = singleModule => ([
    '        <executions>',
    '          <execution>',
    '            <id>install-node-npm</id>',
    '            <phase>generate-resources</phase>',
    '            <goals>',
    '              <goal>install-node-and-npm</goal>',
    '            </goals>',
    '            <configuration>',
    `              <installDirectory>\${project.basedir}/${singleModule ? 'src/main/frontend/' : ''}.node</installDirectory>`,
    '              <nodeVersion>${node.version}</nodeVersion>',
    '              <npmVersion>${npm.version}</npmVersion>',
    '            </configuration>',
    '          </execution>',
    '          <execution>',
    '            <id>npm-install</id>',
    '            <phase>process-classes</phase>',
    '            <goals>',
    '              <goal>npm</goal>',
    '            </goals>',
    '          </execution>',
    '          <execution>',
    '            <id>npm-build</id>',
    '            <phase>process-classes</phase>',
    '            <goals>',
    '              <goal>npm</goal>',
    '            </goals>',
    '            <configuration>',
    '              <arguments>run build</arguments>',
    '              <environmentVariables>',
    '                <PROJECT_VERSION>${project.version}</PROJECT_VERSION>',
    '                <BUILD_DATE>${maven.build.timestamp}</BUILD_DATE>',
    '                <NODE_ENV>${node.environment}</NODE_ENV>',
    '              </environmentVariables>',
    '            </configuration>',
    '          </execution>',
    '        </executions>',
    '        <configuration>',
    `          <installDirectory>\${project.basedir}/${singleModule ? 'src/main/frontend/' : ''}.node</installDirectory>`,
    `          <workingDirectory>\${project.basedir}${singleModule ? '/src/main/frontend/' : ''}</workingDirectory>`,
    '        </configuration>',
]);
const jarPlugin = [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-jar-plugin</artifactId>',
    '        <version>3.3.0</version>',
    '        <configuration>',
    '          <excludes>',
    '            <exclude>**/.keepit</exclude>',
    '            <exclude>**/build/**</exclude>',
    '          </excludes>',
    '          <archive combine.children="append">',
    '            <manifestEntries>',
    '              <App-Build-Timestamp>${maven.build.timestamp}</App-Build-Timestamp>',
    '            </manifestEntries>',
    '          </archive>',
    '        </configuration>',
    '      </plugin>'
];
const releasePlugin = [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-release-plugin</artifactId>',
    '        <version>3.0.0-M1</version>',
    '        <configuration>',
    '          <releaseProfiles>release</releaseProfiles>',
    '          <autoVersionSubmodules>true</autoVersionSubmodules>',
    '        </configuration>',
    '      </plugin>'
];
const surefirePlugin = [
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-surefire-plugin</artifactId>',
    '        <version>3.2.3</version>',
    '        <configuration>',
    '          <trimStackTrace>false</trimStackTrace>',
    '          <statelessTestsetInfoReporter implementation="org.apache.maven.plugin.surefire.extensions.junit5.JUnit5StatelessTestsetInfoTreeReporter"/>',
    '          <systemPropertyVariables>',
    '            <java.net.preferIPv4Stack>true</java.net.preferIPv4Stack>',
    '            <java.util.logging.manager>io.yupiik.logging.jul.YupiikLogManager</java.util.logging.manager>',
    '          </systemPropertyVariables>',
    '        </configuration>',
    '        <dependencies>',
    '          <dependency>',
    '            <groupId>me.fabriciorby</groupId>',
    '            <artifactId>maven-surefire-junit5-tree-reporter</artifactId>',
    '            <version>0.1.0</version>',
    '          </dependency>',
    '        </dependencies>',
    '      </plugin>'
];

const scm = data => [
    '  <!-- ENABLE WHEN PUSHED ON GIT',
    '  <scm>',
    '    <tag>HEAD</tag>',
    `    <url>https://github.com/${data.nav.artifactId}/${data.nav.artifactId}.git</url>`,
    `    <developerConnection>scm:git:git@github.com:${data.nav.artifactId}/${data.nav.artifactId}.git</developerConnection>`,
    `    <connection>scm:git:git@github.com:${data.nav.artifactId}/${data.nav.artifactId}.git</connection>`,
    '  </scm>',
    '  -->',
];

export const generatePom = data => {
    const enabledFeatures = filterEnabled(data.features);
    const singleModule = isSingleModule(enabledFeatures);
    const frontend = enabledFeatures.filter(it => it.key == 'frontend').length == 1;
    const needsProfiles = data.features.jib.enabled || (data.features.github.enabled && data.features.documentation.enabled);
    const useFusion = (data.features.jsonRpc.switchValues.filter(it => it.enabled).map(it => it.name)[0] || 'useFusion') === 'useFusion';

    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<project xmlns="http://maven.apache.org/POM/4.0.0"',
        '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">',
        '',
        '  <modelVersion>4.0.0</modelVersion>',
        '',
        `  <groupId>${data.nav.groupId}</groupId>`,
        `  <artifactId>${data.nav.artifactId}${singleModule ? '' : '-parent'}</artifactId>`,
        `  <version>${data.nav.version}</version>`,
        ...(singleModule ? [] : ['  <packaging>pom</packaging>']),
        `  <name>${data.nav.artifactId}</name>`,
        `  <description>${data.nav.artifactId}</description>`,
        '',
        '  <properties>',
        ...testProperties,
        ...(!data.features.jsonRpc.enabled ? [] : (useFusion ? jsonRpcFusionProperties : jsonRpcTransitiveProperties)),
        ...(useFusion || (!data.features.jsonRpc.enabled && !data.features.kubernetesClient.enabled) ? [] : (useFusion ? jsonRpcFusionProperties : ushipProperties)),
        ...(!data.features.documentation.enabled ? [] : documentationProperties),
        ...(!data.features.bundlebee.enabled ? [] : bundlebeeProperties),
        ...(!useFusion || data.features.batch.enabled ? yupiikBatchProperties : []),
        ...yupiikConstantProperties,
        ...(!data.features.frontend.enabled ? [] : frontendProperties),
        ...(!data.features.jib.enabled ? [] : jibProperties(data.nav.javaVersion)),
        ...(!data.features.jib.enabled || !data.features.bundlebee.enabled ? [] : bundlebeeJibProperties(data.nav.artifactId)),
        '  </properties>',
        '',
        ...(singleModule ? [] : [
            '  <modules>',
            ...(!data.features.batch.enabled ? [] : [
                `    <module>${data.nav.artifactId}-batch${data.features.batch.useParent ? '-parent' : ''}</module>`,
            ]),
            ...(!data.features.jsonRpc.enabled ? [] : [
                `    <module>${data.nav.artifactId}-jsonrpc${data.features.jsonRpc.useParent ? '-parent' : ''}</module>`,
            ]),
            ...(!data.features.frontend.enabled ? [] : [
                `    <module>${data.nav.artifactId}-frontend${data.features.frontend.useParent ? '-parent' : ''}</module>`,
            ]),
            ...(!data.features.bundlebee.enabled ? [] : [
                `    <module>${data.nav.artifactId}-bundlebee</module>`,
            ]),
            ...(!data.features.documentation.enabled ? [] : [
                `    <module>${data.nav.artifactId}-documentation</module>`,
            ]),
            '  </modules>',
            '',
        ]),
        ...(needsProfiles ? ['  <profiles>'] : []),
        ...(!data.features.documentation.enabled || !data.features.github.enabled ? [] : githubDocProfileProfile),
        ...(!data.features.jib.enabled ? [] : jibPiProfile),
        ...(needsProfiles ? ['  </profiles>'] : []),
        ...(singleModule ? [] : [
            '  <dependencyManagement>',
            '    <dependencies>',
            // no dependency for data.features.documentation and data.features.jib themselves
            ...(data.features.jsonRpc.enabled && data.features.documentation.enabled ? (useFusion ? jsonrpcFusionDocumentationDependency : jsonrpcDocumentationDependency) : []),
            ...(!data.features.jsonRpc.enabled ? [] : (useFusion ? jsonRpcFusionDependencies : jsonRpcDependencies)),
            ...(useFusion ? [] : simpleConfigurationDependencies),
            ...(!data.features.batch.enabled ? [] : batchDependencies),
            ...(!data.features.kubernetesClient.enabled ? [] : (useFusion ? fusionKubernetesClientDependencies : kubernetesClientDependencies)),
            '',
            '    <!-- Test dependencies -->',
            ...(!data.features.jsonRpc.enabled ? [] : (useFusion ? fusionTestingDependencies : openwebbeansTestingDependencies)),
            '    </dependencies>',
            '  </dependencyManagement>',
            '',
        ]),
        '  <dependencies>',
        ...loggingDependencies,
        ...(!singleModule ? [] : [ // todo: this does not support fusion yet but since we didn't enable multi module support yet 
            ...(data.features.jsonRpc.enabled && data.features.documentation.enabled ? desindent(useFusion ? jsonrpcFusionDocumentationDependency : jsonrpcDocumentationDependency, 2) : []),
            ...(!data.features.jsonRpc.enabled ? [] : desindent(useFusion ? jsonRpcFusionDependencies : jsonRpcDependencies, 2)),
            ...(useFusion && !data.features.batch.enabled ? [] : desindent(simpleConfigurationDependencies, 2)),
            ...(!data.features.batch.enabled ? [] : desindent(batchDependencies, 2)),
            ...(!data.features.kubernetesClient.enabled ? [] : desindent(useFusion ? fusionKubernetesClientDependencies : kubernetesClientDependencies, 2)),
        ]),
        '',
        '    <!-- Test dependencies -->',
        ...junit5Dependencies,
        ...(!singleModule ? [] : [
            ...(!data.features.jsonRpc.enabled ? [] : desindent(useFusion ? fusionTestingDependencies : openwebbeansTestingDependencies, 2)),
        ]),
        '  </dependencies>',
        '',
        ...scm(data),
        '',
        '  <build>',
        '    <plugins>',
        ...gitPlugin,
        ...(!data.features.documentation.enabled ? [] : [
            '      <plugin> <!-- mvn [compile] yupiik-tools:serve-minisite -e [-Dyupiik.minisite.openBrowser=false] -->',
            '        <groupId>io.yupiik.maven</groupId>',
            '        <artifactId>yupiik-tools-maven-plugin</artifactId>',
            '        <version>${yupiik-tools.version}</version>',
            ...(!singleModule ? [] : minisiteConfiguration(
                toPackage(data.nav.groupId, data.nav.artifactId),
                useFusion, data.features.jsonRpc.enabled, data.features.batch.enabled, data.features.bundlebee.enabled)),
            '      </plugin>',
        ]),
        ...(!data.features.bundlebee.enabled ? [] : [
            '      <plugin> <!-- mvn bundlebee:apply [-D....] -->',
            '        <groupId>io.yupiik</groupId>',
            '        <artifactId>bundlebee-maven-plugin</artifactId>',
            '        <version>${yupiik-bundlebee.version}</version>',
            ...(!singleModule ? [] : bundlebeeConfiguration(data.features.documentation.enabled)),
            '      </plugin>',
        ]),
        ...(!data.features.frontend.enabled ? [] : [
            '      <plugin>',
            '        <groupId>com.github.eirslett</groupId>',
            '        <artifactId>frontend-maven-plugin</artifactId>',
            '        <version>1.15.0</version>',
            ...(!singleModule ? [] : frontendConfiguration(singleModule)),
            '      </plugin>',
        ]),
        ...(!data.features.jib.enabled ? [] : jibPlugin(
            singleModule, frontend,
            data.features.jsonRpc.enabled,
            data.features.batch.enabled && !data.features.jsonRpc.enabled ?
                `${toPackage(data.nav.groupId, data.nav.artifactId)}.batch.SimpleBatch` :
                undefined, useFusion)),
        ...cleanPlugin,
        ...resourcesPlugin,
        ...compilerPlugin(data),
        ...surefirePlugin,
        ...jarPlugin,
        ...installPlugin,
        ...releasePlugin,
        ...ossIndexPlugin,
        '    </plugins>',
        '  </build>',
        '</project>',
        ''
    ];
    return lines.join('\n');
};
