# Archegon Static Site

A no-build static website for Archegon's geothermal AI infrastructure thesis,
with a retained research/blog thread for agentic AI consulting notes.

## Local preview

Open `index.html` directly in a browser, or run a static server from this folder:

```sh
python3 -m http.server 8080
```

Then visit `http://127.0.0.1:8080`.

## QA checks

Run the internal site link check before publishing:

```sh
python3 tools/check_links.py
```

Run the slower external-source audit when updating citations:

```sh
python3 tools/check_links.py --external
```

## Free hosting options

- Cloudflare Pages: connect a Git repo, set the project root to this folder, no build command, output directory `/`.
- Netlify: drag and drop this folder, or connect a Git repo with no build command.
- GitHub Pages: publish the folder contents from a repository branch.

## DNS note

Keep the Google mail records intact. Only change the website records for `www` and, if required by the host, the apex `archegon.com`.

## Launch notes

- Investor-facing language is framed as "register interest" / "get in touch".
- Financial and project material is labelled illustrative and subject to due diligence.
- The New Zealand and Australia downloads are public summaries generalised from source business plans.
- The public evidence page contains working citation anchors for the website claims.
- Local visual assets are credited on the evidence page with source, author, and licence notes.
- Detailed financial models, capital stacks, performance assumptions, and capital requirements should remain in a controlled diligence process after legal review.
- The form uses a mailto fallback until a hosted form provider is configured.
- Plausible is referenced for privacy-friendly analytics; connect the domain in Plausible before relying on dashboard data.
- Review all investor-facing language with a solicitor familiar with financial-promotion rules before broad launch.
