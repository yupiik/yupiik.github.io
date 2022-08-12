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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import static java.util.Comparator.comparing;
import static java.util.Optional.ofNullable;
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
        final var activeMode = ofNullable(configuration.get("active")).orElse("true");
        switch (activeMode.toLowerCase(Locale.ROOT)) {
            case "no":
            case "false":
                log.info("Skipping projects generation");
                return;
            case "prefer-cache": // useful in dev to ensure there is a page even not up to date (create if not exists pattern)
                doGenerate(true);
                return;
            default:
                doGenerate(false);
        }
    }

    private void doGenerate(final boolean preferCache) {
        final var projectPage = sourceBase.resolve("content/_partials/generated/projects.adoc");
        if (preferCache && Files.exists(projectPage)) {
            return;
        }
        final var settingsXml = ofNullable(configuration.get("settingsXml"))
                .orElseGet(() -> System.getenv("YUPIIK_SETTINGS_XML"));
        log.info("Configured settings.xml: " + settingsXml);
        try {
            Files.createDirectories(projectPage.getParent());
            Files.writeString(projectPage, generateContent(settingsXml));
        } catch (final IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private String generateContent(final String settingsXml) {
        final var githubApiBase = configuration.getOrDefault("githubApiBase", "https://api.github.com");
        final var serverId = configuration.getOrDefault("serverId", "github.com");
        final var server = findServer(settingsXml, serverId);
        final var basic = server.getUsername() == null || server.getUsername().isBlank() ?
                server.getPassword() :
                ("Basic " + Base64.getEncoder().encodeToString((server.getUsername() + ':' + server.getPassword())
                        .getBytes(StandardCharsets.ISO_8859_1)));

        final var httpClient = HttpClient.newHttpClient();

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
                    .map(repo -> isOpenSourceRepo(httpClient, githubApiBase, basic, repo)
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

            return "" +
                    "++++\n" +
                    "<div class=\"px-3 px-md-5 pt-5\">\n" +
                    "<div class=\"project justify-content-center row row-cols-1 row-cols-md-3 row-cols-sm-2 row-cols-xl-4\">\n" +
                    ossRepos.stream()
                            .sorted(comparing(GithubRepo::getFullName))
                            .map(repo -> "" +
                                    "<div class=\"col my-3\">\n" +
                                    "<div class=\"card p-3\">\n" +
                                    "  <img class=\"card-img-top\" src=\"" + repo.getYupiikSiteMetadata().getLogo() + "\"/>\n" +
                                    "  <div class=\"card-body\">\n" +
                                    "    <h5 class=\"card-title\">" + repo.getYupiikSiteMetadata().getName() + "</h5>\n" +
                                    "    <p class=\"card-text\">" + repo.getYupiikSiteMetadata().getDescription() + "</p>\n" +
                                    "  </div>\n" +
                                    "  <div class=\"card-footer align-self-center\">" +
                                    "    <a href=\"" + repo.getYupiikSiteMetadata().getWebsite() + "\" class=\"btn btn-primary\">View project</a>\n" +
                                    "  </div>" +
                                    "</div>\n" +
                                    "</div>\n")
                            .collect(joining()) +
                    "</div>\n" +
                    "</div>\n" +
                    "++++\n";
        } catch (final Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private MavenDecrypter.Server findServer(final String settingsXml, final String serverId) {
        try {
            return newMavenDecrypter(settingsXml).find(serverId);
        } catch (final RuntimeException re) {
            return ofNullable(System.getenv("GITHUB_TOKEN"))
                    .map(token -> {
                        final var server = new MavenDecrypter.Server();
                        server.setId("github.com");
                        server.setPassword("Bearer " + token);
                        return server;
                    })
                    .orElseThrow(() -> new IllegalStateException("No $GITHUB_TOKEN", re));
        }
    }

    private MavenDecrypter newMavenDecrypter(final String settings) {
        final var exists = settings != null && !settings.isBlank() && new File(settings).exists();
        if (exists) {
            log.info("Using settings.xml: '" + settings + "'");
        } else {
            if (settings != null && !settings.isBlank()) {
                log.warning("'" + settings + "' does not exist in " + Paths.get(".").normalize());
            }
            log.info("Using default settings.xml");
        }
        final var settingsXml = !exists ? null : new File(settings);
        return settingsXml == null ?
                new MavenDecrypter() :
                new MavenDecrypter(
                        settingsXml,
                        new File(settingsXml.getParentFile(), "settings-security.xml"));
    }

    private CompletionStage<YupiikSiteMetadata> loadOssMetadata(final HttpClient client, final String githubApiBase, final String basic,
                                                                final Jsonb jsonb, final GithubRepo repo) {
        final var dropYupiikPrefix = Pattern.compile("^yupiik/");

        return client.sendAsync(
                        HttpRequest.newBuilder()
                                .GET()
                                .uri(URI.create("https://raw.githubusercontent.com/yupiik/" + dropYupiikPrefix.matcher(repo.getFullName()).replaceFirst("") + "/master/oss.json"))
                                .header("Accept", "application/json")
                                //.header("Authorization", basic)
                                .build(),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .thenApply(response -> {
                    if (response.statusCode() == 404) {
                        return new YupiikSiteMetadata();
                    } else if (response.statusCode() == 200) {
                        return overrides(jsonb.fromJson(response.body(), YupiikSiteMetadata.class));
                    } else {
                        throw new IllegalArgumentException("Invalid response: " + response + " (for repo: " + repo + ")");
                    }
                });
    }

    private YupiikSiteMetadata overrides(final YupiikSiteMetadata metadata) {
        if (metadata.getLogo() == null || "https://www.yupiik.com/img/logo.png".equals(metadata.getLogo())) {
            var website = metadata.getWebsite();
            if (website.endsWith("/")) {
                website = website.substring(0, website.length() - 1);
            }
            final var artifact = website.substring(website.lastIndexOf('/') + 1);
            final var relative = "images/projects/" + artifact + "_no-fir.svg";
            final var override = sourceBase.resolve("assets").resolve(relative);
            if (Files.exists(override)) {
                metadata.setLogo('/' + relative);
            }
        }
        return metadata;
    }

    private CompletionStage<Boolean> isOpenSourceRepo(final HttpClient client, final String githubApiBase, final String basic,
                                                      final GithubRepo repo) {
        return client.sendAsync(
                        HttpRequest.newBuilder()
                                .GET()
                                .uri(URI.create(githubApiBase + "/repos/" + repo.getFullName() + "/contents/oss.json"))
                                .header("Accept", "application/json")
                                .header("Authorization", basic)
                                .build(),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                .thenApply(response -> response.statusCode() == 200) /* has a oss.json file */;
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
        private String name;
        private String description;
        private List<String> categories = List.of();
        private String logo; // url of the logo to use
        private String website;
    }
}
