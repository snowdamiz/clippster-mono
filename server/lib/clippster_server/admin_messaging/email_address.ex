defmodule ClippsterServer.AdminMessaging.EmailAddress do
  @moduledoc false

  import Ecto.Changeset

  @max_length 254
  @email_regex ~r/^[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i

  def normalize(email) do
    email
    |> to_string()
    |> String.trim()
    |> String.downcase()
  end

  def valid?(email) when is_binary(email) do
    String.length(email) <= @max_length and Regex.match?(@email_regex, email)
  end

  def valid?(_), do: false

  def validate_email(changeset, field \\ :email) do
    validate_change(changeset, field, fn ^field, value ->
      if valid?(value), do: [], else: [{field, "must be a valid email address"}]
    end)
  end
end
