
## Docker Compose

Build and run the full stack with:

```bash
docker compose up --build
```

The API listens on the internal network as `api:8000`, proxied by Nginx at `http://localhost:8080`.
