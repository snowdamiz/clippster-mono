defmodule ClippsterServer.Social.PublishingProvider do
  @moduledoc """
  Strict provider routing shared by immediate and scheduled publishing paths.
  """

  alias ClippsterServer.Tokend.Publisher

  @supported_providers ~w(post_for_me tokend)

  @spec supported_providers() :: [String.t()]
  def supported_providers, do: @supported_providers

  @spec route(map()) :: {:ok, :post_for_me | :tokend} | {:error, atom()}
  def route(%{provider: "post_for_me", platform: "tokend"}),
    do: {:error, :native_provider_required}

  def route(%{provider: "post_for_me"}), do: {:ok, :post_for_me}

  def route(%{provider: "tokend"} = account) do
    with :ok <- Publisher.validate_account(account), do: {:ok, :tokend}
  end

  def route(%{provider: provider}) when provider in [nil, ""],
    do: {:error, :missing_provider}

  def route(_), do: {:error, :unsupported_provider}

  @spec dispatch(map(), (-> term()), (-> term())) :: term()
  def dispatch(account, post_for_me_fun, tokend_fun)
      when is_function(post_for_me_fun, 0) and is_function(tokend_fun, 0) do
    case route(account) do
      {:ok, :post_for_me} -> post_for_me_fun.()
      {:ok, :tokend} -> tokend_fun.()
      {:error, _} = error -> error
    end
  end

  @spec ensure_post_for_me_platform(term()) :: :ok | {:error, :native_provider_required}
  def ensure_post_for_me_platform("tokend"), do: {:error, :native_provider_required}
  def ensure_post_for_me_platform(_), do: :ok
end
