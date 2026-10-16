import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from check_links import SiteLinks


class LinkChecks(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        for name,text in {
            'index.html':'<h1 id="top">Home</h1>',
            'authors/person.html':'<h1 id="bio">Person</h1>',
            'blog/post/index.html':'<h1 id="intro">Article</h1><a href="../../assets/paper%20one.pdf">PDF</a>',
            'assets/paper one.pdf':'%PDF',
            'assets/Photo.JPG':'image',
            'assets/icons.svg':'<svg><symbol id="book"></symbol></svg>',
            '_redirects':'/old/ /blog/post/ 301\n/category/:slug/ /blog/post/#:slug 301\n/old-photo.jpg /assets/Photo.JPG 301\n/away https://example.net/ 301\n',
        }.items():
            path = self.root/name
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(text)
        self.site = SiteLinks(self.root)

    def test_local_resolution_and_fragments(self):
        for url in ['/blog/post/','/blog/post/#intro','/authors/person','/authors/person.html#bio',
                    '/assets/paper%20one.pdf#page=2','/assets/Photo.JPG','/assets/icons.svg#book',
                    'https://www.doctrineofdiscovery.org/blog/post/?utm_source=test#intro']:
            self.assertIsNone(self.site.problem(url),url)
        self.assertFalse(self.site.errors())

    def test_case_and_fragment_errors_are_not_hidden_by_macos(self):
        self.assertIn('case-sensitive',self.site.problem('/assets/photo.jpg'))
        self.assertIn('missing fragment',self.site.problem('/blog/post/#missing'))
        self.assertIn('missing fragment',self.site.problem('/assets/icons.svg#missing'))

    def test_redirects_and_aliases_keep_fragments(self):
        for url in ['/old/#intro','/old-photo.jpg','/category/intro/','/away']:
            self.assertIsNone(self.site.problem(url),url)
        self.assertIn('missing fragment',self.site.problem('/old/#removed'))
        path = self.root/'_redirects'
        path.write_text(path.read_text()+'/loop-a /loop-b 301\n/loop-b /loop-a 301\n')
        self.assertEqual(SiteLinks(self.root).problem('/loop-a'),'redirect loop')

    def test_protected_urls_fail_when_removed(self):
        self.assertTrue(self.site.errors(['/removed.pdf']))
        self.assertFalse(self.site.errors(['/old-photo.jpg']))

    def test_image_metadata_srcset_and_css_links_are_checked(self):
        (self.root/'index.html').write_text('<meta property="og:image" content="/assets/Photo.JPG"><img srcset="/assets/Photo.JPG 1x, /assets/missing.jpg 2x"><style>body{background:url(/assets/missing.png)}</style>')
        errors = SiteLinks(self.root).errors()
        self.assertEqual({url for url,_ in errors},{'/assets/missing.jpg','/assets/missing.png'})

    def test_external_and_dynamic_routes_are_not_filesystem_urls(self):
        for url in ['mailto:contact@example.org','data:image/png;base64,abc','https://example.net/missing','/oai?verb=Identify']:
            self.assertIsNone(self.site.problem(url),url)


if __name__ == '__main__':
    unittest.main()
