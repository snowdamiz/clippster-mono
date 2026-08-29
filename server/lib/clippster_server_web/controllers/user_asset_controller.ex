defmodule ClippsterServerWeb.UserAssetController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.UserBranding
  alias ClippsterServer.Accounts.UserAsset
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  def index(conn, params) do
    user = conn.assigns.current_user
    opts = if params["asset_type"], do: [asset_type: params["asset_type"]], else: []
    assets = UserBranding.list_user_assets(user.id, opts)

    json(conn, %{
      success: true,
      assets: Enum.map(assets, &serialize_asset/1)
    })
  end

  def show(conn, %{"id" => asset_id}) do
    user = conn.assigns.current_user

    case UserBranding.get_user_asset(user.id, asset_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Asset not found"})

      asset ->
        json(conn, %{success: true, asset: serialize_asset(asset)})
    end
  end

  def create(conn, params) do
    user = conn.assigns.current_user
    asset_type = params["asset_type"]

    cond do
      is_nil(asset_type) or not UserAsset.valid_asset_type?(asset_type) ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "Invalid asset_type. Must be one of: #{Enum.join(UserAsset.asset_types(), ", ")}"
        })

      not Storage.configured?() ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Storage service not configured"})

      is_nil(params["file"]) ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "No file provided"})

      true ->
        %Plug.Upload{path: temp_path, filename: filename, content_type: content_type} =
          params["file"]

        case File.read(temp_path) do
          {:ok, file_binary} ->
            name = params["name"] || filename

            opts = [
              content_type: content_type,
              duration: parse_decimal(params["duration"]),
              width: parse_integer(params["width"]),
              height: parse_integer(params["height"])
            ]

            opts =
              case params["thumbnail"] do
                %Plug.Upload{path: thumb_path} ->
                  case File.read(thumb_path) do
                    {:ok, thumb_binary} -> Keyword.put(opts, :thumbnail_binary, thumb_binary)
                    _ -> opts
                  end

                _ ->
                  opts
              end

            case UserBranding.create_user_asset(user.id, asset_type, file_binary, name, opts) do
              {:ok, asset} ->
                conn
                |> put_status(201)
                |> json(%{success: true, asset: serialize_asset(asset)})

              {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
                conn
                |> put_status(422)
                |> json(%{success: false, error: "Validation failed", details: changeset_errors(changeset)})

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Upload failed: #{inspect(reason)}"})
            end

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to read upload: #{inspect(reason)}"})
        end
    end
  end

  def update(conn, %{"id" => asset_id} = params) do
    user = conn.assigns.current_user

    case UserBranding.get_user_asset(user.id, asset_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Asset not found"})

      asset ->
        case UserBranding.update_user_asset(asset, Map.take(params, ["name"])) do
          {:ok, updated} ->
            json(conn, %{success: true, asset: serialize_asset(updated)})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: "Validation failed", details: changeset_errors(changeset)})
        end
    end
  end

  def delete(conn, %{"id" => asset_id}) do
    user = conn.assigns.current_user

    case UserBranding.get_user_asset(user.id, asset_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Asset not found"})

      asset ->
        case UserBranding.delete_user_asset(asset) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Delete failed: #{inspect(reason)}"})
        end
    end
  end

  defp serialize_asset(asset) do
    %{
      id: asset.id,
      user_id: asset.user_id,
      asset_type: asset.asset_type,
      name: asset.name,
      url: if(asset.url, do: Storage.presigned_url!(asset.url), else: nil),
      thumbnail_url:
        if(asset.thumbnail_url, do: Storage.presigned_url!(asset.thumbnail_url), else: nil),
      duration: asset.duration && Decimal.to_float(asset.duration),
      width: asset.width,
      height: asset.height,
      file_size: asset.file_size,
      mime_type: asset.mime_type,
      content_hash: asset.content_hash,
      inserted_at: asset.inserted_at,
      updated_at: asset.updated_at
    }
  end

  defp parse_integer(nil), do: nil
  defp parse_integer(value) when is_integer(value), do: value

  defp parse_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {n, _} -> n
      :error -> nil
    end
  end

  defp parse_decimal(nil), do: nil
  defp parse_decimal(%Decimal{} = value), do: value

  defp parse_decimal(value) when is_binary(value) do
    case Decimal.parse(value) do
      {dec, _} -> dec
      :error -> nil
    end
  end

  defp parse_decimal(value) when is_number(value), do: Decimal.new(value)

  defp changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
