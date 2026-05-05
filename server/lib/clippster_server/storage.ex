defmodule ClippsterServer.Storage do
  @moduledoc """
  Cloudflare R2 storage module for organization assets.
  R2 is S3-compatible, so we use ex_aws_s3.
  """

  require Logger

  @doc """
  Returns the ExAws configuration for R2.
  Note: Hackney SSL options are configured globally in runtime.exs
  """
  def config do
    account_id = Application.get_env(:clippster_server, :r2)[:account_id]

    [
      access_key_id: Application.get_env(:clippster_server, :r2)[:access_key_id],
      secret_access_key: Application.get_env(:clippster_server, :r2)[:secret_access_key],
      scheme: "https://",
      host: "#{account_id}.r2.cloudflarestorage.com",
      port: 443,
      region: "auto"
    ]
  end

  @doc """
  Returns the bucket name from configuration.
  """
  def bucket do
    Application.get_env(:clippster_server, :r2)[:bucket_name] || "clippster-org-assets"
  end

  @doc """
  Returns the public URL base for R2 assets.
  """
  def public_url_base do
    case Application.get_env(:clippster_server, :r2)[:public_url] do
      value when is_binary(value) ->
        value
        |> String.trim()
        |> case do
          "" -> nil
          trimmed -> trimmed
        end

      value ->
        value
    end
  end

  @doc """
  Uploads a file to R2 storage.

  Returns {:ok, url} on success or {:error, reason} on failure.
  """
  def upload_file(file_binary, key, opts \\ []) do
    content_type = Keyword.get(opts, :content_type, "application/octet-stream")
    byte_size = byte_size(file_binary)

    Logger.info(
      "[Storage] Uploading file to R2 key=#{key} content_type=#{content_type} bytes=#{byte_size}"
    )

    case do_upload(file_binary, key, content_type, byte_size) do
      {:ok, _response} ->
        url = build_public_url(key)
        Logger.info("[Storage] R2 upload succeeded for key=#{key}")
        {:ok, url}

      {:error, reason} ->
        Logger.error("[Storage] R2 upload failed for key=#{key}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Uploads a file from a local path to R2 storage.
  """
  def upload_file_from_path(file_path, key, opts \\ []) do
    case File.read(file_path) do
      {:ok, binary} ->
        upload_file(binary, key, opts)

      {:error, reason} ->
        {:error, {:file_read_error, reason}}
    end
  end

  @doc """
  Deletes a file from R2 storage by its key.
  """
  def delete_file(key) do
    request = ExAws.S3.delete_object(bucket(), key)

    case ExAws.request(request, config()) do
      {:ok, _response} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Deletes a file from R2 storage by its full URL.
  Extracts the key from the URL and deletes.
  """
  def delete_file_by_url(url) do
    case extract_key_from_url(url) do
      {:ok, key} -> delete_file(key)
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Generates a presigned URL for uploading a file directly to R2.

  Returns {:ok, %{upload_url: presigned_url, media_url: public_url}} on success.
  The upload_url is used for the PUT request, media_url is the final public URL.
  """
  def generate_presigned_upload_url(key, opts \\ []) do
    # 10 minutes default
    expires_in = Keyword.get(opts, :expires_in, 600)
    content_type = Keyword.get(opts, :content_type, "video/mp4")

    # Convert keyword list to map for ExAws.S3.presigned_url
    config_map = config() |> Enum.into(%{})

    # Generate presigned URL for PUT operation
    case ExAws.S3.presigned_url(config_map, :put, bucket(), key,
           expires_in: expires_in,
           query_params: [{"Content-Type", content_type}]
         ) do
      {:ok, presigned_url} ->
        public_url = build_public_url(key)
        {:ok, %{upload_url: presigned_url, media_url: public_url}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Generates a unique storage key for an asset.
  Format: org-assets/{org_id}/{asset_type}/{timestamp}_{filename}
  """
  def generate_key(organization_id, asset_type, filename) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    sanitized_filename = sanitize_filename(filename)
    "org-assets/#{organization_id}/#{asset_type}/#{timestamp}_#{sanitized_filename}"
  end

  @doc """
  Generates a key for asset thumbnails.
  """
  def generate_thumbnail_key(organization_id, asset_type, filename) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    sanitized_filename = sanitize_filename(filename)
    "org-assets/#{organization_id}/#{asset_type}/thumbnails/#{timestamp}_#{sanitized_filename}"
  end

  @doc """
  Generates a unique storage key for a message attachment.
  Format: messaging/{org_id}/{conversation_id}/{timestamp}_{filename}
  """
  def generate_message_attachment_key(organization_id, conversation_id, filename, type \\ "full") do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    sanitized_filename = sanitize_filename(filename)

    case type do
      "thumbnail" ->
        "messaging/#{organization_id}/#{conversation_id}/thumbnails/#{timestamp}_#{sanitized_filename}"

      _ ->
        "messaging/#{organization_id}/#{conversation_id}/#{timestamp}_#{sanitized_filename}"
    end
  end

  @doc """
  Checks if R2 storage is properly configured.
  """
  def configured? do
    r2_config = Application.get_env(:clippster_server, :r2) || []

    Keyword.get(r2_config, :account_id) != nil and
      Keyword.get(r2_config, :access_key_id) != nil and
      Keyword.get(r2_config, :secret_access_key) != nil
  end

  defp upload_config do
    hackney_opts =
      Application.get_env(:ex_aws, :hackney_opts, [])
      |> Keyword.merge(
        connect_timeout: 120_000,
        recv_timeout: 300_000
      )

    config()
    |> Keyword.put(:hackney_opts, hackney_opts)
  end

  # Multipart upload threshold: 8MB
  @multipart_threshold 8 * 1024 * 1024
  # Multipart chunk size: 8MB
  @multipart_chunk_size 8 * 1024 * 1024

  defp do_upload(file_binary, key, content_type, byte_size)
       when byte_size >= @multipart_threshold do
    Logger.info("[Storage] Using multipart R2 upload for key=#{key}")

    file_binary
    |> chunk_binary(@multipart_chunk_size)
    |> ExAws.S3.upload(bucket(), key,
      content_type: content_type,
      acl: :public_read,
      max_concurrency: 4,
      timeout: 120_000
    )
    |> ExAws.request(upload_config())
  end

  defp do_upload(file_binary, key, content_type, _byte_size) do
    key
    |> put_object_request(file_binary, content_type)
    |> ExAws.request(upload_config())
  end

  defp put_object_request(key, file_binary, content_type) do
    ExAws.S3.put_object(bucket(), key, file_binary,
      content_type: content_type,
      acl: :public_read
    )
  end

  defp chunk_binary(binary, chunk_size) do
    Stream.unfold(binary, fn
      <<>> ->
        nil

      remaining ->
        current_size = min(byte_size(remaining), chunk_size)
        <<chunk::binary-size(current_size), rest::binary>> = remaining
        {chunk, rest}
    end)
  end

  @doc """
  Generates a presigned URL for accessing a private asset.

  Takes either a storage key or a full URL (from which the key is extracted).
  Default expiration is 1 hour (3600 seconds).

  Returns {:ok, presigned_url} or {:error, reason}.
  """
  def presigned_url(key_or_url, opts \\ []) do
    expires_in = Keyword.get(opts, :expires_in, 3600)

    # Extract key if a full URL was provided
    key =
      case extract_key_from_url(key_or_url) do
        {:ok, extracted_key} -> extracted_key
        # Assume it's already a key
        {:error, _} -> key_or_url
      end

    # Build the config for presigned URL generation (must be a map, not keyword list)
    presign_config =
      config()
      |> Keyword.put(:virtual_host, false)
      |> Map.new()

    case ExAws.S3.presigned_url(presign_config, :get, bucket(), key, expires_in: expires_in) do
      {:ok, url} -> {:ok, url}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Generates a presigned URL, returning nil on error.
  Convenient for use in serialization where we don't want to crash.
  """
  def presigned_url!(key_or_url, opts \\ []) do
    case presigned_url(key_or_url, opts) do
      {:ok, url} -> url
      {:error, _} -> nil
    end
  end

  @doc """
  Extracts the storage key from a full URL.
  Works with both public URLs and native R2 URLs.
  """
  def extract_key_from_url(url) do
    base = public_url_base()

    cond do
      base && String.starts_with?(url, base) ->
        key = String.replace_prefix(url, String.trim_trailing(base, "/") <> "/", "")
        {:ok, key}

      String.contains?(url, ".r2.cloudflarestorage.com/") ->
        # Extract key from native R2 URL - handle both formats:
        # 1. https://bucket.account.r2.cloudflarestorage.com/key
        # 2. https://account.r2.cloudflarestorage.com/bucket/key
        case String.split(url, ".r2.cloudflarestorage.com/", parts: 2) do
          [_prefix, path] ->
            # Check if the path starts with the bucket name
            bucket_name = bucket()

            key =
              if String.starts_with?(path, bucket_name <> "/") do
                String.replace_prefix(path, bucket_name <> "/", "")
              else
                path
              end

            {:ok, key}

          _ ->
            {:error, :invalid_url_format}
        end

      true ->
        {:error, :invalid_url_format}
    end
  end

  # Private functions

  defp build_public_url(key) do
    base = public_url_base()

    if base do
      "#{String.trim_trailing(base, "/")}/#{key}"
    else
      # Fallback to R2 native URL format (requires public bucket)
      account_id = Application.get_env(:clippster_server, :r2)[:account_id]
      "https://#{bucket()}.#{account_id}.r2.cloudflarestorage.com/#{key}"
    end
  end

  defp sanitize_filename(filename) do
    filename
    |> String.replace(~r/[^\w\-\.]/, "_")
    |> String.slice(0, 100)
  end
end
