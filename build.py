#!/usr/bin/env python3
"""SWAPO Trust static site builder.

Reads content/ (site settings, programmes, news, press) and templates/,
writes the finished website to _site/.

    python build.py            # build for GitHub Pages (pretty URLs)
    python build.py --preview  # build with explicit index.html links (local preview)
"""
import datetime as dt
import html
import os
import re
import shutil
import sys
from collections import OrderedDict

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, "content")
OUT = os.path.join(ROOT, "_site")
PREVIEW = "--preview" in sys.argv
BASE_URL = os.environ.get("SITE_URL", "https://swapotrust.github.io/swapotrust").rstrip("/")
from urllib.parse import urlparse
BASE_PATH = (urlparse(BASE_URL).path.rstrip("/") + "/") or "/"
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))

MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई",
             "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"]


def load_yaml(name):
    with open(os.path.join(CONTENT, name), encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def read_md(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    meta, body = {}, text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            meta = yaml.safe_load(parts[1]) or {}
            body = parts[2]
    return meta, body.strip()


def md(text):
    return markdown.markdown(text or "", extensions=["extra", "nl2br", "sane_lists"])


def plain(text, n=180):
    t = re.sub(r"<[^>]+>", "", md(text))
    t = html.unescape(re.sub(r"\s+", " ", t)).strip()
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def to_date(value):
    if isinstance(value, dt.datetime):
        d = value
    elif isinstance(value, dt.date):
        d = dt.datetime(value.year, value.month, value.day)
    else:
        s = str(value or "").strip().replace("Z", "+00:00")
        try:
            d = dt.datetime.fromisoformat(s)
        except ValueError:
            d = dt.datetime.now(IST)
    if d.tzinfo is None:
        d = d.replace(tzinfo=IST)
    return d.astimezone(IST)


def fmt_date(d, lang):
    if lang == "hi":
        return f"{d.day} {MONTHS_HI[d.month - 1]} {d.year}"
    return d.strftime("%-d %B %Y")


def month_label(key, lang):
    y, m = key.split("-")
    m = int(m)
    if lang == "hi":
        return f"{MONTHS_HI[m - 1]} {y}"
    return f"{dt.date(2000, m, 1).strftime('%B')} {y}"


def slugify(name):
    s = re.sub(r"\.md$", "", name)
    s = re.sub(r"[^a-zA-Z0-9-]+", "-", s).strip("-").lower()
    return s or "post"


def clean_photos(items):
    out = []
    for p in items or []:
        if isinstance(p, dict):
            p = p.get("image") or p.get("src") or ""
        p = str(p or "").strip()
        if p:
            out.append(p.lstrip("/"))
    return out


def load_news(categories):
    folder = os.path.join(CONTENT, "news")
    posts = []
    for name in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
        if not name.endswith(".md"):
            continue
        meta, body = read_md(os.path.join(folder, name))
        if meta.get("draft"):
            continue
        title = str(meta.get("title") or "").strip()
        title_alt = str(meta.get("title_alt") or "").strip()
        body_alt = str(meta.get("body_alt") or "").strip()
        primary = "hi" if DEVANAGARI.search(title + body[:200]) else "en"
        other = "en" if primary == "hi" else "hi"
        text = {primary: (title, body)}
        if title_alt or body_alt:
            text[other] = (title_alt or title, body_alt or body)
        d = to_date(meta.get("date"))
        cat = meta.get("category") or "other"
        cat_info = categories.get(cat, categories["other"])
        slug = slugify(name)
        photos = clean_photos(meta.get("photos"))
        post = {
            "slug": slug,
            "date": d,
            "month": d.strftime("%Y-%m"),
            "category": cat,
            "cat_en": cat_info[0],
            "cat_hi": cat_info[1],
            "pillar": cat_info[2],
            "lead": bool(meta.get("lead")),
            "photos": photos,
            "cover": photos[0] if photos else "",
            "place": str(meta.get("place") or "").strip(),
            "primary": primary,
        }
        for lang in ("en", "hi"):
            t, b = text.get(lang) or text[primary]
            post[f"title_{lang}"] = t
            post[f"body_{lang}"] = md(b)
            post[f"excerpt_{lang}"] = plain(b)
            post[f"date_{lang}"] = fmt_date(d, lang)
            post[f"native_{lang}"] = lang in text
        posts.append(post)
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def load_press():
    folder = os.path.join(CONTENT, "press")
    items = []
    for name in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
        if not name.endswith(".md"):
            continue
        meta, body = read_md(os.path.join(folder, name))
        d = to_date(meta.get("date"))
        items.append({
            "headline": str(meta.get("headline") or "").strip(),
            "newspaper": str(meta.get("newspaper") or "").strip(),
            "image": str(meta.get("clipping") or "").strip().lstrip("/"),
            "link": str(meta.get("link") or "").strip(),
            "date": d,
            "date_en": fmt_date(d, "en"),
            "date_hi": fmt_date(d, "hi"),
            "note": plain(body, 240),
        })
    items.sort(key=lambda p: p["date"], reverse=True)
    return items


class Site:
    def __init__(self):
        self.env = Environment(
            loader=FileSystemLoader(os.path.join(ROOT, "templates")),
            autoescape=select_autoescape(["html"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.pages = []

    def render(self, template, out_path, **ctx):
        depth = out_path.count("/")
        rel = "../" * depth

        def url(path=""):
            path = path.lstrip("/")
            if PREVIEW and (path == "" or path.endswith("/")):
                path += "index.html"
            return (rel + path) or "./"

        def asset(path):
            return rel + path.lstrip("/")

        def absolute(path=""):
            return BASE_URL + "/" + path.lstrip("/")

        canonical = absolute(out_path[: -len("index.html")] if out_path.endswith("index.html") else out_path)
        tpl = self.env.get_template(template)
        out = tpl.render(url=url, asset=asset, absolute=absolute, canonical=canonical, base_path=BASE_PATH,
                         page_path=out_path, **self.ctx, **ctx)
        dest = os.path.join(OUT, out_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(out)
        self.pages.append(canonical)


MONTH_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTH_SHORT_HI = ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस"]

# ring: (start month index, number of months, radius, colour class, label)
WHEEL_RINGS = [
    (0, 12, 70, "w-health"),     # TB nutrition & food – every month
    (3, 3, 95, "w-water"),       # Apr–Jun water tanks & sharbat
    (6, 3, 95, "w-green"),       # Jul–Sep plantation
    (10, 4, 95, "w-relief"),     # Nov–Feb blankets & bonfires
    (0, 12, 120, "w-camp"),      # health camps, blood donation – through the year
]


def _pt(cx, cy, r, deg):
    import math
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def seva_wheel():
    """Inline SVG of the year-round seva calendar."""
    cx = cy = 160
    parts = [f'<svg class="wheel" viewBox="0 0 320 320" role="img" aria-label="Seva calendar">']
    # month spokes + labels
    for i in range(12):
        a0 = -90 + i * 30
        x1, y1 = _pt(cx, cy, 52, a0)
        x2, y2 = _pt(cx, cy, 136, a0)
        parts.append(f'<line class="w-spoke" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
        lx, ly = _pt(cx, cy, 148, a0 + 15)
        parts.append(f'<text class="w-month l-en" x="{lx:.1f}" y="{ly:.1f}">{MONTH_SHORT_EN[i]}</text>')
        parts.append(f'<text class="w-month l-hi" x="{lx:.1f}" y="{ly:.1f}">{MONTH_SHORT_HI[i]}</text>')
    for start, length, r, cls in WHEEL_RINGS:
        if length == 12:
            parts.append(f'<circle class="w-ring {cls}" cx="{cx}" cy="{cy}" r="{r}"/>')
            continue
        a0 = -90 + start * 30 + 2
        a1 = -90 + (start + length) * 30 - 2
        x0, y0 = _pt(cx, cy, r, a0)
        x1, y1 = _pt(cx, cy, r, a1)
        large = 1 if (a1 - a0) > 180 else 0
        parts.append(f'<path class="w-ring {cls}" d="M{x0:.1f} {y0:.1f} A{r} {r} 0 {large} 1 {x1:.1f} {y1:.1f}"/>')
    # today marker
    now = dt.datetime.now(IST)
    deg = -90 + (now.month - 1 + (now.day - 1) / 31) * 30
    tx, ty = _pt(cx, cy, 136, deg)
    ix, iy = _pt(cx, cy, 52, deg)
    parts.append(f'<line class="w-now" x1="{ix:.1f}" y1="{iy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}"/>')
    parts.append(f'<circle class="w-now-dot" cx="{tx:.1f}" cy="{ty:.1f}" r="5"/>')
    parts.append(f'<text class="w-center-big" x="{cx}" y="{cy - 2}">365</text>')
    parts.append(f'<text class="w-center l-en" x="{cx}" y="{cy + 16}">days of seva</text>')
    parts.append(f'<text class="w-center l-hi" x="{cx}" y="{cy + 16}">दिन सेवा</text>')
    parts.append("</svg>")
    return "\n".join(parts)


def months_between(start, now):
    return (now.year - start.year) * 12 + (now.month - start.month) + 1


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(os.path.join(ROOT, "static"), OUT)

    site = load_yaml("site.yml")
    pillars = load_yaml("pillars.yml")
    categories = load_yaml("categories.yml")
    posts = load_news(categories)
    press = load_press()
    now = dt.datetime.now(IST)
    tb_start = to_date(site.get("tb_start") or "2016-07-16")

    months = OrderedDict()
    for p in posts:
        months.setdefault(p["month"], []).append(p)
    epapers = []
    for key, items in months.items():
        lead = next((p for p in items if p["lead"]), items[0])
        rest = [p for p in items if p is not lead]
        epapers.append({"key": key, "label_en": month_label(key, "en"),
                        "label_hi": month_label(key, "hi"), "lead": lead,
                        "rest": rest, "count": len(items)})

    photos = [{"src": ph, "post": p} for p in posts for ph in p["photos"]]
    gallery_cfg = load_yaml("gallery.yml") if os.path.exists(os.path.join(CONTENT, "gallery.yml")) else {}
    reel = []
    for g in (gallery_cfg.get("photos") or []):
        src = str((g or {}).get("image") or "").strip().lstrip("/")
        if src:
            reel.append({"src": src, "cap_en": g.get("caption_en") or "", "cap_hi": g.get("caption_hi") or g.get("caption_en") or "", "href": ""})
    for ph in photos:
        reel.append({"src": ph["src"], "cap_en": ph["post"]["title_en"], "cap_hi": ph["post"]["title_hi"],
                     "href": "times/" + ph["post"]["slug"] + "/"})
    pillar_map = {p["id"]: p for p in pillars}
    reel_ph, depth = [], max(len(p["programmes"]) for p in pillars)
    for i in range(depth):
        for p in pillars:
            if i < len(p["programmes"]):
                reel_ph.append((p, p["programmes"][i]))
    pillar_links = [("work/#" + p["id"], p["title_en"], p["title_hi"]) for p in pillars]

    s = Site()
    s.ctx = dict(site=site, pillars=pillars, pillar_map=pillar_map, posts=posts,
                 press=press, categories=categories, epapers=epapers,
                 photos=photos, reel=reel, reel_ph=reel_ph, pillar_links=pillar_links, year=now.year, tb_start=tb_start.strftime("%Y-%m-%d"),
                 tb_months=months_between(tb_start, now), build_time=now.isoformat(),
                 seva_wheel=Markup(seva_wheel()))

    s.render("home.html", "index.html", active="home")
    s.render("about.html", "about/index.html", active="about")
    s.render("work.html", "work/index.html", active="work")
    s.render("tb.html", "work/tb-nutrition/index.html", active="work")
    s.render("impact.html", "impact/index.html", active="impact")
    s.render("times.html", "times/index.html", active="times")
    for p in posts:
        s.render("post.html", f"times/{p['slug']}/index.html", active="times", post=p,
                 related=[q for q in posts if q is not p][:3])
    s.render("epaper_list.html", "times/epaper/index.html", active="times")
    for e in epapers:
        s.render("epaper.html", f"times/epaper/{e['key']}/index.html", active="times", ep=e)
    s.render("press.html", "times/press/index.html", active="times")
    s.render("gallery.html", "times/gallery/index.html", active="times")
    s.render("involved.html", "get-involved/index.html", active="involved")
    s.render("contact.html", "contact/index.html", active="contact")
    s.render("404.html", "404.html", active="")

    # sitemap + robots
    with open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in s.pages:
            if not u.endswith("404.html"):
                f.write(f"  <url><loc>{html.escape(u)}</loc></url>\n")
        f.write("</urlset>\n")
    with open(os.path.join(OUT, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nDisallow: {BASE_PATH}admin/\nSitemap: {BASE_URL}/sitemap.xml\n")
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    print(f"Built {len(s.pages)} pages, {len(posts)} news posts, {len(epapers)} e-papers -> _site/")


if __name__ == "__main__":
    main()
