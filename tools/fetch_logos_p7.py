# Downloads the 13 missing Premier League club crests (Max's explicit authorisation, session 2026-11-13).
# Crest file names come from each club's English Wikipedia infobox. Merges into assets/logos/manifest.json.
# Usage: python -I tools/fetch_logos_p7.py [team_id ...]   (run ONLY when Max explicitly asks; CLAUDE.md)
import json, urllib.request, urllib.parse, sys, datetime, re, time
UA = {'User-Agent': 'MarbleFootballLocal/1.0 (personal offline project)'}
ARTICLES = {
 'man_utd': 'Manchester United F.C.', 'brighton': 'Brighton & Hove Albion F.C.', 'brentford': 'Brentford F.C.',
 'chelsea': 'Chelsea F.C.', 'fulham': 'Fulham F.C.', 'newcastle': 'Newcastle United F.C.', 'everton': 'Everton F.C.',
 'leeds': 'Leeds United F.C.', 'nottingham_forest': 'Nottingham Forest F.C.', 'tottenham': 'Tottenham Hotspur F.C.',
 'coventry': 'Coventry City F.C.', 'ipswich': 'Ipswich Town F.C.', 'hull': 'Hull City A.F.C.'}
KNOWN = {  # resolved from the infoboxes on 2026-11-13 (saves API calls)
 'man_utd': 'Manchester United FC crest.svg', 'brighton': 'Brighton and Hove Albion FC crest.svg', 'brentford': 'Brentford FC crest.svg',
 'chelsea': 'Chelsea FC.svg', 'fulham': 'Fulham FC.svg', 'newcastle': 'Newcastle United FC 2026 crest.svg', 'everton': 'Everton FC logo.svg',
 'leeds': 'Leeds United F.C. logo.svg', 'nottingham_forest': 'Nottingham Forest F.C. logo.svg'}
API = 'https://en.wikipedia.org/w/api.php?'
def get(url, tries=4):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(10 * (i + 1))
def infobox_image(article):
    d = json.loads(get(API + urllib.parse.urlencode({'action': 'parse', 'page': article, 'prop': 'wikitext', 'section': 0, 'redirects': 1, 'format': 'json'})))
    m = re.search(r'\|\s*image\s*=\s*(?:\[\[)?(?:File:|Image:)?([^\n|\]]+)', d['parse']['wikitext']['*'])
    return m.group(1).strip() if m else None
ids = sys.argv[1:] or list(ARTICLES)
files = {}
for tid in ids:
    if tid in KNOWN: files[tid] = KNOWN[tid]; continue
    time.sleep(6)
    try: files[tid] = infobox_image(ARTICLES[tid])
    except Exception as e: print('INFOBOX FAIL', tid, e)
    print('infobox', tid, files.get(tid))
files = {k: v for k, v in files.items() if v}
q = API + urllib.parse.urlencode({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 960,
                                  'titles': '|'.join('File:' + f for f in files.values()), 'format': 'json'})
time.sleep(4)
d = json.loads(get(q))
norm = {n['from']: n['to'] for n in d['query'].get('normalized', [])}
pages = {p['title']: p for p in d['query']['pages'].values()}
man = json.load(open('assets/logos/manifest.json', encoding='utf-8'))
ok = []
for tid, f in files.items():
    t = norm.get('File:' + f, 'File:' + f)
    p = pages.get(t)
    if not p or 'imageinfo' not in p: print('MISSING', tid, t); continue
    ii = p['imageinfo'][0]; md = ii.get('extmetadata', {})
    time.sleep(2)
    try: png = get(ii['thumburl'])
    except Exception as e: print('DOWNLOAD FAIL', tid, e); continue
    if png[:8] != b'\x89PNG\r\n\x1a\n': print('NOT PNG', tid); continue
    open(f'assets/logos/{tid}.png', 'wb').write(png)
    man['logos'][tid] = {'file': f'{tid}.png', 'source_url': ii['descriptionurl'], 'download_url': ii['thumburl'],
        'article_url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(ARTICLES[tid].replace(' ', '_')),
        'retrieved': datetime.date.today().isoformat(),
        'licence': re.sub('<[^>]+>', '', md.get('LicenseShortName', {}).get('value', 'unknown')),
        'note': ('Hosted on Wikimedia Commons; ' if '/commons/' in ii['url'] else 'Non-free file on English Wikipedia (fair-use rationale for the article only); ') + 'club crest is a trademark of the club. Downloaded on Max explicit authorisation (session 2026-11-13); usage risk accepted by Max.',
        'kind': 'crest'}
    ok.append(tid); print('OK', tid, len(png), ii['descriptionurl'][:80])
man['_comment'] = man.get('_comment', '') + ' Premier League crests added on Max explicit request in session 2026-11-13.' if 'session 2026-11-13' not in man.get('_comment', '') else man['_comment']
json.dump(man, open('assets/logos/manifest.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('downloaded', len(ok), 'of', len(ids))
