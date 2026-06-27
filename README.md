# Archegon Static Site

A no-build static website for Archegon's AI agentic consulting offer.

## Local preview

Open `index.html` directly in a browser, or run a static server from this folder:

```sh
python3 -m http.server 8080
```

Then visit `http://127.0.0.1:8080`.

## Free hosting options

- Cloudflare Pages: connect a Git repo, set the project root to this folder, no build command, output directory `/`.
- Netlify: drag and drop this folder, or connect a Git repo with no build command.
- GitHub Pages: publish the folder contents from a repository branch.

## DNS note

Keep the Google mail records intact. Only change the website records for `www` and, if required by the host, the apex `archegon.com`.
