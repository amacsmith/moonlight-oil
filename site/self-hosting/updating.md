# Updating

## Pull Latest Images and Rebuild

```bash
cd stack
docker compose pull            # newer Storyteller image
docker compose build flowstate # rebuild FlowState from upstream
docker compose up -d
```

## Installer Users

Download the latest `MoonlightOilSetup.exe` and run it again. It will update the stack files while preserving your books and settings in `C:\Users\Public\MoonlightOil`.

## Rollback

If something breaks after an update:

1. **Storyteller**: pin the previous image tag in `docker-compose.yml`
2. **FlowState**: set `FLOWSTATE_REF` to a known-good commit hash in `.env`
3. Run `docker compose up -d` to apply
