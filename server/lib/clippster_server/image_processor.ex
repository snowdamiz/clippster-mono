defmodule ClippsterServer.ImageProcessor do
  @moduledoc """
  Handles image processing operations including dimension extraction.
  Note: Client-side already handles compression, so we just pass through the binary.
  """

  @doc """
  Compresses an image to JPEG format with specified quality.
  Since the client already compresses images, we just return the binary as-is.
  Returns {:ok, binary} or {:error, reason}.
  """
  def compress_image(image_binary, _opts \\ []) do
    # Client already compresses images before upload, so just pass through
    {:ok, image_binary}
  end

  @doc """
  Generates a thumbnail from an image.
  Since the client already handles thumbnails, we just return the original image.
  Returns {:ok, binary} or {:error, reason}.
  """
  def generate_thumbnail(image_binary, _opts \\ []) do
    # For now, just use the original image as thumbnail
    # Client can handle thumbnail generation on display
    {:ok, image_binary}
  end

  @doc """
  Extracts image dimensions (width and height) from an image binary.
  Returns {:ok, {width, height}} or {:error, reason}.
  """
  def get_image_dimensions(image_binary) do
    case ExImageInfo.info(image_binary) do
      {_format, width, height, _variant} ->
        {:ok, {width, height}}

      nil ->
        {:error, "Failed to get image dimensions: invalid or unsupported image format"}
    end
  end

  @doc """
  Validates if a file is a valid image based on MIME type.
  """
  def valid_image_type?(mime_type) do
    mime_type in [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp"
    ]
  end

  @doc """
  Processes an uploaded image: validates, compresses, generates thumbnail, and extracts dimensions.
  Returns {:ok, %{compressed: binary, thumbnail: binary, width: integer, height: integer}} or {:error, reason}.
  """
  def process_image(image_binary, mime_type) do
    with true <- valid_image_type?(mime_type),
         {:ok, {width, height}} <- get_image_dimensions(image_binary),
         {:ok, compressed} <- compress_image(image_binary),
         {:ok, thumbnail} <- generate_thumbnail(image_binary) do
      {:ok,
       %{
         compressed: compressed,
         thumbnail: thumbnail,
         width: width,
         height: height
       }}
    else
      false -> {:error, "Invalid image type"}
      {:error, reason} -> {:error, reason}
    end
  end
end
