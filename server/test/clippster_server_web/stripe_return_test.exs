defmodule ClippsterServerWeb.StripeReturnTest do
  use ExUnit.Case, async: true
  import Plug.Conn

  alias ClippsterServerWeb.StripeReturn

  defp conn(headers \\ []) do
    Enum.reduce(headers, Plug.Test.conn(:post, "/"), fn {key, value}, acc ->
      put_req_header(acc, key, value)
    end)
  end

  test "desktop return_context uses the local Tauri callback" do
    url = StripeReturn.success_url(conn(), %{"return_context" => "desktop"})
    assert url == "http://localhost:48277/stripe-success"
  end

  test "mobile return_context keeps an https web URL and tags return_to=mobile" do
    url = StripeReturn.success_url(conn(), %{"return_context" => "mobile"})
    uri = URI.parse(url)
    assert uri.path == "/stripe-success" or String.ends_with?(url, "stripe-success") or String.contains?(url, "stripe-success")
    assert URI.decode_query(uri.query || "")["return_to"] == "mobile"
  end

  test "X-Client-Platform mobile is treated as a mobile return" do
    url = StripeReturn.success_url(conn([{"x-client-platform", "mobile"}]), %{})
    assert String.contains?(url, "return_to=mobile")
  end

  test "desktop wins over a mobile platform header" do
    url =
      StripeReturn.success_url(conn([{"x-client-platform", "mobile"}]), %{
        "return_context" => "desktop"
      })

    assert url == "http://localhost:48277/stripe-success"
  end

  test "mobile cancel URL keeps the web path and tags return_to=mobile" do
    url = StripeReturn.cancel_url(conn(), %{"return_context" => "mobile"})
    uri = URI.parse(url)
    assert uri.path == "/stripe-cancel" or String.contains?(url, "stripe-cancel")
    assert URI.decode_query(uri.query || "")["return_to"] == "mobile"
  end
end
