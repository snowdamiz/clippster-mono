defmodule ClippsterServer.LemonSqueezy do
  @moduledoc """
  Context module for LemonSqueezy payment integration.
  Handles checkout creation, discount management, and webhook verification.
  """
  require Logger

  @base_url "https://api.lemonsqueezy.com/v1"

  # ============================================================================
  # Configuration Helpers
  # ============================================================================

  defp config do
    Application.get_env(:clippster_server, :lemonsqueezy, [])
  end

  defp api_key, do: Keyword.get(config(), :api_key)
  defp store_id, do: Keyword.get(config(), :store_id)
  defp webhook_secret, do: Keyword.get(config(), :webhook_secret)

  @doc """
  Check if LemonSqueezy is configured (API key and store ID are present).
  """
  def configured? do
    !is_nil(api_key()) && !is_nil(store_id())
  end

  @doc """
  Get the LemonSqueezy variant ID for a subscription tier.
  """
  def get_variant_id(tier) when is_binary(tier) do
    key = String.to_atom("variant_#{tier}")
    Keyword.get(config(), key)
  end

  # ============================================================================
  # Checkout Creation
  # ============================================================================

  @doc """
  Creates a LemonSqueezy checkout session for a subscription.

  Options:
    - :discount_code - Promo code to apply at checkout
    - :success_url - Override success redirect URL
    - :cancel_url - Override cancel redirect URL

  Returns {:ok, %{url: checkout_url}} or {:error, reason}.
  """
  def create_checkout(user_id, tier, opts \\ []) do
    variant_id = get_variant_id(tier)

    unless variant_id do
      {:error, :no_variant_configured}
    else
      store = store_id()
      discount_code = Keyword.get(opts, :discount_code)
      success_url = Keyword.get(opts, :success_url, Keyword.get(config(), :success_url))
      cancel_url = Keyword.get(opts, :cancel_url, Keyword.get(config(), :cancel_url))

      body = %{
        data: %{
          type: "checkouts",
          attributes: %{
            checkout_data: %{
              custom: %{
                user_id: to_string(user_id),
                tier: tier
              },
              discount_code: discount_code
            },
            product_options: %{
              redirect_url: success_url
            },
            checkout_options: %{
              embed: false
            }
          },
          relationships: %{
            store: %{
              data: %{
                type: "stores",
                id: to_string(store)
              }
            },
            variant: %{
              data: %{
                type: "variants",
                id: to_string(variant_id)
              }
            }
          }
        }
      }

      # Remove nil discount_code from payload
      body =
        if is_nil(discount_code) do
          update_in(body, [:data, :attributes, :checkout_data], &Map.delete(&1, :discount_code))
        else
          body
        end

      case api_request(:post, "/checkouts", body) do
        {:ok, %{"data" => %{"attributes" => %{"url" => url}}}} ->
          Logger.info("[LemonSqueezy] Created checkout for user #{user_id}, tier: #{tier}")
          {:ok, %{url: url}}

        {:ok, response} ->
          Logger.error("[LemonSqueezy] Unexpected checkout response: #{inspect(response)}")
          {:error, :unexpected_response}

        {:error, reason} ->
          Logger.error("[LemonSqueezy] Failed to create checkout: #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  @doc """
  Creates a LemonSqueezy checkout session for an organization subscription or add-on.

  Options:
    - :discount_code - Promo code to apply at checkout
    - :success_url - Override success redirect URL
    - :cancel_url - Override cancel redirect URL

  Returns {:ok, %{url: checkout_url}} or {:error, reason}.
  """
  def create_org_checkout(organization_id, tier, subscription_type, user_email, opts \\ []) do
    variant_id = get_variant_id(tier)

    unless variant_id do
      {:error, :no_variant_configured}
    else
      store = store_id()
      discount_code = Keyword.get(opts, :discount_code)
      success_url = Keyword.get(opts, :success_url, Keyword.get(config(), :success_url))
      cancel_url = Keyword.get(opts, :cancel_url, Keyword.get(config(), :cancel_url))

      body = %{
        data: %{
          type: "checkouts",
          attributes: %{
            checkout_data: %{
              email: user_email,
              custom: %{
                organization_id: to_string(organization_id),
                tier: tier,
                subscription_type: to_string(subscription_type)
              },
              discount_code: discount_code
            },
            product_options: %{
              redirect_url: success_url
            },
            checkout_options: %{
              embed: false
            }
          },
          relationships: %{
            store: %{
              data: %{
                type: "stores",
                id: to_string(store)
              }
            },
            variant: %{
              data: %{
                type: "variants",
                id: to_string(variant_id)
              }
            }
          }
        }
      }

      # Remove nil discount_code from payload
      body =
        if is_nil(discount_code) do
          update_in(body, [:data, :attributes, :checkout_data], &Map.delete(&1, :discount_code))
        else
          body
        end

      case api_request(:post, "/checkouts", body) do
        {:ok, %{"data" => %{"attributes" => %{"url" => url}}}} ->
          Logger.info("[LemonSqueezy] Created org checkout for org #{organization_id}, tier: #{tier}, type: #{subscription_type}")
          {:ok, %{url: url}}

        {:ok, response} ->
          Logger.error("[LemonSqueezy] Unexpected checkout response: #{inspect(response)}")
          {:error, :unexpected_response}

        {:error, reason} ->
          Logger.error("[LemonSqueezy] Failed to create org checkout: #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  # ============================================================================
  # Discount Management
  # ============================================================================

  @doc """
  Creates a discount in LemonSqueezy store.
  Used to sync promo codes from the admin system to LemonSqueezy.

  Returns {:ok, discount_id} or {:error, reason}.
  """
  def create_discount(percent_off, code, duration_kind, opts \\ []) do
    store = store_id()
    max_redemptions = Keyword.get(opts, :max_redemptions)
    expires_at = Keyword.get(opts, :expires_at)

    # Map our duration_kind to LemonSqueezy's duration
    ls_duration = case duration_kind do
      "once" -> "once"
      "repeating" -> "repeating"
      "forever" -> "forever"
      _ -> "once"
    end

    attrs = %{
      name: code,
      code: code,
      amount: percent_off,
      amount_type: "percent",
      duration: ls_duration,
      is_limited_to_products: false,
      is_limited_redemptions: !is_nil(max_redemptions)
    }

    attrs = if max_redemptions, do: Map.put(attrs, :max_redemptions, max_redemptions), else: attrs

    attrs =
      if duration_kind == "repeating" do
        duration_months = Keyword.get(opts, :duration_months, 1)
        Map.put(attrs, :duration_in_months, duration_months)
      else
        attrs
      end

    attrs =
      if expires_at do
        Map.put(attrs, :expires_at, DateTime.to_iso8601(expires_at))
      else
        attrs
      end

    body = %{
      data: %{
        type: "discounts",
        attributes: attrs,
        relationships: %{
          store: %{
            data: %{
              type: "stores",
              id: to_string(store)
            }
          }
        }
      }
    }

    case api_request(:post, "/discounts", body) do
      {:ok, %{"data" => %{"id" => discount_id}}} ->
        Logger.info("[LemonSqueezy] Created discount '#{code}' with id #{discount_id}")
        {:ok, discount_id}

      {:ok, response} ->
        Logger.error("[LemonSqueezy] Unexpected discount response: #{inspect(response)}")
        {:error, :unexpected_response}

      {:error, reason} ->
        Logger.error("[LemonSqueezy] Failed to create discount: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Deletes (deactivates) a discount in LemonSqueezy.
  LemonSqueezy doesn't have an activate/deactivate toggle, so we delete and recreate.
  Returns :ok or {:error, reason}.
  """
  def delete_discount(discount_id) do
    case api_request(:delete, "/discounts/#{discount_id}", nil) do
      {:ok, _} ->
        Logger.info("[LemonSqueezy] Deleted discount #{discount_id}")
        :ok

      {:error, reason} ->
        Logger.error("[LemonSqueezy] Failed to delete discount #{discount_id}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  # ============================================================================
  # Webhook Verification
  # ============================================================================

  @doc """
  Verifies a LemonSqueezy webhook signature.
  The signature is an HMAC-SHA256 hex digest of the raw request body.
  """
  def verify_webhook_signature(payload, signature) do
    secret = webhook_secret()

    if is_nil(secret) do
      Logger.error("[LemonSqueezy] Webhook secret not configured")
      false
    else
      expected = :crypto.mac(:hmac, :sha256, secret, payload) |> Base.encode16(case: :lower)
      Plug.Crypto.secure_compare(expected, String.downcase(signature))
    end
  end

  # ============================================================================
  # Private HTTP Client
  # ============================================================================

  defp api_request(method, path, body) do
    url = @base_url <> path

    headers = [
      {"Authorization", "Bearer #{api_key()}"},
      {"Accept", "application/vnd.api+json"},
      {"Content-Type", "application/vnd.api+json"}
    ]

    req_opts = [headers: headers]
    req_opts = if body, do: Keyword.put(req_opts, :json, body), else: req_opts

    case Req.request(Keyword.merge(req_opts, method: method, url: url)) do
      {:ok, %Req.Response{status: status, body: response_body}}
      when status in 200..299 ->
        {:ok, response_body}

      {:ok, %Req.Response{status: 204}} ->
        {:ok, nil}

      {:ok, %Req.Response{status: status, body: response_body}} ->
        Logger.error("[LemonSqueezy] API error #{status}: #{inspect(response_body)}")
        {:error, "API error: #{status}"}

      {:error, exception} ->
        Logger.error("[LemonSqueezy] Request failed: #{inspect(exception)}")
        {:error, "Request failed: #{inspect(exception)}"}
    end
  end
end
