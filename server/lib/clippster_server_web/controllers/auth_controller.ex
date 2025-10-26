defmodule ClippsterServerWeb.AuthController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Auth.{ChallengeStore, TokenGenerator}
  alias ClippsterServer.Accounts

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
    IO.puts("\nStarting signature verification...")
    
    with {:ok, challenge} <- ChallengeStore.consume_challenge(nonce),
         :ok <- validate_message(message, challenge, public_key),
         :ok <- verify_ed25519_signature(message, signature, public_key) do
      IO.puts("Signature verification successful!")
      
      # Create or get user
      {:ok, user} = Accounts.get_or_create_user(public_key)
      
      # Generate JWT token
      token_claims = %{
        "sub" => public_key,
        "iat" => DateTime.utc_now() |> DateTime.to_unix(),
        "exp" => DateTime.utc_now() |> DateTime.add(7, :day) |> DateTime.to_unix(),
        "wallet_address" => public_key,
        "user_id" => user.id,
        "is_admin" => user.is_admin
      }

      case TokenGenerator.generate_token(token_claims) do
        {:ok, token} ->
          json(conn, %{
            success: true,
            token: token,
            wallet_address: public_key,
            user: %{
              id: user.id,
              wallet_address: user.wallet_address,
              is_admin: user.is_admin
            }
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
      # Normalize line endings to Unix style
      |> String.replace("\r\n", "\n")
      |> String.trim()

    # Normalize the received message too
    normalized_message = String.trim(message)

    IO.puts("Message validation:")
    IO.puts("Expected: #{inspect(expected_message)}")
    IO.puts("Received: #{inspect(normalized_message)}")
    IO.puts("Match: #{normalized_message == expected_message}")

    if normalized_message == expected_message do
      :ok
    else
      {:error, :invalid_message}
    end
  end

  defp verify_ed25519_signature(message, signature_b64, public_key_b58) do
    # Use Node.js script for proper Solana signature verification
    payload = Jason.encode!(%{
      message: message,
      signature: signature_b64,
      public_key: public_key_b58
    })

    IO.puts("\n=== Calling Node.js signature verification ===")
    IO.puts("Message: #{String.slice(message, 0, 100)}...")
    IO.puts("Public key: #{public_key_b58}")
    IO.puts("Signature (base64): #{String.slice(signature_b64, 0, 20)}...")

    # Write payload to temp file
    temp_file = Path.join(System.tmp_dir!(), "sig_verify_#{:erlang.unique_integer([:positive])}.json")
    File.write!(temp_file, payload)

    # Call the Node.js verification script
    script_path = Path.join([Path.dirname(__ENV__.file), "../../../sig_verify.js"]) |> Path.expand()
    node_path = find_node_executable()
    
    IO.puts("Node path: #{node_path}")
    IO.puts("Script path: #{script_path}")
    IO.puts("Temp file: #{temp_file}")
    
    result = case System.cmd(node_path, [script_path, temp_file], 
      stderr_to_stdout: true
    ) do
      {output, 0} ->
        case Jason.decode(output) do
          {:ok, %{"valid" => true}} ->
            IO.puts("✓ Signature valid!")
            :ok
          {:ok, %{"valid" => false}} ->
            IO.puts("✗ Signature invalid!")
            {:error, :invalid_signature}
          {:error, _} ->
            IO.puts("Error parsing verification result")
            {:error, :invalid_signature}
        end

      {output, _exit_code} ->
        IO.puts("Node.js verification failed: #{output}")
        {:error, :invalid_signature}
    end

    # Clean up temp file
    File.rm(temp_file)
    result
  end

  # Find the actual node executable, avoiding wrapper scripts
  defp find_node_executable do
    case :os.type() do
      {:win32, _} ->
        # On Windows, use 'where' to find all node executables
        case System.cmd("where", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            # Parse output and find first real node.exe (not in temp/yarn directory)
            output
            |> String.split("\n", trim: true)
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&String.contains?(&1, "yarn--"))
            |> Enum.reject(&String.contains?(&1, "Temp"))
            |> Enum.find(&String.ends_with?(&1, "node.exe"))
            |> case do
              nil -> "node"  # Fallback
              path -> path
            end

          _ ->
            # Fallback: try common Windows installation paths
            [
              System.get_env("ProgramFiles") <> "\\nodejs\\node.exe",
              System.get_env("ProgramFiles(x86)") <> "\\nodejs\\node.exe",
              "C:\\Program Files\\nodejs\\node.exe",
              "C:\\Program Files (x86)\\nodejs\\node.exe"
            ]
            |> Enum.find(&File.exists?/1)
            |> case do
              nil -> "node"
              path -> path
            end
        end

      {:unix, _} ->
        # On Unix/Linux/Mac, use 'which' to find node
        case System.cmd("which", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            output
            |> String.split("\n", trim: true)
            |> List.first()
            |> String.trim()

          _ ->
            # Try common Unix paths
            ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]
            |> Enum.find(&File.exists?/1)
            |> case do
              nil -> "node"
              path -> path
            end
        end
    end
  end
end
