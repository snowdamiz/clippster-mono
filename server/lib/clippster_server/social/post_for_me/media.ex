defmodule ClippsterServer.Social.PostForMe.Media do
  @moduledoc """
  Post for Me media upload management.

  Handles creating upload URLs and uploading media files
  for use in social media posts.
  """

  require Logger

  alias ClippsterServer.Social.PostForMe.Client

  @doc """
  Creates a presigned upload URL for media.

  Post for Me returns:
  - `upload_url`: A signed URL to PUT the media file to
  - `media_url`: The URL to reference in post creation

  ## Parameters
    - file_name: Name of the file (e.g., "video.mp4")
    - file_size: Size in bytes
    - content_type: MIME type (e.g., "video/mp4")

  ## Returns
    - {:ok, %{"upload_url" => url, "media_url" => url}}
    - {:error, reason}
  """
  def create_upload_url(file_name, file_size, content_type) do
    body = %{
      "file_name" => file_name,
      "file_size" => file_size,
      "content_type" => content_type
    }

    Client.post("/v1/media/create-upload-url", body)
  end

  @doc """
  Uploads media binary to the presigned upload URL.

  This is a direct PUT to the URL returned by create_upload_url/3,
  NOT through the Post for Me API (goes directly to their storage).

  ## Parameters
    - upload_url: The signed URL from create_upload_url
    - binary: The file binary data
    - content_type: MIME type

  ## Returns
    - :ok
    - {:error, reason}
  """
  def upload_to_url(upload_url, binary, content_type) do
    headers = [
      {"Content-Type", content_type}
    ]

    # Longer timeout for large file uploads
    http_opts = [timeout: 300_000, recv_timeout: 300_000]

    case HTTPoison.put(upload_url, binary, headers, http_opts) do
      {:ok, %HTTPoison.Response{status_code: status}} when status in 200..299 ->
        Logger.info("[PostForMe.Media] Upload successful (#{status})")
        :ok

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        Logger.error("[PostForMe.Media] Upload failed: #{status} - #{body}")
        {:error, %{status: status, message: "Upload failed", body: body}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        Logger.error("[PostForMe.Media] Upload HTTP error: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Convenience function: creates an upload URL and uploads the binary in one step.

  ## Returns
    - {:ok, media_url} - The media URL to use in post creation
    - {:error, reason}
  """
  def upload_media(file_name, binary, content_type) do
    file_size = byte_size(binary)

    with {:ok, %{"upload_url" => upload_url, "media_url" => media_url}} <-
           create_upload_url(file_name, file_size, content_type),
         :ok <- upload_to_url(upload_url, binary, content_type) do
      {:ok, media_url}
    end
  end

  @doc """
  Uploads media from a URL (downloads first, then uploads to PFM).
  Handles R2 presigned URLs for private storage.

  ## Returns
    - {:ok, media_url}
    - {:error, reason}
  """
  def upload_from_url(source_url, file_name \\ "video.mp4", content_type \\ "video/mp4") do
    # Generate presigned URL if it's an R2 storage URL
    accessible_url = maybe_presign_url(source_url)

    # Download the media
    case download_media(accessible_url) do
      {:ok, binary} ->
        upload_media(file_name, binary, content_type)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp maybe_presign_url(url) do
    if String.contains?(url, ".r2.cloudflarestorage.com") do
      case ClippsterServer.Storage.presigned_url(url, expires_in: 7200) do
        {:ok, presigned} ->
          Logger.info("[PostForMe.Media] Generated presigned URL for R2 media")
          presigned

        {:error, _reason} ->
          url
      end
    else
      url
    end
  end

  defp download_media(url) do
    http_opts = [timeout: 120_000, recv_timeout: 120_000, follow_redirect: true]

    case HTTPoison.get(url, [], http_opts) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        {:ok, body}

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, "Download failed with status #{status}"}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, "Download failed: #{inspect(reason)}"}
    end
  end
end
