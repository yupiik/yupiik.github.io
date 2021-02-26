package io.yupiik.site;

import io.yupiik.site.mvn.MavenDecrypter;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.java.Log;
import org.apache.johnzon.mapper.reflection.JohnzonParameterizedType;
import org.xml.sax.Attributes;
import org.xml.sax.helpers.DefaultHandler;

import javax.json.JsonObject;
import javax.json.bind.Jsonb;
import javax.json.bind.JsonbBuilder;
import javax.json.bind.annotation.JsonbProperty;
import javax.json.bind.annotation.JsonbTransient;
import javax.xml.parsers.SAXParserFactory;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import static java.util.Comparator.comparing;
import static java.util.concurrent.CompletableFuture.allOf;
import static java.util.stream.Collectors.joining;
import static lombok.AccessLevel.PRIVATE;

@Log
@RequiredArgsConstructor
public class GenerateProjectsPage implements Runnable {
    private final Path sourceBase; // src/main/minisite
    private final Map<String, String> configuration;

    @Override
    public void run() {
        final var projectPage = sourceBase.resolve("content/generated/projects.adoc");
        try {
            Files.createDirectories(projectPage.getParent());
            Files.writeString(projectPage, generateContent());
        } catch (final IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private String generateContent() {
        final var githubApiBase = configuration.getOrDefault("githubApiBase", "https://api.github.com");
        final var serverId = configuration.getOrDefault("serverId", "github.com");
        final var server = newMavenDecrypter().find(serverId);
        final var basic = server.getUsername() == null || server.getUsername().isBlank() ?
                server.getPassword() :
                ("Basic " + Base64.getEncoder().encodeToString((server.getUsername() + ':' + server.getPassword())
                        .getBytes(StandardCharsets.ISO_8859_1)));

        final var httpClient = HttpClient.newHttpClient();

        final var saxParserFactory = SAXParserFactory.newInstance();
        saxParserFactory.setNamespaceAware(false);
        saxParserFactory.setValidating(false);

        final var ossRepos = new CopyOnWriteArrayList<GithubRepo>();
        try (final Jsonb jsonb = JsonbBuilder.create()) {
            final var repositories = new ArrayList<GithubRepo>();
            var next = githubApiBase + "/orgs/yupiik/repos?type=public&sort=full_name&per_page=100&page=0";
            while (next != null) {
                log.info("Loading " + next);
                final var repos = httpClient.send(
                        HttpRequest.newBuilder()
                                .GET()
                                .uri(URI.create(next))
                                .header("Accept", "application/vnd.github.v3+json")
                                .header("Authorization", basic)
                                .build(),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (repos.statusCode() != 200) {
                    throw new IllegalArgumentException("Invalid response: " + repos);
                }
                repositories.addAll(jsonb.fromJson(repos.body(), new JohnzonParameterizedType(List.class, GithubRepo.class)));
                next = repos.headers().allValues("Link").stream()
                        .filter(it -> it.contains("rel=\"next\""))
                        .map(this::extractNext)
                        .findFirst()
                        .orElse(null);
            }

            allOf(repositories.stream()
                    .map(repo -> isOpenSourceRepo(httpClient, githubApiBase, basic, saxParserFactory, jsonb, repo)
                            .thenCompose(isOss -> {
                                if (isOss) {
                                    return loadOssMetadata(httpClient, githubApiBase, basic, jsonb, repo)
                                            .thenAccept(repo::setYupiikSiteMetadata)
                                            .thenAccept(done -> {
                                                if (!repo.getYupiikSiteMetadata().isSkip()) {
                                                    ossRepos.add(repo);
                                                }
                                            })
                                            .toCompletableFuture();
                                }
                                return CompletableFuture.completedFuture(null);
                            })
                            .toCompletableFuture())
                    .toArray(CompletableFuture<?>[]::new))
                    .toCompletableFuture().get();

            final var dropYupiikPrefix = Pattern.compile("^yupiik/");

            return "" +
                    "= Yupiik OSS Projects\n" +
                    "\n" +
                    "[role=\"project-ulist\"]\n" +
                    ossRepos.stream()
                            .sorted(comparing(GithubRepo::getFullName))
                            .map(repo -> "* link:" + repo.getHtmlUrl() + '[' + dropYupiikPrefix.matcher(repo.getFullName()).replaceFirst("") + "^]")
                            .collect(joining("\n", "", "\n")) +
                    "\n" +
                    "\n" +
                    "++++\n" +
                    "<div id=\"project-details\">\n" +
                    "  <h3 id=\"project-details-title\"></h3>\n" +
                    "  <p id=\"project-details-link\"></p>\n" +
                    "  <p id=\"project-details-description\"></p>\n" +
                    "</div>\n" +
                    "<div id=\"project-diagram\"></div>\n" +
                    "<script src=\"//cdn.amcharts.com/lib/4/core.js\"></script>\n" +
                    "<script src=\"//cdn.amcharts.com/lib/4/charts.js\"></script>\n" +
                    "<script src=\"//cdn.amcharts.com/lib/4/plugins/forceDirected.js\"></script>\n" +
                    "<script src=\"//cdn.amcharts.com/lib/4/themes/animated.js\"></script>\n" +
                    "<script>\n" +
                    "(function () {\n" +
                    "var chart = am4core.create(\"project-diagram\", am4plugins_forceDirected.ForceDirectedTree);\n" +
                    "var networkSeries = chart.series.push(new am4plugins_forceDirected.ForceDirectedSeries())\n" +
                    "\n" +
                    "chart.data = [\n" +
                    "  {\n" +
                    "    name: \"Yupiik OSS\",\n" +
                    "    root: true,\n" +
                    "    children: [\n" +
                    ossRepos.stream()
                            .sorted(comparing(GithubRepo::getFullName))
                            .map(repo -> "" +
                                    "      {\n" +
                                    "        name: \"" + dropYupiikPrefix.matcher(repo.getFullName()).replaceFirst("") + "\",\n" +
                                    "        value: " + repo.getSize() + ",\n" +
                                    "        data: " + jsonb.toJson(repo) + ",\n" +
                                    "        root: false\n" +
                                    "      }")
                            .collect(joining(",\n", "", "\n")) +
                    "    ]\n" +
                    "  }\n" +
                    "];\n" +
                    "\n" +
                    "networkSeries.dataFields.name = \"name\";\n" +
                    "networkSeries.dataFields.value = \"value\";\n" +
                    "networkSeries.dataFields.children = \"children\";\n" +
                    "networkSeries.nodes.template.tooltipText = \"{name}\";\n" +
                    "networkSeries.nodes.template.fillOpacity = 1;\n" +
                    "networkSeries.nodes.template.label.text = \"{name}\"\n" +
                    "networkSeries.fontSize = 10;\n" +
                    "networkSeries.links.template.strokeWidth = 1;\n" +
                    "\n" +
                    "var hoverState = networkSeries.links.template.states.create(\"hover\");\n" +
                    "hoverState.properties.strokeWidth = 3;\n" +
                    "hoverState.properties.strokeOpacity = 1;\n" +
                    "\n" +
                    "networkSeries.nodes.template.events.on(\"over\", function(event) {\n" +
                    "  event.target.dataItem.childLinks.each(function(link) {\n" +
                    "    link.isHover = true;\n" +
                    "  })\n" +
                    "  if (event.target.dataItem.parentLink) {\n" +
                    "    event.target.dataItem.parentLink.isHover = true;\n" +
                    "  }\n" +
                    "\n" +
                    "})\n" +
                    "networkSeries.nodes.template.events.on(\"out\", function(event) {\n" +
                    "  event.target.dataItem.childLinks.each(function(link) {\n" +
                    "    link.isHover = false;\n" +
                    "  })\n" +
                    "  if (event.target.dataItem.parentLink) {\n" +
                    "    event.target.dataItem.parentLink.isHover = false;\n" +
                    "  }\n" +
                    "})\n" +
                    "networkSeries.nodes.template.events.on(\"hit\", function(event) {\n" +
                    "  var filtered = chart.data[0].children.filter(function (item) {\n" +
                    "    return item.name == event.target.dataItem.name;\n" +
                    "  });\n" +
                    "  var data = filtered && filtered.length == 1 ? filtered[0].data : undefined;\n" +
                    "  if (!data) { return; }\n" +
                    "  var name = data.full_name.replace('yupiik/', '');\n" +
                    "  document.querySelector('#project-details-title').innerHTML = name;\n" +
                    "  document.querySelector('#project-details-link').innerHTML = '<a href=\"' + data.html_url + '\">' + name + '</a>';\n" +
                    "  document.querySelector('#project-details-description').innerHTML = data.description;\n" +
                    "});\n" +
                    "})();\n" +
                    "</script>\n" +
                    "++++\n";
        } catch (final Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private MavenDecrypter newMavenDecrypter() {
        final var arguments = ManagementFactory.getRuntimeMXBean().getInputArguments();
        final var settings = arguments.indexOf("-s");
        final var settingsXml = new File(arguments.get(settings + 1));
        if (settings > 0) {
            log.info("Using settings.xml: '" + settingsXml + "'");
        }
        return settings < 0 ? new MavenDecrypter() : new MavenDecrypter(
                settingsXml, new File(settingsXml.getParentFile(), "settings-security.xml"));
    }

    private CompletionStage<YupiikSiteMetadata> loadOssMetadata(final HttpClient client, final String githubApiBase, final String basic,
                                                                final Jsonb jsonb, final GithubRepo repo) {
        return client.sendAsync(
                HttpRequest.newBuilder()
                        .GET()
                        .uri(URI.create(githubApiBase + "/repos/" + repo.getFullName() + "/contents/yupiik.io.json"))
                        .header("Accept", "application/json")
                        .header("Authorization", basic)
                        .build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .thenApply(response -> {
                    if (response.statusCode() == 404) {
                        return new YupiikSiteMetadata();
                    } else if (response.statusCode() == 200) {
                        return jsonb.fromJson(response.body(), YupiikSiteMetadata.class);
                    } else {
                        throw new IllegalArgumentException("Invalid response: " + response + " (for repo: " + repo + ")");
                    }
                });
    }

    private CompletionStage<Boolean> isOpenSourceRepo(final HttpClient client, final String githubApiBase, final String basic,
                                                      final SAXParserFactory saxParserFactory, final Jsonb jsonb,
                                                      final GithubRepo repo) {
        return client.sendAsync(
                HttpRequest.newBuilder()
                        .GET()
                        .uri(URI.create(githubApiBase + "/repos/" + repo.getFullName() + "/contents/pom.xml"))
                        .header("Accept", "application/json")
                        .header("Authorization", basic)
                        .build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .thenApply(response -> response.statusCode() == 200 /* has a root pom.xml */ &&
                        isIoYupiik(saxParserFactory, jsonb, response.body()));
    }

    private boolean isIoYupiik(final SAXParserFactory saxParserFactory, final Jsonb jsonb, final String pomXml) {
        try {
            final byte[] rawPomXml = readContent(jsonb, pomXml);
            final var handler = new GavParser();
            final var parser = saxParserFactory.newSAXParser();
            try (final var stream = new ByteArrayInputStream(rawPomXml)) {
                parser.parse(stream, handler);
            }
            return handler.group != null && handler.group.startsWith("io.yupiik") && !handler.group.equals("io.yupiik.site");
        } catch (final Exception e) {
            return false;
        }
    }

    private byte[] readContent(final Jsonb jsonb, final String pomXml) {
        final var json = jsonb.fromJson(pomXml, JsonObject.class);
        return Base64.getDecoder().decode(json.getString("content").replace("\n", "").trim());
    }

    private String extractNext(final String link) {
        final int endIdx = link.indexOf("rel=\"next\"");
        return link.substring(link.lastIndexOf('<', endIdx) + 1, link.lastIndexOf('>', endIdx));
    }

    @NoArgsConstructor(access = PRIVATE)
    private static class GavParser extends DefaultHandler {
        @Getter
        private String group;

        private final LinkedList<String> tags = new LinkedList<>();
        private StringBuilder text;

        @Override
        public void startElement(final String uri, final String localName,
                                 final String qName, final Attributes attributes) {
            if ("groupId".equals(qName) || "artifactId".equals(qName) || "version".equals(qName)) {
                text = new StringBuilder();
            }
            tags.add(qName);
        }

        @Override
        public void characters(final char[] ch, final int start, final int length) {
            if (text != null) {
                text.append(new String(ch, start, length));
            }
        }

        @Override
        public void endElement(final String uri, final String localName, final String qName) {
            tags.removeLast();
            if ("groupId".equals(qName) && "project".equals(tags.getLast())) {
                group = text.toString().trim();
            } else if ("groupId".equals(qName) && "parent".equals(tags.getLast()) && tags.size() == 2 && group == null) {
                group = text.toString().trim();
            }
            text = null;
        }
    }

    @Data
    public static class License {
        private String key;

        @JsonbProperty("spdx_id")
        private String spdxId;

        private String name;
        private String url;
    }

    @Data
    public static class GithubRepo {
        private String id;

        @JsonbProperty("full_name")
        private String fullName;

        private String description;
        private String homepage;

        @JsonbProperty("html_url")
        private String htmlUrl;

        @JsonbProperty("created_at")
        private OffsetDateTime createdAt;

        @JsonbProperty("private")
        private boolean privateRepo;

        private License license;

        private int forks;
        private int size;

        @JsonbTransient
        private YupiikSiteMetadata yupiikSiteMetadata;
    }

    @Data // enables to host custom meta for the generation
    public static class YupiikSiteMetadata {
        private boolean skip; // enables to skip a repo matching OSS filtering
        private List<String> categories = List.of();
    }
}
