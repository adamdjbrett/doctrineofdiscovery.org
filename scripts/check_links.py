"""Offline checks for local URLs, fragments, redirects, and published media paths."""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

CONTRACT = Path(__file__).parent.parent/'tests/fixtures/public-urls.json'
MEDIA = {'.pdf','.png','.jpg','.jpeg','.gif','.webp','.avif','.svg','.ico'}


def normalized(value):
    return unicodedata.normalize('NFC', value)


def css_urls(value):
    return [match[1] for match in re.findall(r'url\(\s*([\'"]?)(.*?)\1\s*\)', value, re.I)]


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.urls = []
        self.ids = set()
        self.style = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ['id', 'name']:
            if attrs.get(key):
                self.ids.add(normalized(attrs[key]))
        for key in ['href', 'src', 'poster', 'action', 'data-search', 'data-gallery', 'data-pagefind']:
            if attrs.get(key):
                self.urls.append(attrs[key])
        meta = attrs.get('name',attrs.get('property','')).lower()
        if tag == 'meta' and (meta.endswith(('_url',':url')) or meta in ['og:image','twitter:image','twitter:image:src','dc.identifier']):
            if attrs.get('content'):
                self.urls.append(attrs['content'])
        for key in ['srcset', 'imagesrcset']:
            value = attrs.get(key, '')
            if not value.startswith('data:'):
                self.urls.extend(candidate.strip().split()[0] for candidate in value.split(',') if candidate.strip())
        self.urls.extend(css_urls(attrs.get('style', '')))
        if tag == 'style':
            self.style = True

    def handle_endtag(self, tag):
        if tag == 'style':
            self.style = False

    def handle_data(self, value):
        if self.style:
            self.urls.extend(css_urls(value))


class SiteLinks:
    def __init__(self, root, host='doctrineofdiscovery.org'):
        self.root = Path(root)
        self.hosts = {host.removeprefix('www.'), 'www.'+host.removeprefix('www.')}
        self.origin = 'https://'+host
        self.files = {normalized('/'+p.relative_to(self.root).as_posix()):p for p in self.root.rglob('*') if p.is_file()}
        self.pages = {url:Links(path.read_text()) for url,path in self.files.items() if path.suffix in ['.html', '.svg']}
        self.redirects = []
        self.redirect_sources = set()
        for line in (self.root/'_redirects').read_text().splitlines():
            parts = line.split()
            if len(parts) < 2 or parts[0].startswith('#'):
                continue
            # Netlify placeholders match path segments; splats match the remainder.
            pattern = re.escape(parts[0])
            pattern = re.sub(r':([A-Za-z_]+)', r'(?P<\1>[^/]+)', pattern).replace(r'\*', '(?P<splat>.*)')
            status = parts[2] if len(parts)>2 else '301'
            if status.rstrip('!') in ['301', '302', '303', '307', '308']:
                self.redirects.append((re.compile('^'+pattern+'$'),parts[1],status.endswith('!')))
                if ':' not in parts[0] and '*' not in parts[0]:
                    self.redirect_sources.add(parts[0])

    def file(self, path):
        path = normalized(unquote(path))
        candidates = [path, path.rstrip('/')+'/index.html']
        if not Path(path).suffix:
            candidates.append(path.rstrip('/')+'.html')
        return next((candidate for candidate in candidates if candidate in self.files),None)

    def problem(self, value, source='/', seen=None):
        try:
            url = urlsplit(urljoin(self.origin+source, value))
        except ValueError:
            return 'invalid URL'
        if url.scheme not in ['http','https'] or url.hostname not in self.hosts:
            return None
        path = normalized(unquote(url.path or '/'))
        if path in ['/oai','/oai/']:
            return None  # Verified separately through the OAI handler tests.
        seen = set() if seen is None else seen
        if (path,url.fragment) in seen:
            return 'redirect loop'
        seen.add((path,url.fragment))
        file = self.file(url.path)
        for pattern,target,force in self.redirects:
            match = pattern.fullmatch(path)
            if match and (force or file is None):
                for name,replacement in match.groupdict().items():
                    target = target.replace(':'+name,replacement)
                if '#' not in target and url.fragment:
                    target += '#'+url.fragment
                return self.problem(target, path, seen)
        if file is None:
            return 'missing file or route (case-sensitive)'
        fragment = normalized(unquote(url.fragment).split(':~:text=')[0])
        if fragment and file in self.pages and fragment not in self.pages[file].ids:
            return 'missing fragment #'+fragment
        return None

    def errors(self, protected=()):
        errors = defaultdict(set)
        for file,page in self.pages.items():
            source = file.removesuffix('index.html') if file.endswith('/index.html') else file.removesuffix('.html')
            for value in page.urls:
                problem = self.problem(value,source)
                if problem:
                    errors[(value,problem)].add(file)
        for file,path in self.files.items():
            if path.suffix == '.css':
                for value in css_urls(path.read_text()):
                    problem = self.problem(value,file)
                    if problem:
                        errors[(value,problem)].add(file)
        for url in protected:
            problem = self.problem(url)
            if problem:
                errors[(url,problem)].add('published URL contract')
        for _,target,_ in self.redirects:
            if ':' not in target.removeprefix('https:').removeprefix('http:'):
                problem = self.problem(target)
                if problem:
                    errors[(target,problem)].add('_redirects target')
        return errors

    def public_urls(self):
        return self.redirect_sources | {url for url in self.files if Path(url).suffix.lower() in MEDIA or url.endswith('.html')}


def verify(root):
    protected = json.loads(CONTRACT.read_text())
    site = SiteLinks(root)
    errors = site.errors(protected)
    if errors:
        for (url,reason),sources in sorted(errors.items()):
            print(f'{reason}: {url}\n  '+', '.join(sorted(sources)[:3]),file=sys.stderr)
        raise SystemExit(f'FAIL: {len(errors)} broken local URL/fragment targets')
    new = site.public_urls()-set(protected)
    if new:
        raise SystemExit('New public URLs need recording before deployment: '+', '.join(sorted(new)[:3])+
                         '\nRun python3 scripts/check_links.py '+str(root)+' --record, then review the fixture diff.')
    print(f'PASS: local links and fragments across {sum(url.endswith(".html") for url in site.pages)} HTML pages; {len(protected)} protected public URLs')


if __name__ == '__main__':
    root = Path(sys.argv[1] if len(sys.argv)>1 else '_site').resolve()
    if '--record' in sys.argv:
        existing = set(json.loads(CONTRACT.read_text())) if CONTRACT.exists() else set()
        CONTRACT.write_text(json.dumps(sorted(existing | SiteLinks(root).public_urls()),indent=2,ensure_ascii=False)+'\n')
        print('Recorded public URLs without removing historical entries.')
    verify(root)
