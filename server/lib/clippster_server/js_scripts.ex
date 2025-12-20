defmodule ClippsterServer.JsScripts do
  @moduledoc """
  Helper module for locating and executing JavaScript scripts.

  In development, scripts are in the project root.
  In production releases, scripts are copied to priv/js/.
  """

  @doc """
  Get the path to a JS script file.
  Works in both development and production releases.
  """
  def script_path(script_name) do
    # First, try the release location (priv/js/)
    priv_path = Application.app_dir(:clippster_server, ["priv", "js", script_name])

    if File.exists?(priv_path) do
      priv_path
    else
      # Fallback for development: check project root
      dev_path = Path.join([File.cwd!(), script_name])

      if File.exists?(dev_path) do
        dev_path
      else
        # Last resort: try relative to priv directory
        Path.join([Application.app_dir(:clippster_server, "priv"), "..", script_name])
        |> Path.expand()
      end
    end
  end

  @doc """
  Get the path to the node_modules directory.
  Required for JS scripts that have npm dependencies.
  """
  def node_modules_path do
    # In releases, node_modules is at the app root
    release_path = Path.join([Application.app_dir(:clippster_server), "..", "..", "node_modules"])
    |> Path.expand()

    if File.exists?(release_path) do
      release_path
    else
      # Development: project root
      Path.join([File.cwd!(), "node_modules"])
    end
  end

  @doc """
  Find the Node.js executable path.
  Handles Windows and Unix systems with common installation paths.
  """
  def find_node_executable do
    case :os.type() do
      {:win32, _} -> find_node_windows()
      {:unix, _} -> find_node_unix()
    end
  end

  defp find_node_windows do
    case System.cmd("where", ["node"], stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&String.contains?(&1, "yarn--"))
        |> Enum.reject(&String.contains?(&1, "Temp"))
        |> Enum.find(&String.ends_with?(&1, "node.exe"))
        |> case do
          nil -> find_node_windows_fallback()
          path -> path
        end

      _ ->
        find_node_windows_fallback()
    end
  end

  defp find_node_windows_fallback do
    paths = [
      System.get_env("ProgramFiles"),
      System.get_env("ProgramFiles(x86)"),
      "C:\\Program Files",
      "C:\\Program Files (x86)"
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.map(&(&1 <> "\\nodejs\\node.exe"))
    |> Enum.find(&File.exists?/1)

    paths || "node"
  end

  defp find_node_unix do
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

  @doc """
  Execute a JS script with the given arguments.
  Returns {:ok, result} or {:error, reason}.
  """
  def execute(script_name, args \\ [], opts \\ []) do
    script = script_path(script_name)
    node = find_node_executable()

    # Set NODE_PATH to include our node_modules
    env = [{"NODE_PATH", node_modules_path()}]
    cmd_opts = Keyword.merge([stderr_to_stdout: true, env: env], opts)

    case System.cmd(node, [script | args], cmd_opts) do
      {output, 0} -> {:ok, output}
      {output, code} -> {:error, {code, output}}
    end
  end
end
