# Downloads club crests from Wikipedia/Commons into assets/logos + manifest.json. Run ONLY when Max explicitly asks (CLAUDE.md).
# Usage: python -I tools/fetch_logos.py   (edit FILES for other teams)
import json, urllib.request, urllib.parse, sys, datetime, os
UA = {'User-Agent': 'MarbleFootballLocal/1.0 (personal offline project)'}
FILES = {
 'psg': 'Paris_Saint-Germain_F.C..svg', 'barcelona': 'FC_Barcelona_(crest).svg', 'aston_villa': 'Aston Villa FC new crest.svg',
 'liverpool': 'Liverpool FC.svg', 'real_madrid': 'Real Madrid CF.svg', 'sporting': 'Sporting Clube de Portugal logo (2026).svg',
 'real_betis': 'Real Betis 2022 logo.svg', 'bayern': 'FC_Bayern_München_logo_(2024).svg', 'arsenal': 'Arsenal FC.svg',
 'stuttgart': 'VfB_Stuttgart_1893_Logo.svg', 'como': 'Calcio_Como_-_logo_(Italy,_2019-).svg', 'man_city': 'Manchester City FC badge.svg',
 'club_brugge': 'Club_Brugge_KV_logo.svg', 'inter': 'FC_Internazionale_Milano_2021.svg', 'lask': 'LASK-Logo_2023.svg', 'dortmund': 'Borussia_Dortmund_logo.svg'}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
out = {}
titles = '|'.join('File:' + f for f in FILES.values())
q = 'https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 512, 'titles': titles, 'format': 'json'})
d = json.loads(get(q))
norm = {n['from']: n['to'] for n in d['query'].get('normalized', [])}
pages = {p['title']: p for p in d['query']['pages'].values()}
for tid, f in FILES.items():
    t = norm.get('File:' + f, 'File:' + f)
    p = pages.get(t)
    if not p or 'imageinfo' not in p: print('MISSING', tid, t); continue
    ii = p['imageinfo'][0]; md = ii.get('extmetadata', {})
    png = get(ii['thumburl'])
    open(f'assets/logos/{tid}.png', 'wb').write(png)
    out[tid] = {'file': f'{tid}.png', 'source_url': ii['descriptionurl'], 'download_url': ii['thumburl'],
        'retrieved': datetime.date.today().isoformat(),
        'licence': md.get('LicenseShortName', {}).get('value', 'unknown'),
        'note': ('Hosted on Wikimedia Commons; ' if '/commons/' in ii['url'] else 'Non-free file on English Wikipedia (fair-use rationale for the article only); ') + 'club crest is a trademark of the club. Usage risk accepted by Max (decision 2026-11-04).'}
    print(tid, len(png), out[tid]['licence'], ii['descriptionurl'][:70])
json.dump({'_comment': 'Team crests used ONLY as ball decals (logos_on_balls). Downloaded on Max explicit request in session 2026-11-04.', 'logos': out}, open('assets/logos/manifest.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
