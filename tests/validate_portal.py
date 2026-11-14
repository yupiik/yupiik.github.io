"""Offline checks of authored HTML; run with python3 tests/validate_portal.py.

Uses only the Python standard library and never writes website files.
This checks catalogue structure, not full HTML conformance or browser layout.
"""

import json
import struct
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree.ElementTree import Element, SubElement


class Document(HTMLParser):
    VOID = set('area base br col embed hr img input link meta param source track wbr'.split())

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element('document')
        self.stack = [self.root]
        self.feed(source)
        self.close()
        assert len(self.stack) == 1, 'Unclosed HTML elements'

    def handle_starttag(self, tag, attrs):
        node = SubElement(self.stack[-1], tag, dict(attrs))
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        assert self.stack[-1].tag == tag, f'Unexpected closing tag: {tag}'
        self.stack.pop()

    def handle_data(self, data):
        node = self.stack[-1]
        node.text = (node.text or '') + data


public = Path(__file__).resolve().parents[1] / 'public'
source = (public / 'index.html').read_text()
root = Document(source).root
ids = [node.get('id') for node in root.iter() if node.get('id')]
assert len(ids) == len(set(ids)), 'Duplicate IDs'
for node in root.iter():
    for label in node.get('aria-labelledby', '').split():
        assert label in ids, f'Missing accessible label: {label}'
    for attr in ('href', 'src'):
        value = node.get(attr)
        if value is None:
            continue
        assert value and not any(c.isspace() for c in value), f'Invalid URL: {value}'
        url = urlsplit(value)
        if url.scheme or url.netloc:
            assert url.scheme == 'https' and url.hostname and not url.username, value
        elif url.path:
            assert (public / url.path).is_file(), f'Missing local file: {value}'
        elif url.fragment:
            assert url.fragment in ids, f'Missing anchor: {value}'
    if node.get('target') == '_blank':
        assert {'noopener', 'noreferrer'} <= set(node.get('rel', '').split())

grid = root.find('.//*[@id="grid"]')
cards = list(grid)
assert len(cards) == 9
categories = set()
for card in cards:
    assert card.tag == 'article' and card.get('role') == 'listitem'
    assert 'hidden' not in card.attrib and 'style' not in card.attrib
    assert card.find('div/h3').text.strip()
    assert card.find('div/p[@class="desc"]').text.strip()
    assert card.find('div/p[@class="category"]').text.strip()
    assert len(card.findall('div/ul[@aria-label="Technologies"]/li')) >= 2
    categories.add(card.get('data-category'))
    links = card.findall('div[@class="project-links"]/a')
    assert len(links) == 2 and all(a.text.strip() for a in links)
assert categories == {'java-frameworks', 'cloud-native', 'ai-agents', 'data-engineering', 'developer-tools'}
assert 'hidden' in root.find('.//*[@id="project-tools"]').attrib
for control in ('project-search', 'project-category'):
    assert root.find(f'.//label[@for="{control}"]').text.strip()
assert root.find('.//*[@id="project-results"]').get('role') == 'status'
options = root.findall('.//select[@id="project-category"]/option')
assert {option.get('value') for option in options} == categories | {'all'}

schemas = [json.loads(n.text) for n in root.findall('.//script[@type="application/ld+json"]')]
canonical = root.find('.//link[@rel="canonical"]').get('href')
assert canonical == 'https://www.yupiik.io/'
title = root.find('.//title').text
description = root.find('.//meta[@name="description"]').get('content')
assert all(term in title and term in description for term in ('Java', 'Kubernetes', 'MCP', 'Apache Hop'))
assert root.find('.//meta[@property="og:url"]').get('content') == canonical
for name in ('title', 'description', 'image', 'image:alt'):
    og = root.find(f'.//meta[@property="og:{name}"]').get('content')
    twitter = root.find(f'.//meta[@name="twitter:{name}"]').get('content')
    assert og == twitter, f'Social metadata differs: {name}'
    if name in ('title', 'description'):
        assert og == (title if name == 'title' else description)
organization = next(s for s in schemas if s['@type'] == 'Organization')
assert organization['url'] == canonical
image_url = root.find('.//meta[@property="og:image"]').get('content')
assert organization['logo'] == image_url
assert urlsplit(image_url).netloc == urlsplit(canonical).netloc
image_file = public / urlsplit(image_url).path.lstrip('/')
assert image_file.is_file()
width, height = struct.unpack('>II', image_file.read_bytes()[16:24])
assert (width, height) == tuple(int(root.find(f'.//meta[@property="og:image:{dimension}"]').get('content')) for dimension in ('width', 'height'))
for image in root.findall('.//img'):
    assert int(image.get('width')) > 0 and int(image.get('height')) > 0
assert not root.findall('.//script[@src]')
assert not any(urlsplit(link.get('href', '')).netloc for link in root.findall('.//link') if link.get('rel') != 'canonical')
items = next(s for s in schemas if s['@type'] == 'ItemList')['itemListElement']
assert len(items) == len(cards)
for position, (card, item) in enumerate(zip(cards, items), 1):
    assert item['position'] == position
    assert item['name'] == card.find('div/h3').text
    assert item['url'] == card.find('div[@class="project-links"]/a').get('href'), f'JSON-LD URL differs from card: {item["name"]}'
assert 'Coding Agent' not in source
for obsolete in ('const PROJECTS', 'grid.innerHTML', 'function render(', 'fetch('):
    assert obsolete not in source, obsolete
print('PASS: nine literal cards, five categories, links/assets/labels, JSON-LD parity, pending-project exclusion.')
