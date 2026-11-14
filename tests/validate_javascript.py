"""Check authored inline JavaScript with Python 3 and an installed Node.js.

Run: python3 tests/validate_javascript.py
Reads public/index.html and pipes scripts to node --check; no files are generated.
"""

from html.parser import HTMLParser
from pathlib import Path
import subprocess


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.current = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            attributes = dict(attrs)
            if attributes.get('type', '') in ('', 'text/javascript', 'module'):
                self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.current is not None:
            self.scripts.append(''.join(self.current))
            self.current = None


parser = Scripts()
parser.feed((Path(__file__).resolve().parents[1] / 'public/index.html').read_text())
parser.close()
if not parser.scripts:
    raise SystemExit('No executable inline scripts found; review syntax-check coverage.')
for position, script in enumerate(parser.scripts, 1):
    result = subprocess.run(['node', '--check'], input=script, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit(f'Inline script {position}:\n{result.stderr}')
print(f'PASS: syntax of {len(parser.scripts)} executable inline scripts; no generated files.')
