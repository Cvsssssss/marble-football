# P3: downloads the MARBLE CONTINENTAL club crests and the national flags into assets/logos and MERGES them into
# assets/logos/manifest.json. Run ONLY when Max explicitly asks (CLAUDE.md; Max asked "Caută tu pe web" on 2026-11-04).
# Usage: python -I tools/fetch_logos_p3.py
import json, urllib.request, urllib.parse, sys, datetime, os, time
sys.stdout.reconfigure(encoding='utf-8')
UA = {'User-Agent': 'MarbleFootballLocal/1.0 (personal offline project)'}
CRESTS = {
 'benfica': 'SL Benfica logo.svg', 'leverkusen': 'Bayer 04 Leverkusen logo.svg', 'bournemouth': 'AFC Bournemouth (2013).svg',
 'ferencvaros': 'Ferencvarosi TC.svg', 'olympiacos': 'Olympiacos FC crest.svg', 'union_sg': 'Royale Union Saint-Gilloise logo.svg',
 'juventus': 'Juventus FC - logo black (Italy, 2020).svg', 'besiktas': 'BesiktasJK-Logo.svg', 'sunderland': 'Logo Sunderland.svg',
 'az': 'AZ Alkmaar.svg', 'omonia': 'AC Omonia logo.svg', 'lyon': 'Olympique Lyonnais logo.svg', 'rennes': 'Stade Rennais FC.svg',
 'real_sociedad': 'Real Sociedad logo.svg', 'crystal_palace': 'Crystal Palace FC logo (2022).svg', 'sparta_praha': 'AC-Sparta-LOGO2021.svg'}
FLAGS = json.load(open('build/flag_files.json', encoding='utf-8'))
MAN = 'assets/logos/manifest.json'
man = json.load(open(MAN, encoding='utf-8'))
def get(url):
    for i in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(8 * (i + 1))
    raise RuntimeError('rate limited: ' + url)
def fetch(files, kind):
    titles = '|'.join('File:' + f for f in files.values())
    q = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 512, 'titles': titles, 'format': 'json'})
    d = json.loads(get(q))
    norm = {n['from']: n['to'] for n in d['query'].get('normalized', [])}
    pages = {p['title']: p for p in d['query']['pages'].values()}
    for tid, f in files.items():
        t = norm.get('File:' + f, 'File:' + f)
        p = pages.get(t)
        if not p or 'imageinfo' not in p: print('MISSING', tid, t); continue
        ii = p['imageinfo'][0]; md = ii.get('extmetadata', {})
        png = get(ii['thumburl']); time.sleep(1.5)
        open(f'assets/logos/{tid}.png', 'wb').write(png)
        commons = '/commons/' in ii['url']
        if kind == 'flag':
            note = 'National flag (Wikimedia Commons, public domain / free licence). National teams may show flags (CLAUDE.md).'
        else:
            note = ('Hosted on Wikimedia Commons; ' if commons else 'Non-free file on English Wikipedia (fair-use rationale for the article only); ') + 'club crest is a trademark of the club. Usage risk accepted by Max (decision 2026-11-04).'
        man['logos'][tid] = {'file': f'{tid}.png', 'kind': kind, 'source_url': ii['descriptionurl'], 'download_url': ii['thumburl'],
            'retrieved': datetime.date.today().isoformat(), 'licence': md.get('LicenseShortName', {}).get('value', 'unknown'), 'note': note}
        print(kind, tid, len(png), man['logos'][tid]['licence'])
fetch(CRESTS, 'crest')
time.sleep(3)
fetch(FLAGS, 'flag')
for k, v in man['logos'].items(): v.setdefault('kind', 'crest')
man['_comment'] = 'Team crests (clubs) and flags (national teams) used ONLY as ball decals (logos_on_balls). Downloaded on Max explicit request in session 2026-11-04.'
json.dump(man, open(MAN, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('manifest entries', len(man['logos']))
