# Wiki Radar - Deployment Package

## Quick Deploy to Vercel (Recommended)

### Step 1: Create the project locally

```bash
npx create-react-app wiki-radar
cd wiki-radar
```

### Step 2: Replace src/App.js

Copy the contents of `wiki-radar.jsx` into `src/App.js`

### Step 3: Update src/index.js

Make sure it imports App correctly:
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 4: Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts - you'll get a live URL like `wiki-radar.vercel.app`

---

## Alternative: Deploy to Netlify

```bash
npm run build
npx netlify-cli deploy --prod --dir=build
```

---

## Alternative: GitHub Pages (Free)

1. Create a new GitHub repo
2. Push your code
3. Go to Settings → Pages → Deploy from branch

---

## The Wikipedia API Connection

The app already connects to these free, public Wikipedia APIs:

1. **Recent Changes API** (real-time edits)
   ```
   https://en.wikipedia.org/w/api.php?action=query&list=recentchanges...
   ```

2. **Pageviews API** (traffic data)
   ```
   https://wikimedia.org/api/rest_v1/metrics/pageviews/...
   ```

3. **Article Info API** (metadata, revisions)
   ```
   https://en.wikipedia.org/w/api.php?action=query&titles=...
   ```

No API keys required - these are all public endpoints with CORS enabled (`origin=*`).

---

## Custom Domain (Optional)

After deploying to Vercel/Netlify:
1. Go to your dashboard
2. Add custom domain
3. Update DNS records as instructed
