defmodule ClippsterServer.Auth.WorkspaceOAuth do
  @moduledoc "Short-lived, single-use PKCE handoffs from Google OAuth to the web workspace server."
  import Ecto.Query
  alias ClippsterServer.Repo
  alias ClippsterServerWeb.OAuthCallbackTarget

  def start_params(%{"origin" => origin, "client_state" => state, "code_challenge" => challenge}) do
    with {:ok, normalized} <- OAuthCallbackTarget.normalize_web_origin(origin),
         true <- normalized == origin,
         true <-
           origin == "https://app.clippster.app" or
             URI.parse(origin).host in ["localhost", "127.0.0.1"],
         true <- valid_secret?(state),
         true <- is_binary(challenge) and Regex.match?(~r/\A[A-Za-z0-9_-]{43}\z/, challenge) do
      {:ok,
       %{
         "workspace" => true,
         "origin" => origin,
         "client_state" => state,
         "code_challenge" => challenge
       }}
    else
      _ -> {:error, :invalid_request}
    end
  end

  def start_params(_), do: {:error, :invalid_request}

  def issue(user_id, %{origin: origin, code_challenge: challenge}) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    code = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
    Repo.delete_all(from c in "workspace_oauth_codes", where: c.expires_at < ^now)

    {1, _} =
      Repo.insert_all("workspace_oauth_codes", [
        %{
          code_hash: hash(code),
          user_id: user_id,
          origin: origin,
          code_challenge: challenge,
          expires_at: DateTime.add(now, 120, :second)
        }
      ])

    code
  end

  def exchange(%{"code" => code, "code_verifier" => verifier, "origin" => origin}) do
    if valid_secret?(code) and valid_secret?(verifier) and is_binary(origin) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      code_hash = hash(code)
      challenge = :crypto.hash(:sha256, verifier) |> Base.url_encode64(padding: false)
      # DELETE ... RETURNING consumes the code atomically across API machines.
      case Repo.delete_all(
             from c in "workspace_oauth_codes",
               where:
                 c.code_hash == ^code_hash and c.code_challenge == ^challenge and
                   c.origin == ^origin and c.expires_at > ^now,
               select: c.user_id
           ) do
        {1, [user_id]} -> {:ok, user_id}
        _ -> {:error, :invalid_code}
      end
    else
      {:error, :invalid_code}
    end
  end

  def exchange(_), do: {:error, :invalid_code}

  defp valid_secret?(value),
    do: is_binary(value) and Regex.match?(~r/\A[A-Za-z0-9_-]{43,128}\z/, value)

  defp hash(value), do: :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
end
