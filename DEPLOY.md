# Deploy to Render

Repo: `myousaf64/7x-fde-delivery-assistant` (**private**). Blueprint: `render.yaml` at the repo root.
The blueprint holds no secrets. The two secret values are set in the dashboard.

## Steps

1. Open https://dashboard.render.com and sign in with GitHub.
2. **New > Blueprint**. Pick `myousaf64/7x-fde-delivery-assistant`. Render reads `render.yaml`.
   If it asks for repository access, grant it to this one repo only.
3. Render shows one service, `delivery-assistant-demo`, and asks for the 2 values marked
   `sync: false`:

   | Key | Value |
   |---|---|
   | `LLM_API_KEY` | your DeepSeek key, `sk-...` |
   | `DEMO_PASSCODE` | a passphrase you choose, 5 random words. Never write it in this repo. |

4. **Apply**. First build takes roughly 3 to 5 minutes.
5. The URL is `https://delivery-assistant-demo.onrender.com`, or whatever suffix Render assigns if
   that name is taken. The dashboard shows the exact URL.
6. Open it. The browser asks for a username and password:
   - username: leave it blank, the gate ignores it
   - password: the `DEMO_PASSCODE` you set in step 3

**The passcode lives only in the Render dashboard.** It never goes in this repo, in a commit, or in
a screenshot. To change it: Render > the service > Environment > `DEMO_PASSCODE` > Save, which
redeploys. Generate one with:

```bash
python3 -c "import secrets;print('-'.join(secrets.choice([w.strip().lower() for w in open('/usr/share/dict/words') if 4<=len(w.strip())<=8 and w.strip().isalpha()]) for _ in range(5)))"
```

## What is already set in the blueprint

| Key | Value |
|---|---|
| `NODE_VERSION` | 24.18.0 |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` |
| `MODEL` | `deepseek-chat` |
| region | singapore (closest free region to the UAE) |
| plan | free |
| build | `npm ci --ignore-scripts && npm run build` |
| start | `npm start` |

## The access gate

`prototype/src/middleware.ts` requires HTTP basic auth on every page and API route whenever
`DEMO_PASSCODE` is set. With no `DEMO_PASSCODE`, the gate is off, which is why local development is
unchanged. Static assets are excluded, and they carry no customer data.

This exists because the assignment brief says "Do not distribute". In the submission email, give the
link and the passcode together, and note that the username can stay blank. Say in one line that the
demo is gated because the dataset is confidential. That is a point in your favour, not an obstacle.

## Free tier behaviour, worth knowing before the session

- The service sleeps after about 15 minutes idle. The first request then takes roughly 50 seconds.
  **Open the link 2 minutes before your presentation slot** and send one message to wake it.
- State is in memory, so a sleep or a redeploy resets any reschedule made in the demo. Say so if
  asked; it is a stated cut, not a defect.
- Every push to `main` redeploys automatically.

## If the build fails

| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails on a lockfile mismatch | `package-lock.json` out of date | run `npm install` locally, commit the lockfile, push |
| Blueprint not detected | Render looked in the wrong place | confirm `render.yaml` is at the repo root, not in `prototype/` |
| Every request returns 401 and no prompt appears | a proxy is stripping the auth header | temporarily clear `DEMO_PASSCODE` in the dashboard to confirm, then restore it |
| Chat replies with "The model rejected the key" | `LLM_API_KEY` wrong or out of credit | fix the value in the dashboard and redeploy |
