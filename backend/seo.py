"""IndexNow: instantly notify Bing (and Yandex) of new/updated URLs so they get
crawled in minutes instead of waiting weeks for an organic crawl.

Bing's index powers ChatGPT Search, so IndexNow is the fastest path to getting
fresh content into AI answer engines. Google doesn't use IndexNow yet - for
Google, submit the sitemap in Search Console (a one-time manual step).

The verification key file must be served at https://<host>/<KEY>.txt
(see frontend/public/168192734dec6e59c9935fbb368613fd.txt).
"""
import os
import logging

import requests

logger = logging.getLogger("seo")

SITE_HOST = os.environ.get("SITE_HOST", "24hourclipping.com").strip()
INDEXNOW_KEY = os.environ.get("INDEXNOW_KEY", "168192734dec6e59c9935fbb368613fd").strip()
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"


def core_urls() -> list:
    base = f"https://{SITE_HOST}"
    return [f"{base}/", f"{base}/marketplace", f"{base}/clippers",
            f"{base}/docs", f"{base}/blog", f"{base}/wishlist"]


def ping_indexnow(urls: list) -> bool:
    """Submit URLs to IndexNow (blocking - call via asyncio.to_thread)."""
    urls = [u for u in (urls or []) if u]
    if not INDEXNOW_KEY or not urls:
        return False
    payload = {
        "host": SITE_HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{SITE_HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls[:10000],
    }
    try:
        r = requests.post(INDEXNOW_ENDPOINT, json=payload, timeout=10)
        logger.info("indexnow: submitted %d url(s) -> HTTP %s", len(urls), r.status_code)
        return r.status_code in (200, 202)
    except Exception as e:
        logger.warning("indexnow submit failed: %s", e)
        return False
