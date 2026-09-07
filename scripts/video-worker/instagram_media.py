"""Public Instagram images and videos. Never load account sessions or login cookies."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse

MAX_BYTES = 157286400


def public_media_url(value):
    url = urlparse(value)
    host = (url.hostname or '').lower()
    if url.scheme != 'https' or url.username or url.password or url.port not in (None, 443) or not any(host.endswith('.' + suffix) for suffix in ('cdninstagram.com', 'fbcdn.net')):
        raise ValueError('Unexpected Instagram media host.')
    return value


def describe_post(post):
    if post.typename == 'GraphSidecar':
        nodes = list(post.get_sidecar_nodes())
        assets = [{'kind': 'video' if node.is_video else 'image', 'url': public_media_url(node.video_url if node.is_video else node.display_url)} for node in nodes]
    else:
        assets = [{'kind': 'video' if post.is_video else 'image', 'url': public_media_url(post.video_url if post.is_video else post.url)}]
    if not 1 <= len(assets) <= 20:
        raise ValueError('Choose a post with between one and twenty items.')
    return assets


def metadata(source_url, folder):
    import instaloader
    match = re.fullmatch(r'/(?:p|reel|tv)/([A-Za-z0-9_-]+)/', urlparse(source_url).path)
    if not match:
        raise ValueError('Unsupported Instagram post.')
    loader = instaloader.Instaloader(quiet=True, max_connection_attempts=1, request_timeout=15)
    post = instaloader.Post.from_shortcode(loader.context, match[1])
    assets = describe_post(post)
    (folder / 'instagram-media.json').write_text(json.dumps(assets), encoding='utf-8')
    return {'platform': 'instagram', 'sourceUrl': source_url, 'postId': post.shortcode,
            'caption': (post.caption or '')[:6000], 'title': '', 'author': post.owner_username[:200],
            'durationSeconds': None}


def download(folder):
    import requests
    assets = json.loads((folder / 'instagram-media.json').read_text(encoding='utf-8'))
    if not 1 <= len(assets) <= 20:
        raise ValueError('Invalid post media count.')
    total = 0
    manifest = []
    for index, asset in enumerate(assets):
        kind = asset['kind']
        if kind not in ('image', 'video'):
            raise ValueError('Unsupported media type.')
        file = f'item-{index}.mp4' if kind == 'video' else f'item-{index}.jpg'
        url = public_media_url(asset['url'])
        # Validate every CDN redirect, stream to disk, and cap the whole post at 150 MB.
        for hop in range(4):
            with requests.get(url, stream=True, timeout=20, allow_redirects=False) as response:
                if response.is_redirect:
                    from urllib.parse import urljoin
                    url = public_media_url(urljoin(url, response.headers['Location']))
                    continue
                response.raise_for_status()
                expected = 'video/' if kind == 'video' else 'image/'
                if not response.headers.get('Content-Type', '').startswith(expected):
                    raise ValueError('Instagram returned unexpected media.')
                with (folder / file).open('wb') as output:
                    for chunk in response.iter_content(65536):
                        total += len(chunk)
                        if total > MAX_BYTES:
                            raise ValueError('This post exceeds 150 MB.')
                        output.write(chunk)
                break
        else:
            raise ValueError('Too many media redirects.')
        if not (folder / file).stat().st_size:
            raise ValueError('Instagram returned an empty media file.')
        manifest.append({'kind': kind, 'file': file})
    (folder / 'media-files.json').write_text(json.dumps(manifest), encoding='utf-8')
