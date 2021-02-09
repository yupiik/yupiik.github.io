/*
 * Copyright (c) 2020 - Yupiik SAS - https://www.yupiik.com - All right reserved
 *
 * This software and related documentation are provided under a license agreement containing restrictions on use and
 * disclosure and are protected by intellectual property laws. Except as expressly permitted in your license agreement
 * or allowed by law, you may not use, copy, reproduce, translate, broadcast, modify, license, transmit, distribute,
 * exhibit, perform, publish, or display any part, in any form, or by any means. Reverse engineering, disassembly, or
 * decompilation of this software, unless required by law for interoperability, is prohibited.
 *
 * The information contained herein is subject to change without notice and is not warranted to be error-free. If you
 * find any errors, please report them to us in writing.
 *
 * This software is developed for general use in a variety of information management applications. It is not developed
 * or intended for use in any inherently dangerous applications, including applications that may create a risk of personal
 * injury. If you use this software or hardware in dangerous applications, then you shall be responsible to take all
 * appropriate fail-safe, backup, redundancy, and other measures to ensure its safe use. Yupiik SAS and its affiliates
 * disclaim any liability for any damages caused by use of this software or hardware in dangerous applications.
 *
 * Yupiik and Galaxy are registered trademarks of Yupiik SAS and/or its affiliates. Other names may be trademarks
 * of their respective owners.
 *
 * This software and documentation may provide access to or information about content, products, and services from third
 * parties. Yupiik SAS and its affiliates are not responsible for and expressly disclaim all warranties of any kind with
 * respect to third-party content, products, and services unless otherwise set forth in an applicable agreement between
 * you and Yupiik SAS. Yupiik SAS and its affiliates will not be responsible for any loss, costs, or damages incurred
 * due to your access to or use of third-party content, products, or services, except as set forth in an applicable
 * agreement between you and Yupiik SAS.
 */
package io.yupiik.site.mvn;

import lombok.AllArgsConstructor;
import lombok.Data;
import org.xml.sax.Attributes;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.util.Optional.ofNullable;

@Data
@AllArgsConstructor
public class MavenDecrypter {
    private final File settings;
    private final File settingsSecurity;

    public MavenDecrypter() {
        this(new File(getM2(), "settings.xml"), new File(getM2(), "settings-security.xml"));
    }

    public Server find(final String serverId) {
        final SAXParserFactory saxParserFactory = SAXParserFactory.newInstance();
        saxParserFactory.setNamespaceAware(false);
        saxParserFactory.setValidating(false);
        final SAXParser parser;
        try {
            parser = saxParserFactory.newSAXParser();
        } catch (final ParserConfigurationException | SAXException e) {
            throw new IllegalStateException(e);
        }
        if (!settings.exists()) {
            throw new IllegalArgumentException(
                    "No " + settings + " found, ensure your credentials configuration is valid");
        }

        final String master;
        if (settingsSecurity.isFile()) {
            final MvnMasterExtractor extractor = new MvnMasterExtractor();
            try (final InputStream is = new FileInputStream(settingsSecurity)) {
                parser.parse(is, extractor);
            } catch (final IOException | SAXException e) {
                throw new IllegalArgumentException(e);
            }
            master = extractor.current == null ? null : extractor.current.toString().trim();
        } else {
            master = null;
        }

        final MvnServerExtractor extractor = new MvnServerExtractor(master, serverId);
        try (final InputStream is = new FileInputStream(settings)) {
            parser.parse(is, extractor);
        } catch (final IOException | SAXException e) {
            throw new IllegalArgumentException(e);
        }
        if (extractor.server == null) {
            throw new IllegalArgumentException("Didn't find " + serverId + " in " + settings);
        }
        return extractor.server;
    }

    private static File getM2() {
        return ofNullable(System.getProperty("galaxy.m2.location"))
                .map(File::new)
                .orElseGet(() -> new File(System.getProperty("user.home"), ".m2"));
    }

    private static class MvnServerExtractor extends DefaultHandler {
        private static final Pattern ENCRYPTED_PATTERN = Pattern.compile(".*?[^\\\\]?\\{(.*?[^\\\\])\\}.*");

        private final String passphrase;
        private final String serverId;

        private Server server;
        private String encryptedPassword;
        private boolean done;
        private StringBuilder current;

        private MvnServerExtractor(final String passphrase, final String serverId) {
            this.passphrase = doDecrypt(passphrase, "settings.security");
            this.serverId = serverId;
        }

        @Override
        public void startElement(final String uri, final String localName, final String qName,
                                 final Attributes attributes) {
            if ("server".equalsIgnoreCase(qName)) {
                if (!done) {
                    server = new Server();
                }
            } else if (server != null) {
                current = new StringBuilder();
            }
        }

        @Override
        public void characters(final char[] ch, final int start, final int length) {
            if (current != null) {
                current.append(new String(ch, start, length));
            }
        }

        @Override
        public void endElement(final String uri, final String localName, final String qName) {
            if (done) {
                // decrypt password only when the server is found
                server.setPassword(doDecrypt(encryptedPassword, passphrase));
                return;
            }
            if ("server".equalsIgnoreCase(qName)) {
                if (server.getId().equals(serverId)) {
                    done = true;
                } else if (!done) {
                    server = null;
                    encryptedPassword = null;
                }
            } else if (server != null && current != null) {
                switch (qName) {
                    case "id":
                        server.setId(current.toString());
                        break;
                    case "username":
                        try {
                            server.setUsername(doDecrypt(current.toString(), passphrase));
                        } catch (final RuntimeException re) {
                            server.setUsername(current.toString());
                        }
                        break;
                    case "password":
                        encryptedPassword = current.toString();
                        break;
                    default:
                }
                current = null;
            }
        }

        private String doDecrypt(final String value, final String pwd) {
            if (value == null) {
                return null;
            }

            final Matcher matcher = ENCRYPTED_PATTERN.matcher(value);
            if (!matcher.matches() && !matcher.find()) {
                return value; // not encrypted, just use it
            }

            final String bare = matcher.group(1);
            if (value.startsWith("${env.")) {
                final String key = bare.substring("env.".length());
                return ofNullable(System.getenv(key)).orElseGet(() -> System.getProperty(bare));
            }
            if (value.startsWith("${")) { // all is system prop, no interpolation yet
                return System.getProperty(bare);
            }

            if (pwd == null || pwd.isEmpty()) {
                throw new IllegalArgumentException("Master password can't be null or empty.");
            }

            if (bare.contains("[") && bare.contains("]") && bare.contains("type=")) {
                throw new IllegalArgumentException("Unsupported encryption for " + value);
            }

            final byte[] allEncryptedBytes = Base64.getMimeDecoder().decode(bare);
            final int totalLen = allEncryptedBytes.length;
            final byte[] salt = new byte[8];
            System.arraycopy(allEncryptedBytes, 0, salt, 0, 8);
            final byte padLen = allEncryptedBytes[8];
            final byte[] encryptedBytes = new byte[totalLen - 8 - 1 - padLen];
            System.arraycopy(allEncryptedBytes, 8 + 1, encryptedBytes, 0, encryptedBytes.length);

            try {
                final MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] keyAndIv = new byte[16 * 2];
                byte[] result;
                int currentPos = 0;

                while (currentPos < keyAndIv.length) {
                    digest.update(pwd.getBytes(StandardCharsets.UTF_8));

                    digest.update(salt, 0, 8);
                    result = digest.digest();

                    final int stillNeed = keyAndIv.length - currentPos;
                    if (result.length > stillNeed) {
                        final byte[] b = new byte[stillNeed];
                        System.arraycopy(result, 0, b, 0, b.length);
                        result = b;
                    }

                    System.arraycopy(result, 0, keyAndIv, currentPos, result.length);

                    currentPos += result.length;
                    if (currentPos < keyAndIv.length) {
                        digest.reset();
                        digest.update(result);
                    }
                }

                final byte[] key = new byte[16];
                final byte[] iv = new byte[16];
                System.arraycopy(keyAndIv, 0, key, 0, key.length);
                System.arraycopy(keyAndIv, key.length, iv, 0, iv.length);

                final Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
                cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));

                final byte[] clearBytes = cipher.doFinal(encryptedBytes);
                return new String(clearBytes, StandardCharsets.UTF_8);
            } catch (final Exception e) {
                throw new IllegalStateException(e);
            }
        }
    }

    private static class MvnMasterExtractor extends DefaultHandler {
        private StringBuilder current;

        @Override
        public void startElement(final String uri, final String localName, final String qName,
                                 final Attributes attributes) {
            if ("master".equalsIgnoreCase(qName)) {
                current = new StringBuilder();
            }
        }

        @Override
        public void characters(final char[] ch, final int start, final int length) {
            if (current != null) {
                current.append(new String(ch, start, length));
            }
        }
    }


    @Data
    public static class Server {
        private String id;
        private String username;
        private String password;
    }
}
