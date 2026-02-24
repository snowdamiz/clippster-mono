defmodule ClippsterServer.Repo.Migrations.AddBetaCodeVerificationFields do
  use Ecto.Migration

  def change do
    alter table(:beta_codes) do
      add :assigned_email, :string
      add :verified_at, :utc_datetime
      add :verified_from_ip, :string
    end

    create index(:beta_codes, [:assigned_email])
  end
end
