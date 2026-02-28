alias ClippsterServer.Social.ProviderMode

IO.puts("=== Environment Variables ===")
IO.puts("SOCIAL_PROVIDER_MODE env: #{System.get_env("SOCIAL_PROVIDER_MODE") || "NOT SET"}")

IO.puts("\n=== Application Config ===")
social_config = Application.get_env(:clippster_server, :social, [])
IO.puts("social_provider_mode config: #{Keyword.get(social_config, :social_provider_mode, "NOT SET")}")

IO.puts("\n=== ProviderMode Module ===")
IO.puts("ProviderMode.mode(): #{ProviderMode.mode()}")
IO.puts("ProviderMode.post_for_me?(): #{ProviderMode.post_for_me?()}")
IO.puts("ProviderMode.post_for_me_enabled?(): #{ProviderMode.post_for_me_enabled?()}")
IO.puts("ProviderMode.legacy?(): #{ProviderMode.legacy?()}")
IO.puts("ProviderMode.dual?(): #{ProviderMode.dual?()}")

IO.puts("\n=== Post For Me Config ===")
pfm_config = Application.get_env(:clippster_server, :post_for_me, [])
IO.puts("api_key: #{Keyword.get(pfm_config, :api_key, "NOT SET") |> String.slice(0..10)}...")
IO.puts("project_id: #{Keyword.get(pfm_config, :project_id, "NOT SET")}")
IO.puts("callback_url: #{Keyword.get(pfm_config, :callback_url, "NOT SET")}")
