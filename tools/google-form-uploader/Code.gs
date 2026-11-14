/**
 * SWAPO Trust – "Post to website" Google Form
 * -------------------------------------------
 * Kapil ji fills a Google Form on his phone (headline, story, photos) and taps Submit.
 * This script turns the answer into a website post on GitHub, and the website
 * republishes itself in about 2 minutes. He then gets an email with the link
 * and a one-tap WhatsApp share button.
 *
 * Setup (once, in the swapotrust@gmail.com Google account): see SETUP.md
 *   1. Paste this file into a new Apps Script project.
 *   2. Put the GitHub token in Project Settings → Script properties as GITHUB_TOKEN.
 *   3. Edit ALLOWED_EMAILS below, then run setupForm() once.
 *   4. In the form that opens, add one "File upload" question for photos.
 */

// ---- Settings you may edit ------------------------------------------------
var REPO = 'swapotrust/swapotrust';
var BRANCH = 'main';
var SITE_URL = 'https://swapotrust.github.io/swapotrust';
// Only these Google accounts can publish. Add Kapil ji's Gmail here.
var ALLOWED_EMAILS = ['swapotrust@gmail.com'];
// Email that receives a copy of every post and any error
var ADMIN_EMAIL = 'swapotrust@gmail.com';
// ---------------------------------------------------------------------------

var Q = {
  type: 'What are you adding? / क्या जोड़ रहे हैं?',
  title: 'Headline / शीर्षक',
  story: 'Story / विवरण',
  category: 'Category / श्रेणी',
  date: 'Date of the event / कार्यक्रम की तारीख',
  paper: 'Newspaper name (only for clippings) / अख़बार का नाम',
  link: 'Online news link (optional) / ऑनलाइन लिंक'
};
var TYPES = {
  news: 'News / Announcement – समाचार / सूचना',
  clipping: 'Newspaper clipping – अख़बार की कतरन',
  photos: 'Photos only (gallery) – केवल फ़ोटो'
};
var CATEGORIES = [
  ['TB Seva – टीबी सेवा', 'tb-seva'], ['Health Camp – स्वास्थ्य शिविर', 'health-camp'],
  ['Blood Donation – रक्तदान', 'blood-donation'], ['Anaemia Check – एनीमिया जाँच', 'anaemia-check'],
  ['Water / Pyau – जल सेवा', 'water-seva'], ['Plantation – वृक्षारोपण', 'plantation'],
  ['Food Seva – भोजन सेवा', 'food'], ['Winter Relief – शीत राहत', 'winter-relief'],
  ['Kanya Vivah – कन्या विवाह', 'girls-marriage'], ['Elders, Ashram & Children – वृद्ध एवं बाल सेवा', 'elderly-orphans'],
  ['Gau Seva – गौ सेवा', 'gau-seva'], ['Education – शिक्षा', 'education'],
  ['Yoga & Culture – योग एवं संस्कृति', 'spiritual'], ['Public Issues – जनहित', 'public-issues'],
  ['Announcement – सूचना', 'announcement'], ['Other – अन्य', 'other']
];

/** Run once. Creates the form and connects it to this script. */
function setupForm() {
  var form = FormApp.create('SWAPO – Post to website / वेबसाइट पर डालें');
  form.setDescription('भरें, फ़ोटो जोड़ें और Submit दबाएँ। 2 मिनट में वेबसाइट पर दिखेगा और लिंक ईमेल पर आएगा।\n' +
    'Fill in, add photos and tap Submit. It appears on the website in about 2 minutes and the link comes to your email.');
  try { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); } catch (err) { form.setCollectEmail(true); }
  form.setConfirmationMessage('धन्यवाद! 2 मिनट में वेबसाइट पर दिखेगा। लिंक आपके ईमेल पर आ रहा है।\nThank you! It will be on the website in about 2 minutes. The link is on its way to your email.');
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(true);

  form.addMultipleChoiceItem().setTitle(Q.type)
    .setChoiceValues([TYPES.news, TYPES.clipping, TYPES.photos]).setRequired(true);
  form.addTextItem().setTitle(Q.title)
    .setHelpText('जैसे: टीबी मरीज़ों को पोषण पोटली वितरित. For photos only, this becomes the caption.').setRequired(true);
  form.addParagraphTextItem().setTitle(Q.story)
    .setHelpText('पूरा समाचार यहाँ लिखें या पेस्ट करें (हिंदी या अंग्रेज़ी)। Optional for clippings and photos.');
  form.addListItem().setTitle(Q.category)
    .setChoiceValues(CATEGORIES.map(function (c) { return c[0]; }));
  form.addDateItem().setTitle(Q.date).setHelpText('खाली छोड़ें तो आज की तारीख लगेगी। Leave empty for today.');
  form.addTextItem().setTitle(Q.paper).setHelpText('जैसे: अमर उजाला, दैनिक जागरण, जनसंदेश टाइम्स');
  form.addTextItem().setTitle(Q.link);

  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
  Logger.log('Form created.');
  Logger.log('EDIT the form here (add the Photos question): ' + form.getEditUrl());
  Logger.log('SEND this link to Kapil ji: ' + form.getPublishedUrl());
}

/** Checks the GitHub token. Run after saving GITHUB_TOKEN. */
function testConnection() {
  var res = gh_('GET', '/repos/' + REPO);
  Logger.log('Connected to ' + res.full_name + '. Can push: ' + (res.permissions && res.permissions.push));
}

/** Runs automatically on every form submission. */
function onFormSubmit(e) {
  var resp = e.response;
  var email = (resp.getRespondentEmail() || '').toLowerCase();
  try {
    if (ALLOWED_EMAILS.map(function (x) { return x.toLowerCase(); }).indexOf(email) < 0) {
      throw new Error('This Google account is not allowed to publish: ' + (email || 'unknown') +
        '. Add it to ALLOWED_EMAILS in the script.');
    }
    var a = readAnswers_(resp);
    var result = publish_(a);
    notify_(email, true, a, result);
  } catch (err) {
    notify_(email, false, null, { error: String(err && err.stack || err) });
    throw err;
  }
}

function readAnswers_(resp) {
  var a = { fileIds: [] };
  resp.getItemResponses().forEach(function (ir) {
    var item = ir.getItem(), title = item.getTitle(), val = ir.getResponse();
    if (item.getType() === FormApp.ItemType.FILE_UPLOAD) { a.fileIds = a.fileIds.concat(val || []); return; }
    if (title === Q.type) a.type = val;
    else if (title === Q.title) a.title = String(val || '').trim();
    else if (title === Q.story) a.story = String(val || '').trim();
    else if (title === Q.category) a.category = val;
    else if (title === Q.date) a.date = val;           // "YYYY-MM-DD"
    else if (title === Q.paper) a.paper = String(val || '').trim();
    else if (title === Q.link) a.link = String(val || '').trim();
  });
  var now = new Date();
  a.stamp = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd-HHmmss');
  a.day = a.date || Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd');
  a.time = Utilities.formatDate(now, 'Asia/Kolkata', 'HH:mm:ss');
  a.cat = 'other';
  CATEGORIES.forEach(function (c) { if (c[0] === a.category) a.cat = c[1]; });
  return a;
}

function publish_(a) {
  var files = [], slug = a.stamp, photoPaths = [], kind;
  var folder = a.type === TYPES.clipping ? 'press' : (a.type === TYPES.photos ? 'gallery' : 'news');
  a.fileIds.forEach(function (id, i) {
    var bytes = imageBytes_(id);
    var rel = 'uploads/' + folder + '/' + slug + '-' + (i + 1) + '.jpg';
    files.push({ path: 'static/' + rel, bytes: bytes });
    photoPaths.push('/' + rel);
  });

  var q = function (s) { return JSON.stringify(String(s || '')); };   // safe YAML string
  var link;
  if (a.type === TYPES.clipping) {
    kind = 'clipping';
    var shots = photoPaths.length ? photoPaths : [''];
    shots.forEach(function (ph, i) {
      var md = '---\nnewspaper: ' + q(a.paper || 'Local newspaper') + '\nheadline: ' + q(a.title) +
        '\ndate: ' + q(a.day) + (ph ? '\nclipping: ' + q(ph) : '') + (a.link ? '\nlink: ' + q(a.link) : '') +
        '\n---\n' + (a.story || '') + '\n';
      files.push({ path: 'content/press/' + slug + '-' + (i + 1) + '.md', text: md });
    });
    link = SITE_URL + '/samachar/in-the-news/';
  } else if (a.type === TYPES.photos) {
    kind = 'photos';
    if (!photoPaths.length) throw new Error('No photos were attached.');
    var g = '---\ncaption: ' + q(a.title) + '\ndate: ' + q(a.day) + '\nphotos:\n' +
      photoPaths.map(function (p) { return '  - ' + q(p); }).join('\n') + '\n---\n';
    files.push({ path: 'content/gallery/' + slug + '.md', text: g });
    link = SITE_URL + '/samachar/gallery/';
  } else {
    kind = 'news';
    var n = '---\ntitle: ' + q(a.title) + '\ndate: ' + q(a.day + 'T' + a.time + '+05:30') +
      '\ncategory: ' + q(a.cat) + '\nlead: false\nphotos:' +
      (photoPaths.length ? '\n' + photoPaths.map(function (p) { return '  - ' + q(p); }).join('\n') : ' []') +
      '\n---\n' + (a.story || '') + (a.link ? '\n\n[' + a.link + '](' + a.link + ')' : '') + '\n';
    files.push({ path: 'content/news/' + slug + '.md', text: n });
    link = SITE_URL + '/samachar/' + slug + '/';
  }
  commit_(files, 'Post from Google Form: ' + a.title);
  return { link: link, kind: kind, photos: photoPaths.length };
}

/** Gets a phone photo as a website-sized JPEG (about 1600 px) using Drive's own resizer. */
function imageBytes_(fileId) {
  var token = ScriptApp.getOAuthToken();
  for (var tries = 0; tries < 6; tries++) {
    var meta = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink',
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (meta.getResponseCode() === 200) {
      var tl = JSON.parse(meta.getContentText()).thumbnailLink;
      if (tl) {
        var big = UrlFetchApp.fetch(tl.replace(/=s\d+$/, '=s1600'),
          { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
        if (big.getResponseCode() === 200 && big.getBlob().getBytes().length > 20000) return big.getBlob().getBytes();
      }
    }
    Utilities.sleep(4000);   // Drive needs a few seconds to prepare the preview of a new upload
  }
  var blob = DriveApp.getFileById(fileId).getBlob();
  if (blob.getBytes().length > 6 * 1024 * 1024) throw new Error('A photo is too large (over 6 MB) and could not be resized.');
  return blob.getBytes();
}

/** One commit with all files (Git Data API). */
function commit_(files, message) {
  var ref = gh_('GET', '/repos/' + REPO + '/git/ref/heads/' + BRANCH);
  var parent = ref.object.sha;
  var baseTree = gh_('GET', '/repos/' + REPO + '/git/commits/' + parent).tree.sha;
  var tree = files.map(function (f) {
    var b64 = f.bytes ? Utilities.base64Encode(f.bytes) : Utilities.base64Encode(f.text, Utilities.Charset.UTF_8);
    var blob = gh_('POST', '/repos/' + REPO + '/git/blobs', { content: b64, encoding: 'base64' });
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
  });
  var newTree = gh_('POST', '/repos/' + REPO + '/git/trees', { base_tree: baseTree, tree: tree });
  var c = gh_('POST', '/repos/' + REPO + '/git/commits', { message: message, tree: newTree.sha, parents: [parent] });
  gh_('PATCH', '/repos/' + REPO + '/git/refs/heads/' + BRANCH, { sha: c.sha });
}

function gh_(method, path, body) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN is missing in Project Settings → Script properties.');
  var opts = {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  };
  if (body) opts.payload = JSON.stringify(body);
  var r = UrlFetchApp.fetch('https://api.github.com' + path, opts);
  if (r.getResponseCode() >= 300) throw new Error('GitHub ' + method + ' ' + path + ' → ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}

function notify_(email, ok, a, result) {
  var to = [email, ADMIN_EMAIL].filter(function (x, i, arr) { return x && arr.indexOf(x) === i; }).join(',');
  if (!to) return;
  if (ok) {
    var wa = 'https://wa.me/?text=' + encodeURIComponent(a.title + ' – ' + result.link);
    MailApp.sendEmail({
      to: to,
      subject: 'वेबसाइट पर प्रकाशित: ' + a.title,
      htmlBody: '<p>नमस्ते! आपका ' + (result.kind === 'news' ? 'समाचार' : result.kind === 'clipping' ? 'अख़बार की कतरन' : 'फ़ोटो') +
        ' 2 मिनट में वेबसाइट पर दिखेगा।<br>Your post will be live in about 2 minutes.</p>' +
        '<p><a href="' + result.link + '">' + result.link + '</a></p>' +
        '<p><a href="' + wa + '" style="background:#25D366;color:#fff;padding:10px 16px;border-radius:20px;text-decoration:none">व्हाट्सऐप पर साझा करें / Share on WhatsApp</a></p>' +
        '<p style="color:#888">' + result.photos + ' photo(s) added.</p>'
    });
  } else {
    MailApp.sendEmail({ to: to, subject: 'वेबसाइट पर प्रकाशित नहीं हो सका / Post failed',
      body: 'Something went wrong, nothing was published. Please forward this email to Kavya.\n\n' + result.error });
  }
}
