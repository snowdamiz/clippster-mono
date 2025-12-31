defmodule ClippsterServer.Waitlist.WaitlistEntry do
  @moduledoc """
  Schema for waitlist entries.
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "waitlist_entries" do
    field :email, :string

    timestamps()
  end

  @doc """
  Changeset for creating a waitlist entry.
  """
  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:email])
    |> validate_required([:email])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "must be a valid email address")
    |> unique_constraint(:email, message: "is already on the waitlist")
  end
end
