# "Post to website" Google Form: one-time setup

Kapil ji opens one Google Form link on his phone, types a headline, adds photos and taps **Submit**.
About 2 minutes later the post is on the website, and an email arrives with the link and a WhatsApp share button.

The form can post three kinds of things:
- **News / Announcement:** goes to SWAPO Samachar (and that month's Monthly Edition)
- **Newspaper clipping:** goes to In the News
- **Photos only:** go to the photo gallery and the running gallery on the home page

Setup takes about 15 minutes and is done once, signed in as **swapotrust@gmail.com**.

## 1. Make a GitHub key (on a computer)
1. Sign in to github.com as `kavyaagrawal-02`.
2. Profile photo → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Token name: `SWAPO form`. Expiration: the longest offered (set a reminder to renew it).
4. Resource owner: **swapotrust**. Repository access: **Only select repositories** → `swapotrust`.
5. Permissions → Repository permissions → **Contents: Read and write**.
6. **Generate token** and copy it (starts with `github_pat_`). If GitHub says the organisation must approve it, open github.com/organizations/swapotrust/settings/personal-access-tokens and approve it.

## 2. Create the script
1. Signed in as swapotrust@gmail.com, open **script.google.com** → **New project**. Rename it `SWAPO website poster`.
2. Delete what is in `Code.gs` and paste the whole of `Code.gs` from this folder.
3. In the line `var ALLOWED_EMAILS = ['swapotrust@gmail.com'];`, add Kapil ji's Gmail, e.g. `['swapotrust@gmail.com', 'kapil@gmail.com']`. Save.
4. Left bar → **Project Settings** (gear) → **Script properties** → **Add script property**: name `GITHUB_TOKEN`, value = the token. Save.
5. Back in the editor, choose `testConnection` in the function menu and click **Run**. Allow the permissions it asks for (Advanced → Go to project → Allow). The log should say `Can push: true`.
6. Choose `setupForm` and click **Run**. The log shows two links: one to edit the form, one to send to Kapil ji.

## 3. Add the photo question (Google does not let scripts add this one)
1. Open the **edit** link from the log.
2. Click **+** (add question) → change the type to **File upload** → Continue.
3. Title: `Photos / फ़ोटो`. Allow only specific file types → **Image**. Maximum number of files: **10**. Maximum file size: **10 MB**.
4. If Forms asks, click **Continue** to let uploads go to the swapotrust Google Drive.

## 4. Give it to Kapil ji
1. Send him the **published** link on WhatsApp.
2. On his phone: open it in Chrome → ⋮ menu → **Add to Home screen**. Name it `SWAPO Post`.
3. He must be signed in to Google with the Gmail you added in step 2.3.
4. Do one test post together, then delete it if needed (see below).

## Fixing or removing a post
Posts are files in the GitHub repository:
- News: `content/news/` · Clippings: `content/press/` · Gallery: `content/gallery/`
- Edit or delete the file on github.com (open it → pencil to edit, or ⋯ → Delete file). The site updates in 2 minutes.
- Or use the full editor at `/admin/`.

## If something goes wrong
- An error email goes to Kapil ji and swapotrust@gmail.com, and nothing is published.
- "not allowed to publish": add that Gmail to `ALLOWED_EMAILS`.
- "GitHub ... 401": the token has expired. Make a new one (step 1) and replace `GITHUB_TOKEN`.
