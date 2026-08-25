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
    if skip_enforcement?() do
      conn
    else
      do_call(conn)
    end
  end

  defp do_call(conn) do
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

  defp skip_enforcement? do
    Application.get_env(:clippster_server, :enforce_org_subscription, true) == false
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
          # Admin-provisioned org with a positive price that the owner has not yet
          # paid: block ALL users (including the owner) from dashboard API routes.
          # Only the bare org-show GET and subscription/payment paths are allowed
          # so the OrganizationSetupDialog can display plan details and redirect
          # to Stripe. The client-side layout (isReady + showSetupDialog) also
          # prevents the hub from rendering, but this server gate is the hard wall.
          admin_billing_setup_pending?(org) && !setup_allowed_path?(conn) ->
            conn
            |> put_status(:forbidden)
            |> Phoenix.Controller.json(%{
              success: false,
              error: "payment_setup_required",
              message: "Complete organization billing setup before accessing this resource."
            })
            |> halt()

          # Organization admins/owners can always access org routes once setup
          # is complete (or if it was free / not required).
          org_admin?(conn, org_id_int) ->
            conn

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
              message:
                "An active subscription is required. Ask an organization admin to purchase in the Clippster desktop app."
            })
            |> halt()
        end
    end
  end

  defp admin_billing_setup_pending?(org) do
    not is_nil(org.created_by_admin_id) &&
      org.setup_completed != true &&
      (org.admin_price_cents || 0) > 0
  end

  # Paths allowed before Stripe setup is complete:
  #   1. Subscription/payment-related segments (checkout, payments, etc.)
  #   2. GET /api/organizations/:id — bare org show, needed by the setup dialog
  #      to display plan name, price, seat count, and credits.
  defp setup_allowed_path?(conn) do
    exempt_path?(conn.request_path) or org_show_request?(conn)
  end

  defp org_show_request?(conn) do
    conn.method == "GET" and
      match?(
        ["api", "organizations", _id],
        conn.request_path |> String.split("/", trim: true) |> Enum.reject(&(&1 == ""))
      )
  end

  defp org_admin?(conn, org_id) do
    case conn.assigns[:current_user] do
      %{is_admin: true} ->
        true

      %{id: user_id} when is_integer(user_id) ->
        Organizations.is_admin?(org_id, user_id)

      _ ->
        false
    end
  end
end
