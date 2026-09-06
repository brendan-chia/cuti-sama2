"""Provider adaptation ends here: both extractors return the same post metadata."""
import json
import sys
from pathlib import Path
from yt_dlp import YoutubeDL

action, platform, source_url, directory = sys.argv[1:]
folder = Path(directory).resolve()
folder.mkdir(parents=True, exist_ok=True)
info_file = folder / 'source-info.json'

class QuietLogger:
    def debug(self, message): pass
    def warning(self, message): pass
    def error(self, message): pass

options = {
    'logger': QuietLogger(), 'noplaylist': True,
    'allowed_extractors': ['Instagram'] if platform == 'instagram' else ['TikTok', 'TikTokVM'],
    'socket_timeout': 15, 'retries': 1, 'max_filesize': 157286400,
    'format': 'best[ext=mp4]/best', 'outtmpl': str(folder / 'video.mp4'),
    'overwrites': True,
}
try:
    with YoutubeDL(options) as downloader:
        if action == 'metadata':
            info = downloader.extract_info(source_url, download=False)
            if not info or info.get('_type') in ('playlist', 'multi_video'):
                raise ValueError('Use a link to one video, not a carousel or profile.')
            if info.get('duration') and info['duration'] > 120.1:
                raise ValueError('This video is longer than the two-minute limit.')
            info_file.write_text(json.dumps(downloader.sanitize_info(info)), encoding='utf-8')
            print(json.dumps({
                'platform': platform, 'sourceUrl': source_url,
                'postId': str(info.get('id') or '')[:150],
                'caption': str(info.get('description') or '')[:6000],
                'title': str(info.get('title') or '')[:500],
                'author': str(info.get('uploader') or '')[:200],
                'durationSeconds': info.get('duration'),
            }))
        elif action == 'download':
            downloader.download_with_info_file(str(info_file))
        else:
            raise ValueError('Unknown ingestion action.')
except Exception:
    # Extractor errors can include signed CDN URLs. Keep them out of app/log output.
    print('The platform did not provide a downloadable public video, or it exceeds the two-minute limit. Please check the link and retry.', file=sys.stderr)
    sys.exit(1)
