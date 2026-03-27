import { Client } from "ssh2";
import { config } from "../../config";

type MtprotoSettings = {
  enabled?: boolean | null;
  port?: number | null;
  secret?: string | null;
  botUsername?: string | null;
  channelUsername?: string | null;
  addChannelOnConnect?: boolean | null;
};

type DeployServerInput = {
  ip: string;
  hostname: string;
  sshUsername: string;
  sshPassword: string;
  pm2ProcessName: string;
  serverId?: string | null;
};

function ensureProvisioningConfig() {
  if (!config.VOIDDB_URL) {
    throw new Error("VOIDDB_URL is required for VPN node provisioning");
  }
  if (!config.VOIDDB_TOKEN && (!config.VOIDDB_USERNAME || !config.VOIDDB_PASSWORD)) {
    throw new Error(
      "Set VOIDDB_TOKEN or VOIDDB_USERNAME/VOIDDB_PASSWORD for VPN node provisioning",
    );
  }
}

function buildEnvFile(server: DeployServerInput, mtproto: MtprotoSettings) {
  ensureProvisioningConfig();

  const env = new Map<string, string>([
    ["VOIDDB_URL", config.VOIDDB_URL],
    ["BACKEND_URL", "https://lowkey.su/api"],
    ["CAPTIVE_PORTAL_URL", "https://lowkey.su"],
    ["BACKEND_SECRET", config.BACKEND_SECRET],
    ["SERVER_IP", server.ip],
    ["SERVER_HOSTNAME", server.hostname],
    ["SERVER_ID", server.serverId ?? ""],
    ["CAPTIVE_IP", server.ip],
    ["LISTEN", "0.0.0.0:443"],
    ["TLS_CACHE_DIR", "./tls-cache"],
    ["CAPTIVE_PORTAL_LISTEN", "0.0.0.0:8080"],
    ["DNS_LISTEN", "0.0.0.0:53"],
    ["UPSTREAM_DNS", "8.8.8.8:53"],
    ["BANDWIDTH_UP", "1000"],
    ["BANDWIDTH_DOWN", "1000"],
    ["MTPROTO_BOT", "@lowkeyvpnbot"],
  ]);

  if (config.VOIDDB_TOKEN) {
    env.set("VOIDDB_TOKEN", config.VOIDDB_TOKEN);
  } else {
    env.set("VOIDDB_USERNAME", config.VOIDDB_USERNAME);
    env.set("VOIDDB_PASSWORD", config.VOIDDB_PASSWORD);
  }

  if (config.LETSENCRYPT_EMAIL && server.hostname) {
    env.set(
      "CERT_FILE",
      `/etc/letsencrypt/live/${server.hostname}/fullchain.pem`,
    );
    env.set("KEY_FILE", `/etc/letsencrypt/live/${server.hostname}/privkey.pem`);
  }

  if (mtproto.enabled && mtproto.secret) {
    const mtprotoPort = String(mtproto.port ?? 443);
    env.set("MTPROTO_ENABLED", "true");
    env.set("MTPROTO_LISTEN", `0.0.0.0:${mtprotoPort}`);
    env.set("MTPROTO_SECRET", mtproto.secret);
    env.set(
      "MTPROTO_BOT",
      mtproto.botUsername || mtproto.channelUsername || "@lowkeyvpnbot",
    );
    env.set(
      "MTPROTO_ADD_BOT",
      mtproto.addChannelOnConnect ? "true" : "false",
    );
    env.set(
      "CAPTIVE_HTTPS_LISTEN",
      mtprotoPort === "8443" ? "0.0.0.0:9443" : "0.0.0.0:8443",
    );
  } else {
    env.set("MTPROTO_ENABLED", "false");
    env.set("CAPTIVE_HTTPS_LISTEN", "0.0.0.0:8443");
  }

  return [...env.entries()]
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
    .join("\n");
}

function escapeEnvValue(value: string) {
  return value.replace(/\r/g, "").replace(/\n/g, "\\n");
}

function buildRemoteScript(server: DeployServerInput, mtproto: MtprotoSettings) {
  const envFile = Buffer.from(buildEnvFile(server, mtproto), "utf8").toString(
    "base64",
  );
  const repoUrl = Buffer.from(config.VPN_NODE_REPO_URL, "utf8").toString(
    "base64",
  );
  const baseDir = Buffer.from(config.VPN_NODE_BASE_DIR, "utf8").toString(
    "base64",
  );
  const letsencryptEmail = Buffer.from(
    config.LETSENCRYPT_EMAIL || "",
    "utf8",
  ).toString("base64");
  const sshPassword = Buffer.from(server.sshPassword, "utf8").toString(
    "base64",
  );

  return `
set -euo pipefail
export PATH="/usr/local/go/bin:/usr/local/bin:$PATH"
export DEBIAN_FRONTEND=noninteractive

REPO_URL="$(printf '%s' '${repoUrl}' | base64 -d)"
BASE_DIR="$(printf '%s' '${baseDir}' | base64 -d)"
APP_DIR="$BASE_DIR/site/hysteria-server"
PM2_NAME="${server.pm2ProcessName}"
HOSTNAME_VALUE="${server.hostname}"
LETSENCRYPT_EMAIL_VALUE="$(printf '%s' '${letsencryptEmail}' | base64 -d)"
SSH_PASSWORD_VALUE="$(printf '%s' '${sshPassword}' | base64 -d)"
GO_VERSION="1.25.0"

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    echo "sudo is required for non-root deployment" >&2
    exit 1
  fi

  printf '%s\\n' "$SSH_PASSWORD_VALUE" | sudo -S -p '' "$@"
}

detect_go_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *)
      echo "Unsupported CPU architecture for Go bootstrap: $(uname -m)" >&2
      return 1
      ;;
  esac
}

ensure_go_toolchain() {
  local current_version arch archive_path

  current_version="$(go env GOVERSION 2>/dev/null || true)"
  if [ "$current_version" = "go\${GO_VERSION}" ]; then
    return
  fi

  arch="$(detect_go_arch)"
  archive_path="/tmp/go\${GO_VERSION}.linux-\${arch}.tar.gz"

  curl -fsSL "https://go.dev/dl/go\${GO_VERSION}.linux-\${arch}.tar.gz" -o "$archive_path"
  run_root rm -rf /usr/local/go
  run_root tar -C /usr/local -xzf "$archive_path"
  run_root ln -sf /usr/local/go/bin/go /usr/local/bin/go
  run_root ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
  rm -f "$archive_path"
  export PATH="/usr/local/go/bin:/usr/local/bin:$PATH"
}

run_root apt-get update
run_root apt-get install -y ca-certificates curl git certbot npm libcap2-bin tar
ensure_go_toolchain

if ! command -v pm2 >/dev/null 2>&1; then
  run_root npm install -g pm2
fi

run_root mkdir -p "$BASE_DIR"
run_root chown -R "$(id -u):$(id -g)" "$BASE_DIR"

if [ ! -d "$BASE_DIR/.git" ]; then
  if [ -n "$(ls -A "$BASE_DIR" 2>/dev/null)" ]; then
    echo "Deployment directory exists but is not a git clone: $BASE_DIR" >&2
    exit 1
  fi
  git clone "$REPO_URL" "$BASE_DIR"
else
  git -C "$BASE_DIR" fetch origin main --tags
  if git -C "$BASE_DIR" rev-parse --verify main >/dev/null 2>&1; then
    git -C "$BASE_DIR" checkout main
  else
    git -C "$BASE_DIR" checkout -b main origin/main
  fi
  git -C "$BASE_DIR" pull --ff-only origin main
fi

cd "$APP_DIR"
go mod download
go build -o hysteria-server .

if [ -n "$LETSENCRYPT_EMAIL_VALUE" ] && [ -n "$HOSTNAME_VALUE" ]; then
  run_root certbot certonly --standalone \\
    --non-interactive \\
    --agree-tos \\
    --keep-until-expiring \\
    -m "$LETSENCRYPT_EMAIL_VALUE" \\
    -d "$HOSTNAME_VALUE"
fi

printf '%s' '${envFile}' | base64 -d > .env.pm2

cat > run-hysteria.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
set -a
source ./.env.pm2
set +a
exec ./hysteria-server
EOF

chmod +x run-hysteria.sh
run_root setcap 'cap_net_bind_service=+ep' ./hysteria-server || true

pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
pm2 start ./run-hysteria.sh --name "$PM2_NAME" --interpreter bash --cwd "$APP_DIR" --update-env
pm2 save
pm2 status "$PM2_NAME"
`;
}

function execRemote(client: Client, command: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      stream.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      stream.on("close", (code: number | null) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new Error(
            stderr.trim() ||
              stdout.trim() ||
              `Remote deploy failed with exit code ${code ?? "unknown"}`,
          ),
        );
      });
    });
  });
}

export async function deployHysteriaNode(
  server: DeployServerInput,
  mtproto: MtprotoSettings,
) {
  ensureProvisioningConfig();

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const client = new Client();

    client
      .on("ready", async () => {
        try {
          const result = await execRemote(client, buildRemoteScript(server, mtproto));
          client.end();
          resolve(result);
        } catch (error) {
          client.end();
          reject(error);
        }
      })
      .on("error", (error) => {
        reject(error);
      })
      .connect({
        host: server.ip,
        port: 22,
        username: server.sshUsername,
        password: server.sshPassword,
        readyTimeout: 20_000,
      });
  });
}
