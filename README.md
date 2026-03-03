# Claude Code Copilot Proxy (cccproxy)

A minimal proxy server that allows [Claude Code](https://docs.anthropic.com/en/docs/claude-code) to use GitHub Copilot as its backend. This enables Claude Code users with GitHub Copilot subscriptions to leverage their existing subscription for Claude Code functionality.

## Prerequisites

- Node.js 18 or later
- A GitHub account with an active GitHub Copilot subscription

## Installation

```bash
npm install -g claude-code-copilot-proxy
```

Or run directly with npx:

```bash
npx cccproxy
```

## Usage

Start the proxy server:

```bash
cccproxy [options]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--port <port>` | `-p` | Port to listen on | `4141` |
| `--account-type <type>` | `-a` | Account type: `individual`, `business`, `enterprise` | `individual` |
| `--github-token <token>` | `-g` | GitHub token (or use `GH_TOKEN` env var) | - |
| `--help` | `-h` | Show help message | - |

### Authentication

On first run, if no GitHub token is provided, the proxy will initiate a device code flow to authenticate with GitHub. Follow the on-screen instructions to authorize the application.

Alternatively, provide a GitHub token via:
- Command line: `--github-token <token>` or `-g <token>`
- Environment variable: `GH_TOKEN`

### Configuring Claude Code

Once the proxy is running, configure Claude Code to use it by setting these environment variables:

```bash
export ANTHROPIC_BASE_URL=http://localhost:4141
export ANTHROPIC_AUTH_TOKEN=dummy
export ANTHROPIC_MODEL=claude-sonnet-4
```

Or add to your `.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:4141",
    "ANTHROPIC_AUTH_TOKEN": "dummy",
    "ANTHROPIC_MODEL": "claude-sonnet-4"
  }
}
```

## Security

- The server binds to `127.0.0.1` only (localhost)
- CORS is restricted to localhost origins
- GitHub tokens are stored in memory only

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

This project is based on [copilot-api](https://github.com/ericc-ch/copilot-api) by Erick Christian Purwanto, licensed under MIT.
