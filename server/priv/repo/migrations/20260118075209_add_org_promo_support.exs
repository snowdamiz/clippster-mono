defmodule ClippsterServer.Repo.Migrations.AddOrgPromoSupport do
  use Ecto.Migration

  def change do
    # Add organization-specific fields to promo_codes table
    alter table(:promo_codes) do
      add :allowed_org_tiers, {:array, :string}, default: []
      add :allowed_credit_packs, {:array, :string}, default: []
    end

    # Add organization_id to promo_redemptions for organization-level tracking
    alter table(:promo_redemptions) do
      add :organization_id, references(:organizations, on_delete: :nilify_all)
    end

    # Create unique index to ensure each organization can only redeem a promo code once
    create unique_index(:promo_redemptions, [:promo_code_id, :organization_id],
      where: "organization_id IS NOT NULL",
      name: :promo_redemptions_org_unique
    )
  end
end
