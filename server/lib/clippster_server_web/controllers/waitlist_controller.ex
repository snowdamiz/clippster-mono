defmodule ClippsterServerWeb.WaitlistController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Waitlist

  @doc """
  Public endpoint to join the waitlist.
  """
  def create(conn, %{"email" => email}) do
    case Waitlist.create_entry(%{email: email}) do
      {:ok, entry} ->
        conn
        |> put_status(:created)
        |> json(%{
          success: true,
          message: "You've been added to the waitlist!",
          email: entry.email
        })

      {:error, changeset} ->
        errors = format_errors(changeset)

        # Check if it's a duplicate email error
        if Keyword.has_key?(errors, :email) &&
           Enum.any?(Keyword.get_values(errors, :email), &String.contains?(&1, "already on the waitlist")) do
          conn
          |> put_status(:conflict)
          |> json(%{
            success: false,
            error: "This email is already on the waitlist",
            code: "already_exists"
          })
        else
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{
            success: false,
            error: "Invalid email address",
            errors: errors
          })
        end
    end
  end

  def create(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{
      success: false,
      error: "Email is required"
    })
  end

  @doc """
  Admin endpoint to list all waitlist entries.
  """
  def index(conn, _params) do
    entries = Waitlist.list_entries()
    stats = Waitlist.get_stats()

    entries_data = Enum.map(entries, fn entry ->
      %{
        id: entry.id,
        email: entry.email,
        created_at: entry.inserted_at
      }
    end)

    json(conn, %{
      success: true,
      entries: entries_data,
      stats: stats,
      count: length(entries_data)
    })
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
    |> Enum.flat_map(fn {key, values} ->
      Enum.map(values, fn value -> {key, value} end)
    end)
  end
end
