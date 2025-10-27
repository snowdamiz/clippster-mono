# ClippsterServer

## Environment Variables

Required environment variables:

* `PAYMENT_ADDRESS` - Solana wallet address for receiving payments
* `ALCHEMY_API_KEY` - API key for Alchemy price service
* `SOLANA_RPC_URL` - (Optional) Solana RPC endpoint URL. Defaults to public mainnet endpoint if not set.

**Note:** The public Solana RPC endpoint (`https://api.mainnet-beta.solana.com`) has rate limits and restricted access. For production, use a dedicated RPC provider like:
- Helius (https://helius.dev)
- Alchemy (https://alchemy.com)
- QuickNode (https://quicknode.com)
- Triton One (https://triton.one)

## Getting Started

To start your Phoenix server:

* Run `mix setup` to install and setup dependencies
* Start Phoenix endpoint with `mix phx.server` or inside IEx with `iex -S mix phx.server`

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser.

Ready to run in production? Please [check our deployment guides](https://hexdocs.pm/phoenix/deployment.html).

## Learn more

* Official website: https://www.phoenixframework.org/
* Guides: https://hexdocs.pm/phoenix/overview.html
* Docs: https://hexdocs.pm/phoenix
* Forum: https://elixirforum.com/c/phoenix-forum
* Source: https://github.com/phoenixframework/phoenix
