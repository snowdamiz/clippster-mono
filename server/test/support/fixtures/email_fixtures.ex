defmodule ClippsterServer.EmailFixtures do
  @moduledoc false

  import ExUnit.Assertions

  def extract_otp(%Swoosh.Email{text_body: body}) when is_binary(body) do
    case Regex.run(~r/^Your verification code\s+(\d{6})\s*$/m, body) do
      [_, otp] -> otp
      _ -> flunk("Expected a six-digit verification code in the plain-text email")
    end
  end

  def extract_otp(_email), do: flunk("Expected a plain-text email body")
end
