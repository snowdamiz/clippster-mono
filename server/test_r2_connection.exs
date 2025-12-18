# Test script to diagnose TLS connection to Cloudflare R2
# Run with: mix run test_r2_connection.exs

IO.puts("\n=== Cloudflare R2 TLS Connection Test ===\n")

# Get R2 account ID
account_id = System.get_env("R2_ACCOUNT_ID")

if is_nil(account_id) or account_id == "" do
  IO.puts("ERROR: R2_ACCOUNT_ID environment variable is not set!")
  System.halt(1)
end

host = "#{account_id}.r2.cloudflarestorage.com"
host_charlist = String.to_charlist(host)

IO.puts("Target host: #{host}")
IO.puts("")

# Check available TLS versions
IO.puts("=== SSL/TLS Versions ===")
ssl_versions = :ssl.versions()
IO.puts("Available: #{inspect(ssl_versions[:available])}")
IO.puts("Supported: #{inspect(ssl_versions[:supported])}")
IO.puts("")

# Test 1: Basic TLS 1.2 connection with SNI, no verification
IO.puts("=== Test 1: TLS 1.2 + SNI + No Verify ===")
result1 = :ssl.connect(host_charlist, 443, [
  server_name_indication: host_charlist,
  versions: [:"tlsv1.2"],
  verify: :verify_none
], 10_000)

case result1 do
  {:ok, socket} ->
    IO.puts("✓ SUCCESS: TLS 1.2 connection established!")
    :ssl.close(socket)
  {:error, reason} ->
    IO.puts("✗ FAILED: #{inspect(reason)}")
end
IO.puts("")

# Test 2: TLS 1.2 without SNI
IO.puts("=== Test 2: TLS 1.2 without SNI ===")
result2 = :ssl.connect(host_charlist, 443, [
  versions: [:"tlsv1.2"],
  verify: :verify_none
], 10_000)

case result2 do
  {:ok, socket} ->
    IO.puts("✓ SUCCESS: TLS 1.2 without SNI works!")
    :ssl.close(socket)
  {:error, reason} ->
    IO.puts("✗ FAILED: #{inspect(reason)}")
    IO.puts("  (This is expected - Cloudflare requires SNI)")
end
IO.puts("")

# Test 3: Try hackney directly
IO.puts("=== Test 3: Hackney HTTP Request ===")
url = "https://#{host}/"
hackney_opts = [
  ssl_options: [
    versions: [:"tlsv1.2"],
    server_name_indication: host_charlist,
    verify: :verify_none
  ],
  connect_timeout: 10_000,
  recv_timeout: 10_000
]

case :hackney.request(:get, url, [], "", hackney_opts) do
  {:ok, status, _headers, client} ->
    :hackney.close(client)
    IO.puts("✓ SUCCESS: Hackney connected! Status: #{status}")
  {:error, reason} ->
    IO.puts("✗ FAILED: #{inspect(reason)}")
end
IO.puts("")

IO.puts("=== Tests Complete ===")

