package io.yupiik.site.generator;

import io.yupiik.bundlebee.core.lang.Tuple2;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.ThrowingConsumer;
import org.junit.jupiter.api.io.TempDir;

import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonObject;
import javax.json.JsonString;
import javax.json.JsonValue;
import java.io.File;
import java.io.IOException;
import java.io.StringReader;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.MalformedInputException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static java.net.http.HttpResponse.BodyHandlers.discarding;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Locale.ROOT;
import static java.util.Map.entry;
import static java.util.concurrent.TimeUnit.MINUTES;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;
import static java.util.stream.Collectors.toMap;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// to run from an IDE you can need to set these system properties (adjust values accordingly):
// -Dmaven.home=$HOME/.sdkman/candidates/maven/current/ -Djava17.home=$HOME/.sdkman/candidates/java/17.0.0-zulu/
class GeneratorTest {
    @Test
    void validateGeneratedProject(@TempDir final Path temp) throws Throwable {
        // setup the environment
        final var java17Home = System.getProperty("java17.home");
        assumeTrue(java17Home != null && !java17Home.isBlank(), "No java.17.home set");

        final var basedir = Path.of(".").toAbsolutePath().normalize();
        final var windows = System.getProperty("os.name").toLowerCase(ROOT).contains("win");
        final var node = basedir.resolve(".node/node/node" + (windows ? ".cmd" : ""));
        assertTrue(Files.exists(node), "Node should be there when tests are executed");

        // generate a project with all options
        final var filesAsJson = generateFullProject(windows, basedir, node, temp);
        final var files = toFiles("", filesAsJson);
        final var mvnProject = temp.resolve("application");
        dumpProject(files, mvnProject);

        // ensure it builds (jsonrpc+frontend+batch+tests)
        assertBuild(mvnProject, temp, windows, java17Home);

        // check bundlebee descriptors are at least there and well-formed
        assertBundleBeeDryRun(mvnProject, temp, java17Home, windows);

        // docker image
        assertDocker(mvnProject, temp, java17Home, windows);
    }

    private void assertDocker(final Path project, final Path temp, final String java17Home, final boolean win) throws Throwable {
        exec(
                temp.resolve("jib_outputs"), win, project, java17Home,
                "mvn", "jib:dockerBuild");
        final var image = "application/application:1.0.0-SNAPSHOT";
        try {
            final var httpClient = HttpClient.newHttpClient();

            // run frontend and ensures it responds accordingly the index.html and js/app.js + checks the healthcheck
            final var frontendContainer = findContainer(project, "frontend");
            final int frontendPort = nextPort();
            final var frontendUri = URI.create("http://localhost:" + frontendPort);
            runDockerAndAssert( // todo: once we add an extension to veto JsonRpcServletRegistration conditionally (beans.xml with system prop) we can test jsonrpc is not deployed
                    temp, "docker-frontend", win, project, java17Home,
                    stdout -> {
                        // ensure it is started before hitting it
                        ensureStarted(stdout);
                        assertHealthCheck(httpClient, frontendUri);

                        // hit index.html and app.js
                        final var index = httpClient.send(
                                HttpRequest.newBuilder()
                                        .GET()
                                        .uri(frontendUri.resolve("/index.html"))
                                        .build(),
                                HttpResponse.BodyHandlers.ofString(UTF_8));
                        assertEquals(200, index.statusCode());
                        assertTrue(index.body().contains("<div id=\"app\">"), index::body);
                        assertTrue(index.body().contains("<script type=\"application/javascript\" src=\"/js/app.js?v="), index::body);

                        final var appJs = httpClient.send(
                                HttpRequest.newBuilder()
                                        .GET()
                                        .uri(frontendUri.resolve("/js/app.js"))
                                        .build(),
                                HttpResponse.BodyHandlers.ofString(UTF_8));
                        assertEquals(200, appJs.statusCode());
                        assertTrue(appJs.body().contains("\"h1\",null,\"Hello application\""), appJs::body);
                    },
                    frontendContainer, frontendPort, image);

            // run the json-rpc server and ensures it responds the greet method + checks the healthcheck
            final var jsonRpcContainer = findContainer(project, "jsonrpc-server");
            final int jsonRpcPort = nextPort();
            final var jsonRpcUri = URI.create("http://localhost:" + jsonRpcPort + "/jsonrpc");
            runDockerAndAssert(
                    temp, "docker-batch", win, project, java17Home,
                    stdout -> {
                        // ensure it is started before hitting it
                        ensureStarted(stdout);
                        assertHealthCheck(httpClient, jsonRpcUri);

                        // hit index.html and app.js
                        final var index = httpClient.send(
                                HttpRequest.newBuilder()
                                        .POST(HttpRequest.BodyPublishers.ofString("{\"jsonrpc\":\"2.0\",\"method\":\"greet\",\"params\":{\"name\":\"test\"}}", UTF_8))
                                        .uri(jsonRpcUri)
                                        .build(),
                                HttpResponse.BodyHandlers.ofString(UTF_8));
                        assertEquals(200, index.statusCode());
                        assertEquals("{\"jsonrpc\":\"2.0\",\"result\":{\"message\":\"Hi test\"}}", index.body());
                    },
                    jsonRpcContainer, jsonRpcPort, image);

            // run the batch and ensures it runs properly
            final var batchContainer = findContainer(project, "batch", "cronjob", this::firstContainerFromCronJob);
            runDockerAndAssert(
                    temp, "docker-batch", win, project, java17Home,
                    stdout -> {
                        final var content = Files.readString(stdout);
                        assertTrue(content.contains("Starting batch SimpleBatch"));
                        assertTrue(content.contains("Batch SimpleBatch ended in "));
                    },
                    batchContainer, -1, image,
                    "--simplebatch-tracing-datasource-url", "skipped",
                    "--simplebatch-tracing-datasource-driver", "skipped");

        } finally {
            exec(
                    temp.resolve("docker-delete_outputs"), win, project, java17Home,
                    "docker", "image", "rm", "--force", image);
        }
    }

    private int nextPort() throws IOException {
        try (final var socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private void assertHealthCheck(final HttpClient httpClient, final URI uri) throws IOException, InterruptedException {
        assertEquals(200, httpClient.send(
                        HttpRequest.newBuilder()
                                .GET()
                                .uri(uri.resolve("/health"))
                                .header("Health-Key", "changeit")
                                .build(),
                        discarding())
                .statusCode());
    }

    private void ensureStarted(final Path stdout) throws IOException {
        final var stdoutContent = Files.readString(stdout);
        assertTrue(stdoutContent.contains("OpenWebBeans Container has started"), "OWB container not yet started");
        assertTrue(stdoutContent.contains("Starting ProtocolHandler"), "tomcat not yet started");
    }

    private JsonObject findContainer(final Path project, final String type, final String file, final Function<JsonObject, JsonObject> finder) throws IOException {
        final var path = project.resolve("src/main/bundlebee/kubernetes/org.example/application/" + type + "/" + file + ".json");
        assertTrue(Files.exists(path), path::toString);
        try (final var reader = Json.createReader(new StringReader(Files.readString(path, UTF_8)
                // ensure it is a readable json
                .replaceAll(": \\{\\{.+:-(?<value>[^}]+)}}", ": ${value}")))) {
            final var json = reader.readObject();
            return finder.apply(json);
        }
    }

    private JsonObject findContainer(final Path project, final String type) throws IOException {
        return findContainer(project, type, "deployment", this::firstContainerFromDeployment);
    }

    private JsonObject firstContainerFromCronJob(final JsonObject json) {
        return json.getJsonObject("spec").getJsonObject("jobTemplate")
                .getJsonObject("spec").getJsonObject("template")
                .getJsonObject("spec").getJsonArray("containers")
                .getJsonObject(0);
    }

    private JsonObject firstContainerFromDeployment(final JsonObject json) {
        return json.getJsonObject("spec").getJsonObject("template")
                .getJsonObject("spec").getJsonArray("containers")
                .getJsonObject(0);
    }

    private void runDockerAndAssert(final Path temp, final String marker, final boolean win, final Path project, final String java17Home,
                                    final ThrowingConsumer<Path> asserts, final JsonObject container, final int port, final String image,
                                    final String... optionalArgs) throws Throwable {
        final var entrypoint = container.getJsonArray("command").stream()
                .map(JsonString.class::cast)
                .map(JsonString::getString)
                .collect(toList());
        final var hasArgs = container.containsKey("args");
        final var args = hasArgs ?
                container.getJsonArray("args").stream()
                        .map(JsonString.class::cast)
                        .map(JsonString::getString) :
                Stream.<String>empty();
        final var id = marker + "-" + UUID.randomUUID().toString().replace("-", "");
        final var cmd = Stream.of(
                        Stream.of(
                                "docker", "run",
                                "--name", id,
                                "--entrypoint", entrypoint.get(0)),
                        port <= 0 ?
                                Stream.<String>empty() :
                                Stream.of("--publish", port + ":8080"),
                        Stream.of(image),
                        entrypoint.stream().skip(1),
                        !hasArgs ? Stream.<String>empty() : args,
                        Stream.of(optionalArgs))
                .flatMap(identity())
                .toArray(String[]::new);
        final var exec = execStart(temp.resolve("docker-" + marker + "_outputs"), win, project, java17Home, Map.of(), cmd);
        final int maxRetries = Integer.getInteger("test.generator.docker.retries", 60);
        try {
            for (int i = 0; i < maxRetries; i++) {
                // theorically we could use the container liveness check to do the assertion but we can bypass it for now
                try {
                    asserts.accept(exec.getSecond().getFirst());
                    break;
                } catch (final Throwable re) {
                    if (maxRetries - 1 == i) {
                        fail((Files.readString(exec.getSecond().getFirst(), UTF_8) + "\n" + Files.readString(exec.getSecond().getSecond(), UTF_8)).strip(), re);
                    }
                    Thread.sleep(1_000);
                }
            }
        } finally {
            final var process = exec.getFirst();
            if (process.isAlive()) { // can be dead if startup failed
                process.destroyForcibly().waitFor();
            }

            // we don't care if it fails and previous container was already dropped, we just don't want to leak anything
            execStart(temp.resolve("docker-" + marker + "-rm_outputs"), win, project, java17Home, Map.of(), "docker", "kill", id).getFirst().waitFor();
            execStart(temp.resolve("docker-" + marker + "-kill_outputs"), win, project, java17Home, Map.of(), "docker", "rm", id).getFirst().waitFor();
        }
    }

    private void assertBundleBeeDryRun(final Path project, final Path temp, final String java17Home, final boolean win) throws IOException, InterruptedException {
        final var stdout = Files.readAllLines(exec(
                temp.resolve("mvn_bundlebee_outputs"), win, project, java17Home,
                "mvn", "bundlebee:apply", "-Dbundlebee.kube.dryRun=true", "-Dkubeconfig=explicit"), UTF_8);

        // smoke test, check some requests were simulated in dry-run mode and build succeeded (so descriptors were properly read at least)
        final var requests = stdout.stream().filter("[INFO] Request succeeded:"::equals).count();
        final Supplier<String> debug = () -> String.join("\n", stdout);
        assertEquals(19, requests, debug);
        assertTrue(stdout.contains("X-Dry-Run: true"), debug);
        assertTrue(stdout.contains("[INFO] BUILD SUCCESS"), debug);
    }

    private void assertBuildResult(final Path project) throws IOException {
        final var target = project.resolve("target");
        final var targetFiles = collectTargetFiles(target);
        assertEquals(35, targetFiles.size());
        // tests passed (so jsonrpc and batch were ok)
        assertSurefireReport("org.example.application.batch.SimpleBatchTest", targetFiles.get("surefire-reports/org.example.application.batch.SimpleBatchTest.txt"));
        assertSurefireReport("org.example.application.jsonrpc.GreetingEndpointTest", targetFiles.get("surefire-reports/org.example.application.jsonrpc.GreetingEndpointTest.txt"));
        // minisite was generated (smoke test)
        assertTrue(targetFiles.get("application-1.0.0-SNAPSHOT/getting-started.html")
                .contains("<h1>Getting Started</h1>"), () -> targetFiles.get("application-1.0.0-SNAPSHOT/getting-started.html"));
        assertTrue(targetFiles.get("application-1.0.0-SNAPSHOT/batch.html")
                .contains("<p><code>--skipTracing</code></p>"), () -> targetFiles.get("application-1.0.0-SNAPSHOT/batch.html"));
        // frontend was bundled (smoke test)
        assertTrue(targetFiles.get("classes/META-INF/resources/js/app.js")
                .contains("\"h1\",null,\"Hello application\""), () -> targetFiles.get("classes/META-INF/resources/js/app.js"));
    }

    private void assertSurefireReport(final String testClass, final String txt) {
        assertTrue(txt.contains("Test set: " + testClass), txt);
        assertTrue(txt.contains("Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, "), txt); // == success
    }

    private Map<String, String> collectTargetFiles(final Path target) throws IOException {
        final var out = new HashMap<String, String>();
        Files.walkFileTree(target, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(final Path dir, final BasicFileAttributes attrs) throws IOException {
                final var name = dir.getFileName().toString();
                if ("maven-status".equals(name) || name.startsWith("generated-") || name.startsWith("maven-")) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return super.preVisitDirectory(dir, attrs);
            }

            @Override
            public FileVisitResult visitFile(final Path file, final BasicFileAttributes attrs) throws IOException {
                final var name = target.relativize(file).toString().replace(File.separatorChar, '/');
                if (name.endsWith(".class") || name.endsWith(".jar")) { // binary, skip content
                    out.put(name, "");
                } else {
                    try {
                        out.put(name, Files.readString(file));
                    } catch (final MalformedInputException mie) {
                        throw new IOException("Invalid file: " + name, mie);
                    }
                }
                return super.visitFile(file, attrs);
            }
        });
        return out;
    }

    private void assertBuild(final Path mvnProject, final Path temp, final boolean win, final String java17Home) throws IOException, InterruptedException {
        exec(temp.resolve("mvn_outputs"), win, mvnProject, java17Home, "mvn", "package", "yupiik-tools:minisite");
        assertBuildResult(mvnProject);
    }

    private Path exec(final Path stdDir, final boolean win, final Path project, final String java17Home, final String... cmd) throws IOException, InterruptedException {
        final var exec = execStart(stdDir, win, project, java17Home, Map.of(), cmd);
        final var process = exec.getFirst();
        assertTrue(process.waitFor(Integer.getInteger("test.generator.timeout.mn", 10), MINUTES));

        final var stds = exec.getSecond();
        assertEquals(0, process.exitValue(), () -> {
            try {
                return Files.readString(stds.getSecond(), UTF_8) + Files.readString(stds.getFirst(), UTF_8);
            } catch (final IOException e) {
                return "invalid exit status: " + process.exitValue();
            }
        });
        assertEmpty(stds.getSecond());
        return stds.getFirst();
    }

    private Tuple2<Process, Tuple2<Path, Path>> execStart(final Path stdDir, final boolean win, final Path project, final String java17Home,
                                                          final Map<String, String> customEnv,
                                                          final String... cmd) throws IOException {
        final var outs = Files.createDirectories(stdDir);
        final var stderr = outs.resolve("stderr");
        final var stdout = outs.resolve("stdout");
        final var mvn = Path.of(System.getProperty("maven.home")).resolve("bin/mvn" + (win ? ".cmd" : "")).toString();
        final var processBuilder = new ProcessBuilder(Stream.of(cmd).map(it -> "mvn".equals(it) ? mvn : it).toArray(String[]::new))
                .redirectError(stderr.toFile())
                .redirectOutput(stdout.toFile())
                .directory(project.toFile());
        final var environment = processBuilder.environment();
        environment.put("JAVA_HOME", java17Home);
        environment.put("PATH",
                Path.of(java17Home).resolve("bin") + File.pathSeparator +
                        mvn + originalPath(environment, win ? "Path" : "PATH"));
        environment.putAll(customEnv);
        return new Tuple2<>(processBuilder.start(), new Tuple2<>(stdout, stderr));
    }

    private void dumpProject(final Map<String, String> files, final Path target) throws IOException {
        for (final Map.Entry<String, String> file : files.entrySet()) {
            final var output = target.resolve(file.getKey());
            Files.createDirectories(output.getParent());
            Files.writeString(output, file.getValue(), UTF_8);
        }
    }

    private Map<String, String> toFiles(final String parent, final JsonArray filesAsJson) {
        return filesAsJson.stream()
                .map(JsonValue::asJsonObject)
                .flatMap(it -> it.containsKey("children") ?
                        toFiles((parent.isBlank() ? "" : (parent + '/')) + it.getString("name"), it.getJsonArray("children")).entrySet().stream() :
                        Stream.of(entry(
                                (parent.isBlank() ? "" : parent + '/') + it.getString("name"),
                                it.getString("content"))))
                .collect(toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private JsonArray generateFullProject(final boolean windows, final Path basedir,
                                          final Path node, final Path temp) throws IOException, InterruptedException {
        final var spec = "" +
                "{\n" +
                "  \"nav\": {\n" +
                "    \"javaVersion\": 17,\n" +
                "    \"groupId\": \"org.example\",\n" +
                "    \"artifactId\": \"application\",\n" +
                "    \"version\": \"1.0.0-SNAPSHOT\"\n" +
                "  },\n" +
                "  \"features\": {\n" +
                Stream.of("jsonRpc", "frontend", "batch", "kubernetesClient", "jib", "bundlebee", "documentation")
                        .map(it -> "" +
                                "    \"" + it + "\": {\n" +
                                "      \"enabled\": true,\n" +
                                "      \"supportSubModule\": false,\n" +
                                "      \"useParent\": false\n" +
                                "    }\n" +
                                "")
                        .collect(joining(",")) +
                "  }\n" +
                "}" +
                "";

        final var sources = basedir.resolve("src/main/frontend/src/components/GeneratedProject");
        final var project = temp.resolve("src");
        Files.createDirectories(project);
        Files.walkFileTree(sources, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(final Path file, final BasicFileAttributes attrs) throws IOException {
                final var relative = sources.relativize(file).toString();
                final var target = project.resolve(relative.endsWith(".js") ? relative.substring(0, relative.length() - "js".length()) + "mjs" : relative);
                Files.createDirectories(target.getParent());
                if (relative.endsWith(".js")) { // handle the minor diff between esbuild/browser and nodejs
                    final var src = Files.readString(file, UTF_8);
                    Files.writeString(target, (src.contains("esbuild/plugins/resources") ?
                            "import fs from 'fs';\n" : "") +
                            src.replaceAll(
                                    "import (?<importName>[a-zA-Z]+) from '\\./(?<path>[a-z/]+)\\.txt';",
                                    "const ${importName} = fs.readFileSync('./${path}.txt', 'utf8');"));
                } else {
                    Files.copy(file, target);
                }
                return super.visitFile(file, attrs);
            }
        });
        final var runner = project.resolve("runner.test.mjs");
        Files.writeString(runner, "" +
                "import { generateFiles } from './generateFiles';\n" +
                "\n" +
                "console.log(JSON.stringify(generateFiles(" + spec + "), null, 2));\n" +
                "");

        final var outs = Files.createDirectories(temp.resolve("runner_outputs"));
        final var stderr = outs.resolve("stderr");
        final var stdout = outs.resolve("stdout");
        final var processBuilder = new ProcessBuilder(node.toString(), "--es-module-specifier-resolution=node", runner.toString())
                .redirectError(stderr.toFile())
                .redirectOutput(stdout.toFile())
                .directory(project.toFile());
        final var environment = processBuilder.environment();
        final var pathName = windows ? "Path" : "PATH";
        environment.put(
                pathName,
                node.getParent().normalize() + File.pathSeparator +
                        basedir.resolve("src/main/frontend/node_modules/.bin") +
                        originalPath(environment, pathName));
        final var process = processBuilder.start();
        assertTrue(process.waitFor(1, MINUTES));
        assertEquals(0, process.exitValue());

        assertEmpty(stderr);
        final var stdoutValue = Files.readString(stdout, UTF_8);
        try (final var reader = Json.createReader(new StringReader(stdoutValue))) {
            return reader.readArray();
        }
    }

    private String originalPath(final Map<String, String> environment, String pathName) {
        return environment.entrySet().stream()
                .filter(it -> pathName.equalsIgnoreCase(it.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .map(it -> File.pathSeparator + it)
                .orElse("");
    }

    private void assertEmpty(final Path stderr) throws IOException {
        final var stderrValue = Files.lines(stderr, UTF_8)
                // ignore jruby warnings
                .filter(it -> !it.contains("WARN FilenoUtil") &&
                        !it.contains("Pass '--add-opens"))
                .collect(joining("\n"));
        if (!stderrValue.isBlank()) {
            fail(stderrValue);
        }
    }
}
