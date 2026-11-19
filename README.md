# Turo website

A static English and Arabic website for course/book requests through Telegram.

## Open locally

Open `index.html` or `ar/index.html`. No installation is required. Google Fonts and Telegram need an internet connection; local font fallbacks are supplied.

## Edit and check

Shared copy and categories: `content.js`. Page structure: `templates/page.html`. Styles: `styles.css`. Request behavior: `script.js`.

With Node.js 22 or newer:

```sh
node scripts/build-pages.cjs
npm test
npm run build
```

No npm dependencies need installing. `npm test` checks source assets, language content, accessibility references, contrast and inquiry behavior in a minimal DOM fixture. It does not render the website or verify real device/Telegram behavior.

`npm run build` generates and checks the pages, then prepares a clean `dist/` directory containing only public website files. Design prompts, audit notes, logo source fonts and build scripts are kept out of that folder.

## Repository and hosting

The GitHub workflow performs checks on pushes and pull requests; it does not publish anything. A GitHub repository can hold the code while a separate static hosting provider serves the website.

GitHub Pages restricts sites primarily directed at facilitating commercial transactions. This paid-request landing page should use a suitable business host instead. See [GitHub Pages usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

When a real public URL is known, set it before building:

```sh
node scripts/build-pages.cjs --origin https://your-real-domain/
npm run build
```

Or supply the `SITE_ORIGIN` environment variable to the build. A repository subdirectory is supported. The generator supplies absolute canonical, language-alternate and social-image URLs from that base. Publish only `dist/`.

## Verification status

Source checks and deployment packaging can run locally and in GitHub. Full rendered testing across Chrome, Edge, Firefox and Safari, mobile widths, enlarged text, keyboard navigation and Telegram app handoff still needs a permitted HTTP/HTTPS preview. Do not interpret passing source checks as an all-device guarantee.

The `.gitignore` uses an explicit allowlist. Only the website pages, their runtime assets, shared template, build/check scripts and GitHub check workflow are tracked. The `branding/` source folder, design references, prompts, local notes and generated `dist/` output stay outside the repository. Add any future required website file to this allowlist deliberately.

The production logo and icons live in `assets/`; the website does not depend on the excluded branding folder. Analytics event hooks are present, but an analytics provider still needs to be connected.
