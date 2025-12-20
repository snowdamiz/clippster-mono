defmodule ClippsterServerWeb.MetadataController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.JsScripts

  def fetch(conn, %{"mint_id" => mint_id}) do
    case fetch_token_metadata(mint_id) do
      {:ok, metadata} ->
        json(conn, %{success: true, metadata: metadata})

      {:error, reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: reason})
    end
  end

  defp fetch_token_metadata(mint_id) do
    payload =
      Jason.encode!(%{
        mint_address: mint_id,
        rpc_url: System.get_env("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
      })

    # Write payload to temp file
    temp_file = Path.join(System.tmp_dir!(), "metadata_fetch_#{:erlang.unique_integer([:positive])}.json")
    File.write!(temp_file, payload)

    # Call the Node.js script
    script_path = JsScripts.script_path("fetch_metadata.js")
    node_path = JsScripts.find_node_executable()

    result =
      case System.cmd(node_path, [script_path, temp_file], stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, %{"valid" => true, "metadata" => metadata}} ->
              {:ok, metadata}

            {:ok, %{"valid" => false, "error" => error}} ->
              {:error, error}

            {:error, _} ->
              {:error, "Failed to parse metadata script output"}
          end

        {output, _exit_code} ->
          IO.puts("Node.js metadata fetch failed: #{output}")
          {:error, "Metadata fetch failed"}
      end

    # Clean up temp file
    File.rm(temp_file)
    result
  end
end
