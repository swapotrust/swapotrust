# SWAPO Trust website

Website of **SWAPO Trust (Regd.) – Social Welfare and Peace Organisation**, Hathras, Uttar Pradesh.
English and Hindi, with the **SWAPO Times** news section and an automatic monthly e-paper.

- Website: https://swapotrust.github.io/swapotrust/
- News editor (phone or computer): https://swapotrust.github.io/swapotrust/admin/

## Posting news (for the Trust)
1. Open the editor link and sign in.
2. Tap **SWAPO Times – News** → **New**.
3. Fill in the headline, category, photos and story. Tap **Save**.
4. The story appears on the website in about 1–2 minutes, and in that month's e-paper automatically.

## Where things live
| What | Where |
|---|---|
| News stories | `content/news/` |
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
