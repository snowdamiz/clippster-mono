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

  # Subscription-related path segments that must remain accessible
  # so orgs can actually subscribe, view tiers, validate promos, etc.
  @exempt_segments ["subscription", "tiers", "checkout", "promo", "payments"]

  def call(conn, _opts) do
    case extract_org_id(conn) do
      nil ->
        # Not an org-scoped route, skip
        conn

      org_id ->
        if exempt_path?(conn.request_path) do
          # Subscription-related endpoint, allow through
          conn
        else
          check_subscription(conn, org_id)
        end
    end
  end

  # Only extract org ID from paths that are actually org-scoped.
  # Matches /api/organizations/:id/... and /api/organizations/:organization_id/...
  defp extract_org_id(conn) do
    path = conn.request_path

    cond do
      String.contains?(path, "/organizations/") ->
        # Use organization_id param first (most org routes), fall back to id
        # (routes like /organizations/:id/subscription use :id)
        conn.params["organization_id"] || conn.params["id"]

      true ->
        nil
    end
  end

  defp exempt_path?(path) do
    segments = String.split(path, "/")
    Enum.any?(@exempt_segments, fn seg -> seg in segments end)
  end

  defp check_subscription(conn, org_id) do
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
