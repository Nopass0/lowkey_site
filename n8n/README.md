# n8n extensions

The `n8n` image in this repository now ships with:

- private `VoidDB` node backed by `@voiddb/orm`
- private `OpenAI / BitNet Chat` node for any OpenAI-compatible endpoint
- local `BitNet` service in `docker-compose` at `http://bitnet:8080/v1`
- `openai` and `@voiddb/orm` packages available inside Code nodes

## Credentials

### VoidDB

- Base URL: current server URL, for example `https://db.lowkey.su`
- Auth: either `VOIDDB_TOKEN` or `VOIDDB_USERNAME` + `VOIDDB_PASSWORD`

### OpenAI / BitNet

- Local BitNet: `http://bitnet:8080/v1`
- OpenAI: `https://api.openai.com/v1`

## Notes

- The local BitNet build uses the official `microsoft/BitNet` repository and defaults to the fast CPU-friendly `1bitLLM/bitnet_b1_58-large` model.
- If you want a larger model later, update the `BITNET_*` values in `.env.compose` and rebuild the stack.
