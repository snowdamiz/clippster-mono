defmodule ClippsterServer.AdminMessaging.EmailSuppression do
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.AdminMessaging.EmailAddress

  schema "email_suppressions" do
    field :email, :string
    field :reason, :string, default: "unsubscribe"
    field :source, :string
    field :suppressed_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @valid_reasons ~w(unsubscribe manual complaint bounce)

  def changeset(suppression, attrs) do
    suppression
    |> cast(attrs, [:email, :reason, :source, :suppressed_at])
    |> normalize_email()
    |> put_suppressed_at()
    |> validate_required([:email, :reason, :suppressed_at])
    |> EmailAddress.validate_email()
    |> validate_inclusion(:reason, @valid_reasons)
    |> unique_constraint(:email, name: :email_suppressions_email_lower_index)
  end

  defp normalize_email(changeset) do
    update_change(changeset, :email, &EmailAddress.normalize/1)
  end

  defp put_suppressed_at(changeset) do
    case get_field(changeset, :suppressed_at) do
      nil ->
        put_change(changeset, :suppressed_at, DateTime.utc_now() |> DateTime.truncate(:second))

      _ ->
        changeset
    end
  end
end
