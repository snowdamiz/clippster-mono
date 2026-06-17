defmodule ClippsterServer.Repo.Migrations.RenameBonusCreditsToTotalCredits do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promo_codes'
          AND column_name = 'bonus_credits'
      ) THEN
        ALTER TABLE promo_codes RENAME COLUMN bonus_credits TO total_credits;
      END IF;
    END $$;
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promo_codes'
          AND column_name = 'total_credits'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promo_codes'
          AND column_name = 'bonus_credits'
      ) THEN
        ALTER TABLE promo_codes RENAME COLUMN total_credits TO bonus_credits;
      END IF;
    END $$;
    """)
  end
end
