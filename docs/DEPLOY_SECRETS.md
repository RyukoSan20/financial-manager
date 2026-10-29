# The deployment secrets

The deployment pipeline has been failing on every run since it was
written. There were two reasons, and both had to be fixed.

**The first was the action.** The workflow used
`webfactory/ssh-agent@v0.9.0` and gave it three inputs:

```yaml
- name: Configure SSH
  uses: webfactory/ssh-agent@v0.9.0
  with:
    host: ${{ secrets.VPS_HOST }}
    username: ${{ secrets.VPS_USER }}
    key: ${{ secrets.VPS_SSH_KEY }}
```

That action has never accepted those names. It takes `ssh-private-key`
and a few others, and anything else is ignored. The step therefore
always failed with:

```
##[warning]Unexpected input(s) 'host', 'username', 'key', valid inputs
  are ['ssh-private-key', 'ssh-auth-sock', 'log-public-key', ...]
##[error]The ssh-private-key argument is empty.
```

The workflow now uses `appleboy/ssh-action@v1.2.5` and
`appleboy/scp-action@v1.0.0`, which take the names the workflow was
already written with.

**The second was that the secrets had never been created.** The GitHub
API reports zero secrets for the repository and zero for the
`Production` environment, so `VPS_HOST`, `VPS_USER` and `VPS_SSH_KEY`
were all empty.

## Setting them

The quickest way is the script:

```bash
cd /Users/rafi/financial-manager
bash scripts/setup_deploy_secrets.sh
```

It asks for the host and the user (the defaults are the ones this
project uses), reads the private key, checks that the key is one the
server accepts, reads the host key fingerprint and asks you to
confirm it, then writes all four secrets.

If you would rather run the commands yourself, here they are.

### The host and the user

```bash
gh secret set VPS_HOST --repo RyukoSan20/financial-manager --body '43.173.52.98'
gh secret set VPS_USER --repo RyukoSan20/financial-manager --body 'ubuntu'
```

### The private key

The key is `~/.ssh/id_financial`. Its public half is already in the
server's `authorized_keys`, so this is the key the server expects.

```bash
gh secret set VPS_SSH_KEY --repo RyukoSan20/financial-manager < ~/.ssh/id_financial
```

The `<` matters: `gh secret set` reads the value from standard input
when there is no `--body`, so the key never appears in the command
line and never lands in the shell history.

### The host key fingerprint

This one is not optional. Without it, the action skips the host key
check and trusts whatever answers at that address - and a server that
has been moved is exactly the case where that matters.

```bash
ssh-keyscan -t ed25519 -H 43.173.52.98 2>/dev/null | ssh-keygen -lf -
```

That prints a line like:

```
256 SHA256:QbcWAAvRxnm1GhWV2rNIlclANTF35t4W6sngsBl4RBg 43.173.52.98 (ED25519)
```

Read the fingerprint and compare it with the one already known to
this machine:

```bash
ssh-keygen -lf ~/.ssh/known_hosts | grep 43.173.52.98
```

If the two match, set the secret with the fingerprint part only:

```bash
gh secret set VPS_HOST_FINGERPRINT --repo RyukoSan20/financial-manager \
  --body 'SHA256:QbcWAAvRxnm1GhWV2rNIlclANTF35t4W6sngsBl4RBg'
```

If they do not match, stop. Either the server has been reinstalled or
something is answering on that address. Find out which before
deploying.

### The environment as well

The deployment runs under the `Production` environment. Writing the
secrets there too means the pipeline works whether the value is read
from the repository or from the environment:

```bash
gh secret set VPS_HOST --env Production --repo RyukoSan20/financial-manager --body '43.173.52.98'
gh secret set VPS_USER --env Production --repo RyukoSan20/financial-manager --body 'ubuntu'
gh secret set VPS_SSH_KEY --env Production --repo RyukoSan20/financial-manager < ~/.ssh/id_financial
gh secret set VPS_HOST_FINGERPRINT --env Production --repo RyukoSan20/financial-manager \
  --body 'SHA256:QbcWAAvRxnm1GhWV2rNIlclANTF35t4W6sngsBl4RBg'
```

## Checking that they are there

The API never returns the value of a secret, only its name and the
day it was last changed:

```bash
gh secret list --repo RyukoSan20/financial-manager
gh secret list --env Production --repo RyukoSan20/financial-manager
```

## Running the deployment

```bash
gh workflow run deploy.yml --repo RyukoSan20/financial-manager
gh run watch --repo RyukoSan20/financial-manager
```

A push to `main` does the same thing on its own.

## What the pipeline does

| Step | What it does |
|---|---|
| Detect changed paths | Works out whether the backend, the frontend or nginx changed |
| Build frontend | Builds with the layers on, and refuses to deploy a bundle with a doubled `/api` prefix |
| Check the connection | Fails early, before anything is touched, if the server cannot be reached |
| Backup | Copies the current `dist` and nginx config into `/home/ubuntu/backups/<stamp>` |
| Deploy backend | Sends the tested backend code to the container and checks it still imports |
| Run migrations | Runs alembic, and says so if it could not |
| Restart backend | Restarts and waits for `/health`, and prints the logs if it does not come back |
| Deploy frontend | Replaces the built assets with the ones built by this run |
| Deploy nginx config | Tests the configuration, then reloads |
| Smoke test | Checks four live URLs and fails the deployment if any of them is not 200 |

The backend and the frontend are packed on the runner and uploaded,
rather than packed on the server. The server's own copy is the last
thing that was deployed, so packing it there would redeploy the old
build and call it a success.
