import Ecto.Query
alias ClippsterServer.Repo

# Remove the migration record so it can be re-run
Repo.delete_all(from m in "schema_migrations", where: m.version == 20260227000001)

IO.puts("Migration record deleted. Now run: mix ecto.migrate")
