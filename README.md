# The WAKers website

The website of the Abou-Kheir lab (The WAKers), Department of Anatomy, Cell Biology and Physiological Sciences, American University of Beirut.

It is a static site: GitHub Pages hosts it for free, Pages CMS gives lab members a point-and-click editor, and a weekly GitHub Action refreshes the publication list from PubMed.

## What is where

| Folder or file | What it holds |
|---|---|
| `content/*.json` | Everything the site says: team, alumni, news, gallery, spotlight, research, join page, site settings |
| `content/publications.json` | The paper list. Written by the PubMed updater; don't edit by hand |
| `content/publications-curated.json` | Highlighted papers, hidden papers, topic corrections, the PubMed query |
| `media/` | Photos and micrographs (`team/`, `lab/`, `micro/`) |
| `assets/` | Styles, scripts, logo, map data. Only a developer needs these |
| `index.html`, `team/`, `research/`, … | Page shells. They load their content from `content/` |
| `.pages.yml` | Tells Pages CMS which fields to show |
| `scripts/update_publications.py`, `setup/update-publications.yml` | The weekly PubMed refresh (see Publications below) |

## Publish it (once)

1. Create a GitHub organization for the lab (for example `wakers-lab`), so the site doesn't belong to one person. Add at least two lab members as owners.
2. In that organization, create a **public** repository named exactly `wakers-lab.github.io` (your organization's name followed by `.github.io`).
3. On the new repository's page, choose **Add file → Upload files** and drag in **everything inside this folder** (not the folder itself). Commit.
4. Go to **Settings → Pages**. Under *Build and deployment*, set *Source* to **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
5. After a minute or two the site is live at `https://wakers-lab.github.io`.
6. Turn on the weekly PubMed refresh: open the **Actions** tab, choose **set up a workflow yourself**, name the file `update-publications.yml`, replace the editor's contents with the contents of `setup/update-publications.yml`, and commit. (Workflow files have to be created on GitHub like this rather than uploaded from a computer folder.)

If you use a different repository name, the site lives at `https://NAME.github.io/REPO/`. Everything works there too, except the "page not found" screen: open `404.html` and change each root `/` it names to `/REPO/`.

## Edit it (every day)

1. Go to <https://app.pagescms.org> and sign in with GitHub.
2. Install the Pages CMS GitHub app on the lab's organization and select this repository.
3. Open the repository. The menu shows News, Team, Alumni, Student spotlight, Gallery, Publication highlights, Join us, Site settings and Research.
4. Edit, then save. Each save is a commit, and GitHub Pages republishes within a minute or two.

Lab members without GitHub accounts can be invited by email from Pages CMS (collaborators). They can edit content and media but not the configuration.

### Tips

- **Photos:** upload through the image fields. Headshots look best roughly square; lab photos around 1800 px wide.
- **Alumni map:** the map finds most cities by name. If an alumnus doesn't get a dot, fill in latitude and longitude for them.
- **Dates in News:** `2026`, `2026-05` or `2026-05-20`. Newest items appear first and the three newest show on the home page.
- **Topics on publications:** fix a paper's topics under Publication highlights → Topic corrections. The next PubMed refresh applies them.

## Publications

Once step 6 above is done, the workflow runs every Monday. It searches PubMed with the query in `content/publications-curated.json`, keeps the topics of papers already listed, tags new papers by keywords, and commits the new list. To run it right away: **Actions → Update publications from PubMed → Run workflow**.

If the run fails with a permissions error, go to **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**.

## Your own address (optional)

To use an address like `wakerslab.org`, buy the domain from any registrar (around 10–15 USD a year), enter it under **Settings → Pages → Custom domain**, and add the DNS records GitHub shows you. Tick **Enforce HTTPS** once it appears.
