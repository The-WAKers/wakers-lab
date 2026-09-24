#!/usr/bin/env python3
"""Refresh content/publications.json from PubMed (NCBI E-utilities).

Run by .github/workflows/update-publications.yml every Monday, or by hand:
    python scripts/update_publications.py

- Searches PubMed with the query in content/publications-curated.json (settings.pubmedQuery).
- Keeps the topics of papers already on the site; tags new papers by keywords in the title.
- Applies "Topic corrections" (topicOverrides) from content/publications-curated.json.
- Refuses to write if PubMed returns far fewer papers than the site already lists (a sign of an outage).
Standard library only, so the workflow needs no installs.
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBS = os.path.join(ROOT, 'content', 'publications.json')
CURATED = os.path.join(ROOT, 'content', 'publications-curated.json')
EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
EMAIL = os.environ.get('NCBI_EMAIL', '')      # optional, NCBI asks tools to identify themselves
API_KEY = os.environ.get('NCBI_API_KEY', '')  # optional, raises NCBI's rate limit

# Keyword rules for papers the site has not seen before (checked against the lab's research themes).
RULES = [
    ('organoids', r'organoid'),
    ('csc', r'stem[- ]like|cancer stem|stem/progenitor|stem cell|progenitor|tumou?r[- ]initiating|sphere|self-renew|cd133|aldh'),
    ('prostate', r'prostat'),
    ('gu', r'bladder|urothelial|renal cell|kidney cancer|genitourinary|testicular|penile'),
    ('neurogenesis', r'neurogenesis|dentate gyrus|hippocamp'),
    ('neurorepair', r'neural stem|neural progenitor|spinal cord|traumatic brain|stroke|neuroprotect|demyelinat|nerve|ischemi|neurodegenerat'),
    ('neurooncology', r'glioblastoma|glioma|neuroblastoma|medulloblastoma|brain tumou?r|brain cancer|blood-brain barrier|brain metasta'),
    ('therapeutics', r'extract|natural product|repurpos|imipridone|onc2\d\d|thymoquinone|compound|inhibitor|anticancer|anti-cancer|chemotherap|sensitiz|metformin|statin|bisphosphonate|drug|treatment|therap'),
]
SPECIFIC_CANCER = ('organoids', 'csc', 'prostate', 'gu', 'neurooncology')
SPECIFIC_NEURO = ('neurogenesis', 'neurorepair', 'neurooncology')


def topics_for(title):
    t = title.lower()
    out = [k for k, rx in RULES if re.search(rx, t)]
    if not any(k in out for k in SPECIFIC_CANCER) and re.search(r'cancer|carcinoma|tumou?r|leukemia|lymphoma|melanoma|sarcoma|oncolog|neoplas|metasta', t):
        out.append('cancers')
    if not any(k in out for k in SPECIFIC_NEURO) and re.search(r'brain|neur|cognit|memory|depress|anxiety|behavio|pain', t):
        out.append('neuro')
    return out or ['other']


def get(endpoint, params):
    params = dict(params, tool='wakers-site', retmode='json')
    if EMAIL:
        params['email'] = EMAIL
    if API_KEY:
        params['api_key'] = API_KEY
    url = EUTILS + endpoint + '?' + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 + attempt * 5)


def search(query):
    res = get('esearch.fcgi', {'db': 'pubmed', 'term': query, 'retmax': 5000})
    return res['esearchresult']['idlist']


def summaries(pmids):
    out = []
    for i in range(0, len(pmids), 200):
        res = get('esummary.fcgi', {'db': 'pubmed', 'id': ','.join(pmids[i:i + 200])})['result']
        out += [res[u] for u in res.get('uids', []) if u in res and 'error' not in res[u]]
        time.sleep(0.4)
    return out


def item(d, known):
    pmid = str(d['uid'])
    ids = {a.get('idtype'): a.get('value', '') for a in d.get('articleids', [])}
    m = re.match(r'(\d{4})/(\d{2})/(\d{2})', d.get('sortpubdate', ''))
    sort = '-'.join(m.groups()) if m else ''
    y = re.search(r'(19|20)\d\d', d.get('pubdate', '')) or re.search(r'(19|20)\d\d', sort)
    vol, iss, pages = d.get('volume', ''), d.get('issue', ''), d.get('pages', '')
    details = vol + (f'({iss})' if iss else '') + (f':{pages}' if pages else '')
    kinds = [t.lower() for t in d.get('pubtype', [])]
    kind = ('correction' if 'published erratum' in kinds else 'retraction' if 'retraction of publication' in kinds
            else 'review' if any('review' in t for t in kinds) else 'article')
    title = re.sub(r'<[^>]+>', '', d.get('title', '')).strip().rstrip('.')
    old = known.get(pmid, {})
    return {
        'pmid': pmid,
        'title': title,
        'authors': ', '.join(a.get('name', '') for a in d.get('authors', []) if a.get('name')),
        'journal': d.get('source', ''),
        'year': int(y.group(0)) if y else None,
        'details': details,
        'doi': ids.get('doi', ''),
        'pmcid': ids.get('pmc', ''),
        'type': kind,
        'topics': old.get('topics') or topics_for(title),
        'sort': sort,
    }


def main():
    curated = json.load(open(CURATED, encoding='utf-8'))
    query = (curated.get('settings') or {}).get('pubmedQuery')
    if not query:
        sys.exit('No PubMed query in content/publications-curated.json (settings.pubmedQuery).')
    current = json.load(open(PUBS, encoding='utf-8')) if os.path.exists(PUBS) else {'items': []}
    known = {str(p.get('pmid')): p for p in current.get('items', []) if p.get('pmid')}

    pmids = search(query)
    if len(pmids) < 0.8 * len(known):
        sys.exit(f'PubMed returned {len(pmids)} papers but the site lists {len(known)}; not overwriting.')
    items = [item(d, known) for d in summaries(pmids)]
    if len(items) < 0.8 * len(pmids):
        sys.exit(f'Only {len(items)} of {len(pmids)} summaries came back; not overwriting.')

    overrides = {str(o.get('pmid')): o.get('topics') for o in curated.get('topicOverrides', []) if o.get('pmid') and o.get('topics')}
    for p in items:
        if p['pmid'] in overrides:
            p['topics'] = overrides[p['pmid']]
    items.sort(key=lambda p: (p.get('sort') or str(p.get('year') or '')), reverse=True)

    new = {'meta': {'source': 'pubmed', 'query': query, 'complete': True, 'total': len(items), 'updated': date.today().isoformat()},
           'items': items}
    if [p['pmid'] for p in current.get('items', [])] == [p['pmid'] for p in items] and current.get('items') == items:
        print('No changes.')
        return
    with open(PUBS, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(new, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    added = [p['title'] for p in items if p['pmid'] not in known]
    print(f'Wrote {len(items)} papers ({len(added)} new).')
    for t in added:
        print('  +', t)


if __name__ == '__main__':
    main()
