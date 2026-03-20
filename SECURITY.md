# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue**
2. Email the maintainers with details of the vulnerability
3. Include steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

## Security Considerations

### API Key Authentication

- API keys are hashed with SHA-256 before storage — plain keys are never persisted
- Keys are shown once at creation and cannot be retrieved afterward
- Authentication is enforced only in server mode (when `HOST=0.0.0.0`)
- Localhost connections (`127.0.0.1`) bypass authentication by design

### Model Downloads

- Models are downloaded from HuggingFace over HTTPS
- File integrity should be verified after download

### Local-First

VxLLM is designed as a local-first application. By default:
- The server binds to `127.0.0.1` (localhost only)
- No data is sent to external services
- All inference runs on your hardware

### Server Mode

When deploying VxLLM as a server (`HOST=0.0.0.0`):
- Always set a strong `API_KEY`
- Configure `CORS_ORIGINS` to restrict access
- Use a reverse proxy (nginx, Caddy) with TLS in production
- Monitor the `/metrics` endpoint for unusual activity
