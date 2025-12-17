defmodule ClippsterServer.Mailer do
  @moduledoc """
  Mailer module for sending emails via Swoosh.
  """
  use Swoosh.Mailer, otp_app: :clippster_server
end
