import unittest
from types import SimpleNamespace
from instagram_media import describe_post, public_media_url

class InstagramMediaTests(unittest.TestCase):
    def test_photo_and_mixed_carousel(self):
        photo = SimpleNamespace(typename='GraphImage', is_video=False, url='https://scontent.cdninstagram.com/photo.jpg')
        self.assertEqual(describe_post(photo), [{'kind':'image','url':photo.url}])
        nodes = [SimpleNamespace(is_video=False, display_url=photo.url), SimpleNamespace(is_video=True, video_url='https://video.fbcdn.net/clip.mp4')]
        carousel = SimpleNamespace(typename='GraphSidecar', get_sidecar_nodes=lambda: iter(nodes))
        self.assertEqual([a['kind'] for a in describe_post(carousel)], ['image','video'])
    def test_invalid_cdn_and_oversize_carousel(self):
        for url in ['http://cdninstagram.com/a','https://127.0.0.1/a','https://cdninstagram.com.evil.test/a','https://user:pass@scontent.cdninstagram.com/a']:
            with self.assertRaises(ValueError): public_media_url(url)
        post = SimpleNamespace(typename='GraphSidecar', get_sidecar_nodes=lambda: iter([SimpleNamespace(is_video=False, display_url='https://scontent.cdninstagram.com/p.jpg')]*21))
        with self.assertRaises(ValueError): describe_post(post)

if __name__ == '__main__': unittest.main()
