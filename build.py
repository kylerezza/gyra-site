#!/usr/bin/env python3
"""Builds the gyra.io static site into docs/ (for GitHub Pages or any static host).

Run:  python3 build.py            -> docs/
      python3 build.py --preview  -> preview/ (gitignored) with placeholder apps, to see the catch grow
Standard library only.
"""
from __future__ import annotations

import html
import shutil
import sys
from pathlib import Path

SITE = "gyra"
DOMAIN = "gyra.io"
PUBLISHER = "Yucel Sanli"
# TODO(owner): make this address receive mail (email forwarding on the domain).
EMAIL = "hello@gyra.io"
EFFECTIVE_DATE = "November 11, 2026"
APPLE_EULA = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"

# Released apps only. This repo may be public: never list an unreleased app here.
# colour: the icon swatch until a real icon file exists. store: App Store URL once live.
APPS: list[dict] = []

PREVIEW = "--preview" in sys.argv
if PREVIEW:
    APPS = [
        {"slug": "sample-one", "name": "Sample One", "kind": "Game", "line": "A placeholder app to preview the catch.", "colour": "#c8a574", "store": None},
        {"slug": "sample-two", "name": "Sample Two", "kind": "Utility", "line": "Another stand-in, never published.", "colour": "#5d7d6c", "store": None},
        {"slug": "sample-three", "name": "Sample Three", "kind": "Game", "line": "Shows how three gifts sit together.", "colour": "#b5641f", "store": None},
    ]

ROOT = Path(__file__).resolve().parent
OUT = ROOT / ("preview" if PREVIEW else "docs")
STATIC = ROOT / "static"
e = html.escape

MARK = ('<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27c-6.1 0-11-4.5-11-10.2C5 11 9.6 6.5 15.5 6.5c5 0 8.9 3.6 8.9 8.2 '
        '0 3.9-3.1 6.9-7.1 6.9-3.2 0-5.6-2.3-5.6-5.2 0-2.4 1.9-4.2 4.3-4.2" fill="none" stroke="currentColor" stroke-width="3.2" '
        'stroke-linecap="round"/><path d="M21.5 6.8 24 2.6l1.6 5.2zM16.6 6.3l1.3-4.4 2.6 4.6z" fill="currentColor"/></svg>')
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231a1714'/%3E"
           "%3Cpath d='M16 27c-6.1 0-11-4.5-11-10.2C5 11 9.6 6.5 15.5 6.5c5 0 8.9 3.6 8.9 8.2 0 3.9-3.1 6.9-7.1 6.9-3.2 0-5.6-2.3-5.6-5.2 0-2.4 1.9-4.2 4.3-4.2' "
           "fill='none' stroke='%23c8a574' stroke-width='3.2' stroke-linecap='round'/%3E%3C/svg%3E")
DESCRIPTION = "gyra is a one-person studio making small, finished apps for iPhone. Named for the deadliest cat."
TAIL = ('<svg class="tail" viewBox="0 0 34 92" aria-hidden="true"><path d="M17 0c0 22 2 40-4 58-3 10 2 20 10 26"/>'
        '<path class="ring" d="M16.6 30v.1M15.6 46v.1M12.6 62v.1M22 83.5l.1.1" stroke-width="7.4"/></svg>')


def page(title: str, body: str, depth: int, home: bool = False) -> str:
    up = "../" * depth
    script = f'<script src="{up}cat.js" defer></script>\n' if home else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(DESCRIPTION)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(DESCRIPTION)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#f4efe6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#12141c" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{FAVICON}">
<link rel="stylesheet" href="{up}style.css">
</head>
<body>
<header class="head">
  <a class="mark" href="{up or './'}" aria-label="gyra home">{MARK}gyra</a>
  <nav aria-label="Main"><a href="{up}#catch">Apps</a><a href="{up}support/">Support</a><a href="{up}privacy/">Privacy</a></nav>
</header>
<main{'' if home else ' class="doc"'}>
{body}
</main>
<footer class="foot">
  {TAIL if home else ''}
  <div class="foot-in">
    <nav aria-label="Footer"><a href="{up}privacy/">Privacy</a><a href="{up}terms/">Terms</a><a href="{up}support/">Support</a><a href="mailto:{EMAIL}">{EMAIL}</a></nav>
    <p>&copy; 2026 {e(PUBLISHER)}. Small. Precise. Rarely misses.</p>
  </div>
</footer>
{script}</body>
</html>
"""


def gift(a: dict) -> str:
    href = a["store"] or "#catch"
    return (f'<li><a class="gift" href="{e(href)}" style="--c:{e(a["colour"])}">'
            f'<span class="icon" aria-hidden="true"></span><span><span class="tag">{e(a["kind"])}</span>'
            f'<h3>{e(a["name"])}</h3><p>{e(a["line"])}</p></span></a></li>')


def home() -> str:
    if APPS:
        catch = '<ul class="catch">' + "".join(gift(a) for a in APPS) + "</ul>"
    else:
        catch = ('<div class="empty"><b>Nothing brought home yet.</b>'
                 '<span>The first one is close. She’s patient; she’s also never late twice.</span></div>')
    return f"""
<section class="hero" aria-labelledby="t">
  <p class="def"><b>gyra</b> &nbsp;(guy·ruh) &nbsp;n. &nbsp;the deadliest cat.</p>
  <h1 id="t">Small. Precise. <em>Rarely misses.</em></h1>
  <p class="lede">gyra is a one-person studio making small, finished apps for iPhone. Each one is stalked for a long time and released only when it lands.</p>
</section>

<section class="stage" data-stage aria-label="A black-footed cat hunting on the savanna">
  <canvas aria-hidden="true"></canvas>
</section>
<div class="stage-bar">
  <p class="say" data-say aria-live="polite">She’s on her way.</p>
  <p class="tally" data-tally hidden></p>
</div>
<p class="fact">The black-footed cat is Africa’s smallest wild cat, and its most successful hunter: about 6 hunts in 10 end in a catch. Lions manage about 1 in 4.</p>

<section class="sec" id="catch" aria-labelledby="c">
  <p class="kicker">The catch</p>
  <h2 id="c">What she brought home.</h2>
  <p>Cats bring the people they like the best thing they caught. These are ours.</p>
  {catch}
</section>

<section class="sec" aria-labelledby="h">
  <p class="kicker">How she hunts</p>
  <h2 id="h">Three rules from a very small cat.</h2>
  <div class="rules">
    <div class="rule"><span class="n">01</span><h3>Stay small.</h3><p>One person, a few apps, each doing one thing well. Small is how you get close.</p></div>
    <div class="rule"><span class="n">02</span><h3>Stalk first.</h3><p>Most of the work happens before anyone sees it. Ideas are watched for a long time before the pounce.</p></div>
    <div class="rule"><span class="n">03</span><h3>Land it.</h3><p>Nothing ships half-caught. If it isn’t right yet, it waits.</p></div>
  </div>
</section>
"""


def privacy() -> str:
    return f"""
<h1>Privacy</h1>
<p class="meta">Effective {e(EFFECTIVE_DATE)}</p>
<p>This page covers the gyra.io website, published by {e(PUBLISHER)}. Each gyra app has its own privacy policy, linked from its App Store page and listed here when it is released.</p>
<h2>This website</h2>
<p>gyra.io does not use cookies, analytics, advertising or tracking of any kind, and it loads nothing from other companies’ servers. The cat on the home page runs entirely in your browser and remembers nothing after you leave.</p>
<p>Like every website, the company that hosts the site may keep standard server logs (such as IP address and the page requested) for security and reliability. We don’t use them to identify you.</p>
<h2>Contact</h2>
<p>{e(PUBLISHER)} &middot; <a href="mailto:{EMAIL}">{EMAIL}</a></p>
"""


def support() -> str:
    return f"""
<h1>Support</h1>
<p>Questions, bugs or ideas? Email <a href="mailto:{EMAIL}">{EMAIL}</a>. Tell us which app, your device and iOS version, and what happened. A real person reads every message.</p>
<h2>Purchases and refunds</h2>
<p>Purchases are handled by Apple. To restore one, use <em>Restore Purchases</em> in the app’s settings. Refunds go through <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>.</p>
<h2>Subscriptions</h2>
<p>On iPhone or iPad: Settings › [your name] › Subscriptions.</p>
"""


def terms() -> str:
    return f"""
<h1>Terms of use</h1>
<p>gyra apps are licensed to you under Apple’s standard <a href="{APPLE_EULA}">Licensed Application End User License Agreement</a>. No separate terms apply.</p>
<p>How we handle data is described in our <a href="../privacy/">privacy page</a>.</p>
"""


def not_found() -> str:
    return """
<div class="lost">
  <svg viewBox="0 0 280 120" aria-hidden="true">
    <line x1="10" y1="104" x2="270" y2="104" stroke="currentColor" stroke-opacity=".25"/>
    <g fill="currentColor" opacity=".18"><ellipse cx="96" cy="108" rx="5" ry="2.4"/><ellipse cx="124" cy="110" rx="5" ry="2.4"/><ellipse cx="152" cy="107" rx="5" ry="2.4"/><ellipse cx="180" cy="110" rx="5" ry="2.4"/><ellipse cx="208" cy="107" rx="5" ry="2.4"/></g>
  </svg>
  <h1>She got this one.</h1>
  <p>The page you were after was caught and carried off.</p>
  <p><a class="btn" href="/">Back to the savanna</a></p>
</div>
"""


def write(rel: str, title: str, body: str, home_page: bool = False) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(page(title, body, rel.count("/"), home_page), encoding="utf-8")


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for f in ("style.css", "cat.js"):
        shutil.copy(STATIC / f, OUT / f)
    (OUT / "CNAME").write_text(DOMAIN + "\n")
    (OUT / ".nojekyll").write_text("")
    write("index.html", "gyra · the deadliest cat", home(), True)
    write("privacy/index.html", "Privacy · gyra", privacy())
    write("support/index.html", "Support · gyra", support())
    write("terms/index.html", "Terms · gyra", terms())
    four = page("Not found · gyra", not_found(), 0)
    for a, b in (('href="style.css"', 'href="/style.css"'), ('href="./"', 'href="/"'), ('href="#catch"', 'href="/#catch"'),
                 ('href="support/"', 'href="/support/"'), ('href="privacy/"', 'href="/privacy/"'), ('href="terms/"', 'href="/terms/"')):
        four = four.replace(a, b)
    (OUT / "404.html").write_text(four, encoding="utf-8")
    print(f"Built {sum(1 for _ in OUT.rglob('*.html'))} pages into {OUT}")


if __name__ == "__main__":
    main()
