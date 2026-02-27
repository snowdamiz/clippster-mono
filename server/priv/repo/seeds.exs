# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     ClippsterServer.Repo.insert!(%ClippsterServer.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias ClippsterServer.Repo
alias ClippsterServer.BetaCodes.BetaCode

# Create development beta codes
IO.puts("Creating development beta codes...")

dev_codes = [
  "DEV12345",
  "TEST1234",
  "DEMO5678",
  "LOCAL999"
]

Enum.each(dev_codes, fn code ->
  case Repo.get_by(BetaCode, code: code) do
    nil ->
      %BetaCode{}
      |> BetaCode.changeset(%{code: code})
      |> Repo.insert!()

      IO.puts("✓ Created beta code: #{code}")

    _existing ->
      IO.puts("⊘ Beta code already exists: #{code}")
  end
end)

IO.puts("\nDevelopment beta codes ready!")
IO.puts("You can use any of these codes: #{Enum.join(dev_codes, ", ")}")
