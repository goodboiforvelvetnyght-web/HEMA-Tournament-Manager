# Deploy En Garde to Firebase

Target: **jhematournamentapp**, project number **583621113851**. Repository: **goodboiforvelvetnyght-web/HEMA-Tournament-Manager**. Functions region: **asia-southeast1** (Singapore).

The workflow follows MergingSunWorldApp: pull requests run builds and tests; successful pushes to `main` can deploy the tested website, Cloud Functions, Firestore rules/indexes, and Storage rules. Authentication uses short-lived Google credentials from GitHub Workload Identity Federation. No private Google key is committed or copied to GitHub.

## One-time setup in the project owner's account

1. In [Firebase Console](https://console.firebase.google.com/project/jhematournamentapp/overview), verify **this project** is on Blaze. Billing on another project does not enable billing here.
2. Initialize **Authentication** using Get started. App admins use custom-token sign-in, so no Google or email/password provider is required.
3. Create the default **Cloud Firestore** database in production mode. Singapore (`asia-southeast1`) is the suggested location for this app; retain an already-created database and its location.
4. Initialize **Storage** in the new project. Keep the existing default bucket if already created (`jhematournamentapp.firebasestorage.app`). The first release has no uploads and deploys rules that deny all client access.
5. Open [Google Cloud Shell](https://shell.cloud.google.com/?project=jhematournamentapp). Clone or update this repository there, then run the setup script from its root:

```bash
git clone https://github.com/goodboiforvelvetnyght-web/HEMA-Tournament-Manager.git
cd HEMA-Tournament-Manager
bash scripts/setup-github-deploy.sh
```

Use an existing checkout if one is already present. The script checks the project number and billing before making changes. It enables required APIs and creates a dedicated GitHub deployer, a restricted runtime identity, and trust limited to this repository, `main`, and the deployment workflow. It preserves unrelated IAM bindings and existing artifact cleanup policies.

On the first run it securely prompts for the shared admin password and stores only a salted scrypt hash in Google Secret Manager as `ADMIN_PASSWORD_HASH`. You may enter the initial password agreed for this app or choose a replacement. Nothing prints the password or hash. The script does not change an existing secret. It grants the runtime access to this secret and permission to sign Firebase custom tokens as itself. It does not deploy the app.

6. Return to Codex after **Google setup complete**. Once CI passes, Codex can set `.github/deployment.json` to `{"enabled":true}`, push, monitor deployment, and run the public checks.

The cloud workspace currently needs working GitHub API access to monitor Actions; Git transport is a separate capability. Never enable deployment to bypass a failing test. The Firebase web configuration alone is not a Google deployment credential.

## Daily workflow

A push or merge to `main` runs tests and then publishes when deployment is enabled. Pull requests never receive production Google credentials. Runs are serialized. The deployed frontend is the artifact built and tested in the same run. Cloud Functions are compiled from the same commit.

After deployment, `scripts/check-deployment.mjs` confirms Hosting serves the app and unauthenticated changes are rejected. Then verify the admin password in the browser and run a small tournament. The expected Hosting address is `https://jhematournamentapp.web.app`; it is not a confirmed live deployment until checks pass.

## Password changes

From the repository root in the project owner's Cloud Shell:

```bash
secret_file=$(mktemp)
trap 'rm -f "$secret_file"' EXIT
python3 scripts/hash-password.py "$secret_file"
gcloud secrets versions add ADMIN_PASSWORD_HASH --project=jhematournamentapp --data-file="$secret_file"
rm -f "$secret_file"
```

Redeploy `adminLogin` so the function binds to the latest secret version. Existing authenticated sessions remain valid; revoking them requires revoking refresh tokens for the Firebase Auth user `shared-admin` through a trusted administrative tool. App sign-out removes that browser's session.

## Local validation and environment access

See README for emulator commands. `storage.googleapis.com` is required to download the verified Firestore emulator, and `api.github.com` is needed for GitHub Actions monitoring. These additions are saved in the Codex environment-settings draft; saving/publishing the environment is separate from deploying the app.

If Google setup cannot run, finish the independent tests and retain the deployment switch as false. Do not substitute a browser API key for Google credentials or put the shared password into frontend code.
