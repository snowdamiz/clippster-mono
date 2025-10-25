defmodule ClippsterServer.Auth.TokenGenerator do
  use Joken.Config

  @impl true
  def token_config do
    default_claims(skip: [:aud])
    |> add_claim("iss", fn -> "clippster" end, &(&1 == "clippster"))
  end

  def generate_token(claims) do
    signer = get_signer()

    with {:ok, token, _claims} <- Joken.generate_and_sign(token_config(), claims, signer) do
      {:ok, token}
    end
  end

  def verify_token(token) do
    signer = get_signer()

    with {:ok, claims} <- Joken.verify_and_validate(token_config(), token, signer) do
      {:ok, claims}
    end
  end

  defp get_signer do
    secret = Application.get_env(:clippster_server, :jwt_secret) || generate_default_secret()
    Joken.Signer.create("HS256", secret)
  end

  defp generate_default_secret do
    # Generate a default secret for development
    # In production, this should always come from config
    :crypto.strong_rand_bytes(64) |> Base.encode64()
  end
end
