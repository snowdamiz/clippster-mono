defmodule ClippsterServer.ImageProcessor do
  @moduledoc """
  Handles image processing operations including compression, thumbnail generation,
  and dimension extraction using Mogrify.
  """

  @thumbnail_size 200
  @jpeg_quality 85

  @doc """
  Compresses an image to JPEG format with specified quality.
  Returns {:ok, binary} or {:error, reason}.
  """
  def compress_image(image_binary, opts \\ []) do
    quality = Keyword.get(opts, :quality, @jpeg_quality)

    try do
      result =
        Mogrify.open(image_binary)
        |> Mogrify.format("jpg")
        |> Mogrify.quality(to_string(quality))
        |> Mogrify.auto_orient()
        |> Mogrify.save(in_place: true)

      {:ok, File.read!(result.path)}
    rescue
      error -> {:error, "Failed to compress image: #{inspect(error)}"}
    end
  end

  @doc """
  Generates a thumbnail from an image.
  Creates a 200x200 thumbnail maintaining aspect ratio with center crop.
  Returns {:ok, binary} or {:error, reason}.
  """
  def generate_thumbnail(image_binary, opts \\ []) do
    size = Keyword.get(opts, :size, @thumbnail_size)

    try do
      result =
        Mogrify.open(image_binary)
        |> Mogrify.format("jpg")
        |> Mogrify.resize_to_fill("#{size}x#{size}")
        |> Mogrify.quality(to_string(@jpeg_quality))
        |> Mogrify.auto_orient()
        |> Mogrify.save(in_place: true)

      {:ok, File.read!(result.path)}
    rescue
      error -> {:error, "Failed to generate thumbnail: #{inspect(error)}"}
    end
  end

  @doc """
  Extracts image dimensions (width and height) from an image binary.
  Returns {:ok, {width, height}} or {:error, reason}.
  """
  def get_image_dimensions(image_binary) do
    try do
      image = Mogrify.open(image_binary) |> Mogrify.verbose()
      
      case {image.width, image.height} do
        {nil, _} -> {:error, "Could not determine image width"}
        {_, nil} -> {:error, "Could not determine image height"}
        {width, height} ->
          {:ok, {String.to_integer(width), String.to_integer(height)}}
      end
    rescue
      error -> {:error, "Failed to get image dimensions: #{inspect(error)}"}
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
      {:ok, %{
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
