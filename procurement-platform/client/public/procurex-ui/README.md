# ProcureX UI

This folder contains the static front-end prototype for ProcureX. It runs as plain HTML, CSS, and JavaScript with no package install and no build step.

## Run Locally

Open the app directly:

```text
procurex-ui/index.html
```

For the most reliable behavior, serve this folder locally:

```powershell
cd procurex-ui
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

VS Code Live Server also works: open this folder, right-click `index.html`, and choose **Open with Live Server**.

## Direct Routes

| Screen | URL |
| --- | --- |
| Welcome | `http://localhost:8000/?page=welcome` |
| About ProcureX | `http://localhost:8000/?page=about-procurex` |
| Privacy Policy | `http://localhost:8000/?page=privacy-policy` |
| Terms and Conditions | `http://localhost:8000/?page=terms-and-conditions` |
| Contact | `http://localhost:8000/?page=contact` |
| Register | `http://localhost:8000/?page=register` |
| Sign in | `http://localhost:8000/?page=sign-in` |
| IAM verification | `http://localhost:8000/?page=iam-verification` |
| Workspace dashboard | `http://localhost:8000/?page=workspace-dashboard` |
| Marketplace | `http://localhost:8000/?page=marketplace` |
| Create tender | `http://localhost:8000/?page=create-tender` |
| Admin compliance dashboard | `http://localhost:8000/?page=admin-dashboard` |
| Bid evaluation | `http://localhost:8000/?page=bid-evaluation` |
| Award recommendation | `http://localhost:8000/?page=award-recommendation` |
| Records and history | `http://localhost:8000/?page=records-history` |

## File Structure

```text
procurex-ui/
|-- index.html
|-- assets/
|   |-- logo.svg
|   |-- ProcureX.json
|   |-- page-visuals/
|   |-- readme/
|   `-- welcome/
|-- js/
|   |-- app.js
|   |-- charts.js
|   `-- data.js
|-- pages/
|   |-- workspace-dashboard.js
|   |-- create-tender.js
|   |-- supplier-marketplace.js
|   `-- ...
`-- styles/
    |-- design-system.css
    |-- components.css
    |-- main.css
    `-- pages.css
```

## CDN Dependencies

The app loads these browser dependencies from CDNs:

- Chart.js for dashboard charts.
- html2pdf.js for tender document and annex PDF export.
- dotLottie player for the ProcureX loading animation.
- Google Fonts for the visual system.

If a CDN is blocked or the machine is offline, the app still renders most screens, but charts, PDF export, fonts, or Lottie animation may degrade.

## Maintenance Notes

- Register new page scripts in `index.html`.
- Add route titles and navigation behavior in `js/app.js`.
- Keep shared mock data in `js/data.js`.
- Prefer existing styles in `styles/design-system.css` before adding new page-specific rules.
- Store durable UI imagery under `assets/`; README screenshots live in `assets/readme/`.
