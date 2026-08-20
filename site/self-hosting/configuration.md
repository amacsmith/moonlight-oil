# Configuration

All settings live in `stack/.env`. The installer generates this file automatically; when running by hand, copy from `.env.example`.

## Environment Variables

### Ports

| Variable | Default | Description |
|----------|---------|-------------|
| `HOME_PORT` | `8080` | The home page Dad opens |
| `STORYTELLER_PORT` | `8001` | Storyteller web app |
| `LAN_HOST` | *(blank)* | This PC's address on the home network. The launcher refreshes it on every start; the home page turns it into a QR code for phones and tablets. Blank simply hides that panel |
| `READIUM_PORT` | `8002` | Storyteller's reader engine |
| `FLOWSTATE_PORT` | `8003` | FlowState Reader |

### Storyteller

| Variable | Default | Description |
|----------|---------|-------------|
| `STORYTELLER_SECRET_KEY` | *(generated)* | Long random string for session security. Required. |
| `STORYTELLER_LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `PUID` | `1000` | User ID for file ownership |
| `PGID` | `1000` | Group ID for file ownership |

### FlowState

| Variable | Default | Description |
|----------|---------|-------------|
| `FLOWSTATE_REF` | `master` | Git branch or commit to build from |

## Accessing from the Network

The ports bind to all interfaces by default, so other devices on your home network can reach the library at `http://<pc-ip>:8080`. The home page detects the hostname automatically.

## Custom FlowState Fork

Override the build source in `docker-compose.yml` or via build args:

```bash
docker compose build \
  --build-arg FLOWSTATE_REPO=https://github.com/yourfork/flowstate-webapp.git \
  --build-arg FLOWSTATE_REF=my-branch \
  flowstate
```
