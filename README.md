# Field Tools — PWA (v1.2)

The same five calculators as the Windows app, as an installable web app that works offline on iPhone, Android and desktop.

## 1. Host it (pick one, all free)

The folder is plain static files, so any static host works. It must be served over **HTTPS** (all of the options below do this for you).

- **Netlify Drop (easiest):** go to https://app.netlify.com/drop and drag this whole folder onto the page. You get a URL like `https://something.netlify.app`. Make a free account to keep it permanently.
- **GitHub Pages:** create a repository, upload these files to it, then Settings → Pages → Deploy from branch `main`, folder `/ (root)`. The URL is `https://<you>.github.io/<repo>/`.
- **Cloudflare Pages:** Workers & Pages → Create → Pages → Upload assets, then drop this folder.

Opening `index.html` straight from disk will run the calculators but will **not** install or work offline. Browsers only allow that over HTTPS (or `localhost`).

## 2. Install it

- **Android (Chrome / Edge / Samsung Internet):** open the URL and tap the **Install** button in the banner at the top, or use the browser menu → *Install app* / *Add to Home screen*.
- **iPhone / iPad:** open the URL in **Safari**, tap the **Share** button, then **Add to Home Screen**. The app shows a banner with these steps.
- **Windows / Mac (Chrome or Edge):** click the install icon at the right end of the address bar.

After the first visit everything is stored on the device and the app works with no signal.

## 3. Updating it later

Change the files, then bump `VERSION` at the top of `sw.js` (for example to `field-tools-v1.3.0`) and re-upload. Installed copies pick up the new version the next time they're opened with a connection.

## What's different from the Windows app

The calculators, saved settings and Ctrl shortcuts (Ctrl+R swap, Ctrl+Shift+C copy) are unchanged. The desktop-only features (tray icon, Ctrl+Alt+U global hotkey, "Always on top", start with Windows) aren't possible in a web app, so they're hidden. On phones the sidebar becomes a bottom tab bar.
