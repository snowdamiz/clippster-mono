#!/usr/bin/env elixir

# Test script to verify activity ping functionality
Mix.install([])

# Start the application
Application.ensure_all_started(:clippster_server)

# Get a user
user = ClippsterServer.Repo.all(ClippsterServer.Accounts.User) |> List.first()

if user do
  IO.puts("Testing with user ID: #{user.id}")
  IO.puts("Current last_active_at: #{inspect(user.last_active_at)}")
  
  # Try to update
  case ClippsterServer.Accounts.update_last_active(user.id) do
    {:ok, updated_user} ->
      IO.puts("✓ Success! Updated last_active_at to: #{inspect(updated_user.last_active_at)}")
    
    {:error, reason} ->
      IO.puts("✗ Error: #{inspect(reason)}")
      
      # If it's a changeset error, print details
      if match?(%Ecto.Changeset{}, reason) do
        errors = Ecto.Changeset.traverse_errors(reason, fn {msg, _opts} -> msg end)
        IO.puts("Changeset errors: #{inspect(errors)}")
      end
  end
else
  IO.puts("No users found in database")
end
