defmodule ClippsterServerWeb.OrganizationAssetController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Organizations
  alias ClippsterServer.Storage

  plug ClippsterServerWeb.AuthPlug

  @doc """
  List all assets for an organization.
  GET /organizations/:organization_id/assets
  Query params: ?asset_type=intro|outro|watermark|audio|image
  """
  def index(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      opts = if params["asset_type"], do: [asset_type: params["asset_type"]], else: []
      assets = Organizations.list_organization_assets(org_id, opts)

      json(conn, %{
        success: true,
        assets: Enum.map(assets, &serialize_asset/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Get a single asset.
  GET /organizations/:organization_id/assets/:id
  """
  def show(conn, %{"organization_id" => org_id, "id" => asset_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      case Organizations.get_organization_asset(org_id, asset_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Asset not found"})

        asset ->
          json(conn, %{
            success: true,
            asset: serialize_asset(asset)
          })
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Upload a new asset to the organization.
  POST /organizations/:organization_id/assets
  Expects multipart form with:
  - file: the asset file
  - asset_type: intro|outro|watermark|audio|image
  - name: optional custom name
  - thumbnail: optional thumbnail image for video assets
  """
  def create(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user
    asset_type = params["asset_type"]

    cond do
      # Check if user is admin
      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can upload assets"})

      # Validate asset_type
      is_nil(asset_type) or not Organizations.OrganizationAsset.valid_asset_type?(asset_type) ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid asset_type. Must be one of: intro, outro, watermark, audio, image, overlay"})

      # Check if R2 is configured
      not Storage.configured?() ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Storage service not configured"})

      # No file provided
      is_nil(params["file"]) ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "No file provided"})

      # All validations passed, process the upload
      true ->
        %Plug.Upload{path: temp_path, filename: filename, content_type: content_type} = params["file"]
        
        case File.read(temp_path) do
          {:ok, file_binary} ->
            # Get custom name or use filename
            name = params["name"] || filename

            # Parse optional metadata
            opts = [
              content_type: content_type,
              duration: parse_decimal(params["duration"]),
              width: parse_integer(params["width"]),
              height: parse_integer(params["height"])
            ]

            # Handle thumbnail if provided
            opts = case params["thumbnail"] do
              %Plug.Upload{path: thumb_path} ->
                case File.read(thumb_path) do
                  {:ok, thumb_binary} -> Keyword.put(opts, :thumbnail_binary, thumb_binary)
                  _ -> opts
                end
              _ -> opts
            end

            case Organizations.create_organization_asset(org_id, user.id, asset_type, file_binary, name, opts) do
              {:ok, asset} ->
                conn
                |> put_status(201)
                |> json(%{
                  success: true,
                  asset: serialize_asset(asset)
                })

              {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
                conn
                |> put_status(422)
                |> json(%{success: false, error: format_changeset_errors(changeset)})

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Upload failed: #{inspect(reason)}"})
            end

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to read uploaded file: #{inspect(reason)}"})
        end
    end
  end

  @doc """
  Update an asset (name only).
  PUT /organizations/:organization_id/assets/:id
  """
  def update(conn, %{"organization_id" => org_id, "id" => asset_id} = params) do
    user = conn.assigns.current_user

    case Organizations.get_organization_asset(org_id, asset_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Asset not found"})

      asset ->
        attrs = Map.take(params, ["name"])

        case Organizations.update_organization_asset(asset, attrs, user) do
          {:ok, updated_asset} ->
            json(conn, %{
              success: true,
              asset: serialize_asset(updated_asset)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can update assets"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_changeset_errors(changeset)})
        end
    end
  end

  @doc """
  Delete an asset.
  DELETE /organizations/:organization_id/assets/:id
  """
  def delete(conn, %{"organization_id" => org_id, "id" => asset_id}) do
    user = conn.assigns.current_user

    case Organizations.delete_organization_asset_by_id(org_id, asset_id, user) do
      {:ok, _deleted} ->
        json(conn, %{success: true})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Asset not found"})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can delete assets"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Delete failed: #{inspect(reason)}"})
    end
  end

  @doc """
  Get all assets for the current user's organizations.
  Used by clients for sync.
  GET /user/organization-assets
  """
  def user_assets(conn, _params) do
    user = conn.assigns.current_user
    
    org_assets = Organizations.get_assets_for_user_organizations(user.id)

    # Transform to list format with org info
    assets_list = Enum.flat_map(org_assets, fn {_org_id, %{organization: org, assets: assets}} ->
      Enum.map(assets, fn asset ->
        serialize_asset(asset)
        |> Map.put(:organization_name, org.name)
      end)
    end)

    json(conn, %{
      success: true,
      assets: assets_list
    })
  end

  # Private helpers

  defp serialize_asset(asset) do
    # Generate presigned URLs for private bucket access (1 hour expiry)
    presigned_url = if asset.url, do: Storage.presigned_url!(asset.url), else: nil
    presigned_thumbnail_url = if asset.thumbnail_url, do: Storage.presigned_url!(asset.thumbnail_url), else: nil
    
    %{
      id: asset.id,
      organization_id: asset.organization_id,
      asset_type: asset.asset_type,
      name: asset.name,
      url: presigned_url,
      thumbnail_url: presigned_thumbnail_url,
      duration: asset.duration && Decimal.to_float(asset.duration),
      width: asset.width,
      height: asset.height,
      file_size: asset.file_size,
      mime_type: asset.mime_type,
      uploaded_by: serialize_uploaded_by(asset),
      inserted_at: asset.inserted_at,
      updated_at: asset.updated_at
    }
  end

  defp serialize_uploaded_by(asset) do
    if Ecto.assoc_loaded?(asset.uploaded_by) and asset.uploaded_by do
      %{
        id: asset.uploaded_by.id,
        name: asset.uploaded_by.name,
        email: asset.uploaded_by.email
      }
    else
      nil
    end
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end

  defp parse_decimal(nil), do: nil
  defp parse_decimal(value) when is_binary(value) do
    case Decimal.parse(value) do
      {decimal, _} -> decimal
      :error -> nil
    end
  end
  defp parse_decimal(value) when is_number(value), do: Decimal.from_float(value / 1)

  defp parse_integer(nil), do: nil
  defp parse_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> nil
    end
  end
  defp parse_integer(value) when is_integer(value), do: value
end

