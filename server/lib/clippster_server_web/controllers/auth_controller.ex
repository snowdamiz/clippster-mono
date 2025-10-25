defmodule ClippsterServerWeb.AuthController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Auth.{ChallengeStore, TokenGenerator}

  @sign_message_template """
  <%= domain %> wants you to sign in with your Solana account:
  <%= wallet_address %>

  Nonce: <%= nonce %>
  Issued At: <%= timestamp %>
  Chain ID: mainnet-beta
  """

  # Handle OPTIONS requests for CORS preflight
  def options(conn, _params) do
    conn
    |> put_resp_header("access-control-allow-origin", get_req_header(conn, "origin") |> List.first() || "*")
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With")
    |> put_resp_header("access-control-max-age", "86400")
    |> send_resp(200, "")
  end

  def request_challenge(conn, %{"client_id" => client_id}) do
    challenge = ChallengeStore.create_challenge(client_id)

    json(conn, %{
      success: true,
      challenge: %{
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
        domain: challenge.domain,
        message_template: @sign_message_template
      }
    })
  end

  def verify_signature(conn, %{
        "signature" => signature,
        "public_key" => public_key,
        "message" => message,
        "nonce" => nonce
      }) do
    with {:ok, challenge} <- ChallengeStore.consume_challenge(nonce),
         :ok <- validate_message(message, challenge, public_key),
         :ok <- verify_ed25519_signature(message, signature, public_key) do
      # Generate JWT token
      token_claims = %{
        "sub" => public_key,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
        "wallet_address" => public_key
      }

      case TokenGenerator.generate_token(token_claims) do
        {:ok, token} ->
          json(conn, %{
            success: true,
            token: token,
            wallet_address: public_key
          })

        {:error, _reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Token generation failed"})
      end
    else
      {:error, :not_found} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Invalid or expired challenge"})

      {:error, :expired} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Challenge has expired"})

      {:error, :invalid_message} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Message format invalid"})

      {:error, :invalid_signature} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Signature verification failed"})
    end
  end

  defp validate_message(message, challenge, wallet_address) do
    expected_message =
      EEx.eval_string(@sign_message_template,
        domain: challenge.domain,
        wallet_address: wallet_address,
        nonce: challenge.nonce,
        timestamp: challenge.timestamp
      )

    if message == expected_message do
      :ok
    else
      {:error, :invalid_message}
    end
  end

  defp verify_ed25519_signature(message, signature_b58, public_key_b58) do
    try do
      signature = Base58.decode(signature_b58)
      public_key = Base58.decode(public_key_b58)
      message_bytes = :erlang.binary_to_list(message)

      case :crypto.verify(:eddsa, :none, message_bytes, signature, [public_key, :ed25519]) do
        true -> :ok
        false -> {:error, :invalid_signature}
      end
    rescue
      _ -> {:error, :invalid_signature}
    end
  end
end
