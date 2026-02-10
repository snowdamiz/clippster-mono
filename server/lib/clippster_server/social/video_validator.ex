defmodule ClippsterServer.Social.VideoValidator do
  @moduledoc """
  Video format validation for X (Twitter) uploads.

  Validates video binary and metadata before upload to avoid wasting bandwidth
  on invalid videos. Checks file size, extension, and duration against X API limits.

  Basic validation only - X API will reject invalid codecs during processing
  and we handle that in the STATUS polling.
  """

  require Logger

  @default_max_size 512 * 1024 * 1024  # 512MB for non-premium accounts
  @default_max_duration 140  # 140 seconds for standard X accounts
  @allowed_extensions [".mp4", ".mov"]

  @doc """
  Validates video binary and metadata before upload.

  Returns `:ok` if validation passes, or `{:error, {:validation_failed, reason_string}}` otherwise.

  ## Options

  - `:max_size` - Maximum file size in bytes (default: 512MB)
  - `:max_duration` - Maximum duration in seconds (default: 140s)
  - `:filename` - Original filename for extension validation

  ## Examples

      iex> VideoValidator.validate(<<>>, [])
      {:error, {:validation_failed, "Video file is empty"}}

      iex> VideoValidator.validate(:crypto.strong_rand_bytes(1000), filename: "test.mp4")
      :ok

      iex> large_video = :crypto.strong_rand_bytes(600 * 1024 * 1024)
      iex> VideoValidator.validate(large_video, [])
      {:error, {:validation_failed, "Video exceeds 512MB size limit (got 572MB)"}}
  """
  def validate(video_binary, opts \\ []) do
    max_size = opts[:max_size] || @default_max_size
    max_duration = opts[:max_duration] || @default_max_duration
    filename = opts[:filename]

    with :ok <- validate_not_empty(video_binary),
         :ok <- validate_size(video_binary, max_size),
         :ok <- validate_extension(filename),
         :ok <- validate_duration(opts[:duration_seconds], max_duration) do
      Logger.debug("[VideoValidator] Validation passed for #{byte_size(video_binary)} byte video")
      :ok
    end
  end

  @doc """
  Convenience function to validate a file from disk.

  Reads the file, extracts the filename, and calls `validate/2`.

  ## Examples

      iex> VideoValidator.validate_file("/path/to/video.mp4", [])
      :ok
  """
  def validate_file(file_path, opts \\ []) do
    case File.read(file_path) do
      {:ok, video_binary} ->
        filename = Path.basename(file_path)
        opts_with_filename = Keyword.put(opts, :filename, filename)
        validate(video_binary, opts_with_filename)

      {:error, reason} ->
        {:error, {:validation_failed, "Failed to read file: #{inspect(reason)}"}}
    end
  end

  # Private validation functions

  defp validate_not_empty(video_binary) do
    case byte_size(video_binary) do
      0 -> {:error, {:validation_failed, "Video file is empty"}}
      _ -> :ok
    end
  end

  defp validate_size(video_binary, max_size) do
    size = byte_size(video_binary)

    if size > max_size do
      size_mb = Float.round(size / (1024 * 1024), 0) |> trunc()
      max_mb = trunc(max_size / (1024 * 1024))
      {:error, {:validation_failed, "Video exceeds #{max_mb}MB size limit (got #{size_mb}MB)"}}
    else
      :ok
    end
  end

  defp validate_extension(nil) do
    # No filename provided, skip extension check (binary-only upload)
    :ok
  end

  defp validate_extension(filename) when is_binary(filename) do
    extension = Path.extname(filename) |> String.downcase()

    if extension in @allowed_extensions do
      :ok
    else
      supported = @allowed_extensions |> Enum.map(&String.upcase(String.trim_leading(&1, "."))) |> Enum.join(", ")
      {:error, {:validation_failed, "Unsupported video format: #{extension}. Supported: #{supported}"}}
    end
  end

  defp validate_duration(nil, _max_duration) do
    # No duration provided, skip duration check (will be validated by X during processing)
    :ok
  end

  defp validate_duration(duration_seconds, max_duration) when is_number(duration_seconds) do
    if duration_seconds > max_duration do
      {:error, {:validation_failed, "Video exceeds #{max_duration} second limit (got #{duration_seconds}s)"}}
    else
      :ok
    end
  end

  defp validate_duration(_invalid_duration, _max_duration) do
    # Invalid duration format, skip check
    :ok
  end
end
