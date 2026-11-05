# Deploying to the phone

Every push to `main` that touches `server/` or `deploy/` runs `.github/workflows/deploy.yaml`:

```
GitHub Actions                                      Phone (Termux, Samsung Galaxy J6)
──────────────                                      ─────────────────────────────────
npm ci → build → test
package server/dist  ──scp via Cloudflare tunnel──▶  ~/interactify-dist.tgz
run deploy/deploy.sh ──ssh via Cloudflare tunnel──▶  git fast-forward to the commit
                                                     npm ci --omit=dev
                                                     unpack dist, pm2 restart
                                                     check /health (roll back on failure)
```

The phone never builds anything. Its 32-bit Android userspace can't install the build and test
tooling (esbuild, MongoDB test binaries), and building in CI means the phone runs exactly what
passed the tests. You can also run the workflow by hand from the Actions tab ("Run workflow").

## One-time setup

### 1. Phone prerequisites (in your SSH session)

```bash
pkg install git nodejs redis openssh cloudflared
npm install -g pm2
```

The repo must be cloned at `~/interactify` (with `origin` pointing to GitHub), and the server's
`.env` must exist. On the first deploy, `deploy.sh` copies `server-without-kafka/.env` to
`server/.env` automatically, and stops any old PM2 process running from `server-without-kafka/`.

`cloudflare-tunnel` must be running in PM2 (it is how GitHub reaches the phone):

```bash
pm2 start "cloudflared tunnel run --token YOUR_TUNNEL_TOKEN" --name cloudflare-tunnel
pm2 save
```

### 2. Expose SSH through the tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels →** your tunnel **→ Routes → Add
route → Published application**:

- **Subdomain**: `ssh` · **Domain**: your domain
- **Service**: type **SSH**, URL `localhost:8022`

### 3. Protect it with Cloudflare Access

1. **Zero Trust → Access → Service credentials → Service Tokens → Create Service Token**, name
   it `github-actions-deploy`. Copy the **Client ID** and **Client Secret** (the secret is only
   shown once).
2. **Zero Trust → Access → Applications → Add an application → Self-hosted**, with the hostname
   `ssh.yourdomain.com`. Add a policy with action **Service Auth** that includes the service
   token `github-actions-deploy`.

Without this, anyone who finds the hostname can reach your phone's SSH login.

### 4. Create a deploy key

On your laptop, create a key used only by GitHub Actions and install it on the phone (while on
the same Wi-Fi):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/interactify_deploy -N "" -C github-actions-deploy
ssh-copy-id -p 8022 -i ~/.ssh/interactify_deploy.pub YOUR_TERMUX_USER@192.168.29.39
```

### 5. Get the phone's host key

So GitHub can verify it is talking to your phone. In the SSH session on the phone:

```bash
echo "ssh.yourdomain.com $(cut -d' ' -f1,2 "$PREFIX/etc/ssh/ssh_host_ed25519_key.pub")"
```

Copy the whole printed line.

### 6. Add the GitHub secrets

Repository **Settings → Secrets and variables → Actions → New repository secret**, or with the
GitHub CLI from your laptop:

| Secret | Value |
| --- | --- |
| `PHONE_SSH_HOST` | `ssh.yourdomain.com` |
| `PHONE_SSH_USER` | your Termux username (`whoami` on the phone) |
| `PHONE_SSH_KEY` | contents of `~/.ssh/interactify_deploy` (the private key) |
| `PHONE_SSH_KNOWN_HOSTS` | the line printed in step 5 |
| `CF_ACCESS_CLIENT_ID` | service token Client ID |
| `CF_ACCESS_CLIENT_SECRET` | service token Client Secret |

```bash
gh secret set PHONE_SSH_HOST --body "ssh.yourdomain.com"
gh secret set PHONE_SSH_USER --body "u0_aXXX"
gh secret set PHONE_SSH_KEY < ~/.ssh/interactify_deploy
gh secret set PHONE_SSH_KNOWN_HOSTS --body "ssh.yourdomain.com ssh-ed25519 AAAA..."
gh secret set CF_ACCESS_CLIENT_ID --body "..."
gh secret set CF_ACCESS_CLIENT_SECRET --body "..."
```

## Surviving reboots

### Start everything on boot

1. Install **Termux:Boot** from F-Droid (same source as Termux) and open it once.
2. Install the boot script:

   ```bash
   mkdir -p ~/.termux/boot
   cp ~/interactify/deploy/termux-boot.sh ~/.termux/boot/start-interactify
   chmod +x ~/.termux/boot/start-interactify
   ```

It takes a wake lock, starts `sshd` and Redis, and runs `pm2 resurrect`, which restores the
server and the tunnel (deploys run `pm2 save`, so the saved list stays current).

`pm2 startup` does not work in Termux (Android has no systemd), which is why Termux:Boot is needed.

### Samsung settings (Galaxy J6)

Samsung's battery management kills background apps aggressively. On the phone:

Menu names vary slightly between One UI versions; the J6 runs One UI 1 or 2.

- **Settings → Device care → ⋮ → Automation / Advanced → Auto restart**: turn **off**.
  Otherwise the phone reboots itself on a schedule, and everything stops until Termux:Boot is set up.
- **Settings → Device care → Battery → App power management**: turn off **Put unused apps to
  sleep** (and **Adaptive battery** if shown), and add **Termux** and **Termux:Boot** to
  **Apps that won't be put to sleep**.
- **Settings → Apps → ⋮ → Special access → Optimise battery usage**: choose **All**, then turn
  it off for Termux and Termux:Boot.
- Keep it on the charger, and keep Wi-Fi on during sleep.

## SSH from anywhere

With the tunnel route in place you can also reach the phone away from home. Install
`cloudflared` on your laptop and add a policy to the Access application that allows your email
(action **Allow**), then:

```bash
ssh -o ProxyCommand="cloudflared access ssh --hostname %h" YOUR_TERMUX_USER@ssh.yourdomain.com
```

If your Zero Trust organization has strict service token authentication enabled, Allow policies
are ignored for this application; keep using the local IP on your home Wi-Fi in that case.

## When a deploy fails

The workflow log shows each step from the phone. If the server doesn't become healthy within
30 seconds, the script prints the last PM2 logs, restores the previous build, and the run fails.

| Error | Fix |
| --- | --- |
| `ssh: connect ... websocket: bad handshake` | Check the Access application, service token and `CF_ACCESS_*` secrets |
| `Host key verification failed` | Redo step 5 and update `PHONE_SSH_KNOWN_HOSTS` |
| `Connection closed` / timeout | Phone is off, `cloudflare-tunnel` isn't running, or `sshd` isn't running |
| `cannot fast-forward main` | The repo on the phone has local commits or changes; run `git status` there |
| `<command> is not installed` | Install it on the phone (step 1) |
| Health check failed | See the printed logs; usually a missing value in `server/.env` |
