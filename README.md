# SWAPO Trust website

Website of **SWAPO Trust (Regd.) – Social Welfare and Peace Organisation**, Hathras, Uttar Pradesh.
English and Hindi, with **SWAPO Samachar** (announcements, In the News, photo gallery) and an automatic monthly edition.

- Website: https://swapotrust.github.io/swapotrust/
- News editor (phone or computer): https://swapotrust.github.io/swapotrust/admin/

## Posting news (for the Trust)
1. Open the editor link and sign in.
2. Tap **SWAPO Samachar – Announcements** → **New**.
3. Fill in the headline, category, photos and story. Tap **Save**.
4. It appears on the website in about 1–2 minutes, and in that month's Monthly Edition automatically.

The editor also manages: In the news, Impact stories, Voices, Home slideshow, Team & branches, Photo gallery, and Website settings (contact, numbers, the running help strip).

## Where things live
| What | Where |
|---|---|
| Announcements | `content/news/` |
| Impact stories | `content/stories.yml` |
| Voices (quotes) | `content/voices.yml` |
| Home slideshow | `content/slides.yml` |
| Team & branches | `content/team.yml` |
| Press clippings | `content/press/` |
| Contact, registration, impact numbers, map places | `content/site.yml` |
| Programmes (6 pillars) | `content/pillars.yml` |
| Page layouts | `templates/` |
| Styles, scripts, images, uploads | `static/` |
| Editor settings | `static/admin/config.yml` |

## How it is built
Every change to `main` runs `.github/workflows/deploy.yml`, which runs `python build.py`
and publishes the result to GitHub Pages. It also rebuilds on the 1st of each month so the
live counters stay current.

Local preview: `pip install markdown pyyaml jinja2`, then `python build.py --preview` and open `_site/index.html`.
