defmodule ClippsterServer.AI.ImageGenerationPolicy do
  @moduledoc """
  Central model and credit policy for AI image generation.

  Creation and base-image editing are intentionally separate operations. A
  caller cannot opt an edit into the creation model.

  Defaults track ChatGPT Images quality on OpenRouter:
  - create → openai/gpt-image-2.5-sunburst (premium campaign / precision finals)
  - edit → openai/gpt-image-2.5-sunburst (high-fidelity revisions)

  Override with OPENROUTER_IMAGE_CREATE_MODEL / OPENROUTER_IMAGE_EDIT_MODEL.
  """

  @default_creation_model "openai/gpt-image-2.5-sunburst"
  @default_edit_model "openai/gpt-image-2.5-sunburst"
  @creation_credit_cost 4
  @edit_credit_cost 2

  @type operation :: :create | :edit

  @spec resolve(operation(), boolean()) :: %{
          model: String.t(),
          credit_cost: pos_integer(),
          operation: operation()
        }
  def resolve(_requested_operation, true) do
    %{model: edit_model(), credit_cost: @edit_credit_cost, operation: :edit}
  end

  def resolve(:edit, false) do
    %{model: edit_model(), credit_cost: @edit_credit_cost, operation: :edit}
  end

  def resolve(:create, false) do
    %{model: creation_model(), credit_cost: @creation_credit_cost, operation: :create}
  end

  @spec thumbnail_credit_cost(boolean(), boolean()) :: pos_integer()
  def thumbnail_credit_cost(true, _has_base_image), do: 8

  def thumbnail_credit_cost(false, has_base_image) do
    resolve(:create, has_base_image).credit_cost
  end

  @spec creation_model() :: String.t()
  def creation_model do
    case System.get_env("OPENROUTER_IMAGE_CREATE_MODEL") do
      value when is_binary(value) and value != "" -> value
      _ -> @default_creation_model
    end
  end

  @spec edit_model() :: String.t()
  def edit_model do
    case System.get_env("OPENROUTER_IMAGE_EDIT_MODEL") do
      value when is_binary(value) and value != "" -> value
      _ -> @default_edit_model
    end
  end
end
