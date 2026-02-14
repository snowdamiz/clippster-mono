defmodule ClippsterServerWeb.EnsureOrgSubscription do
  @moduledoc """
  Plug that checks if an organization has an active subscription.
  Returns 403 if subscription_status is "none" or "expired".
  "cancelled" still has access until end_date (standard Stripe behavior).

  Grandfathers legacy orgs: orgs created before the migration date with
  subscription_status "none" are exempt.
  """

  import Plug.Conn
  alias ClippsterServer.Organizations

  # Orgs created before this date are grandfathered in
  @legacy_cutoff_date ~U[2026-02-14 00:00:00Z]

  def init(opts), do: opts

  def call(conn, _opts) do
    # Extract organization_id from path params
    org_id = conn.params["id"] || conn.params["organization_id"]

    if is_nil(org_id) do
      # No org ID in route, skip check
      conn
    else
      org_id_int = if is_binary(org_id), do: String.to_integer(org_id), else: org_id

      case Organizations.get_organization(org_id_int) do
        nil ->
          conn

        org ->
          cond do
            # Active or cancelled (still within period) - allow
            org.subscription_status in ["active", "cancelled"] ->
              conn

            # Legacy org - grandfathered
            org.subscription_status == "none" &&
              org.inserted_at &&
              DateTime.compare(org.inserted_at, @legacy_cutoff_date) == :lt ->
              conn

            # No subscription or expired - block
            true ->
              conn
              |> put_status(:forbidden)
              |> Phoenix.Controller.json(%{
                success: false,
                error: "subscription_required",
                message: "An active subscription is required to access this organization"
              })
              |> halt()
          end
      end
    end
  end
end
