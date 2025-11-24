defmodule ClippsterServerWeb.MetadataController do
  use ClippsterServerWeb, :controller

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
    payload = Jason.encode!(%{
      mint_address: mint_id,
      rpc_url: System.get_env("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    })

    # Write payload to temp file
    temp_file = Path.join(System.tmp_dir!(), "metadata_fetch_#{:erlang.unique_integer([:positive])}.json")
    File.write!(temp_file, payload)

    # Call the Node.js script
    script_path = Path.join([Application.app_dir(:clippster_server), "../../fetch_metadata.js"]) |> Path.expand()
    # Fallback if app_dir doesn't point where we expect in dev (e.g. inside _build)
    script_path = if File.exists?(script_path) do
      script_path
    else
      Path.join([File.cwd!(), "fetch_metadata.js"]) |> Path.expand()
    end

    node_path = find_node_executable()

    result = case System.cmd(node_path, [script_path, temp_file], stderr_to_stdout: true) do
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

  # Helper to find node executable (duplicated from other controllers)
  defp find_node_executable do
    case :os.type() do
      {:win32, _} ->
        case System.cmd("where", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            output
            |> String.split("\n", trim: true)
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&String.contains?(&1, "yarn--"))
            |> Enum.reject(&String.contains?(&1, "Temp"))
            |> Enum.find(&String.ends_with?(&1, "node.exe"))
            |> case do
              nil -> "node"
              path -> path
            end

          _ ->
            # Common paths
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
        case System.cmd("which", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            output
            |> String.split("\n", trim: true)
            |> List.first()
            |> String.trim()

          _ ->
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

