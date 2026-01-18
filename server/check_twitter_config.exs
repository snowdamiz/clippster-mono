# Check Twitter API configuration
IO.puts("Twitter API Key configured: #{inspect(Application.get_env(:clippster_server, :twitter)[:api_key] != nil)}")
IO.puts("API Key value: #{inspect(Application.get_env(:clippster_server, :twitter)[:api_key])}")
