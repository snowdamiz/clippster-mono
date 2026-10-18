defmodule ClippsterServer.EmailTemplateTest do
  use ExUnit.Case, async: true
  alias ClippsterServer.EmailTemplate

  test "plain text preserves custom content, action destinations and shared contact links" do
    html =
      EmailTemplate.message(
        "UPDATE",
        "News & updates",
        "Hello\nCreators",
        "",
        {"Read more", "https://example.com/news"}
      )

    text =
      html
      |> EmailTemplate.render(unsubscribe_url: "https://example.com/unsubscribe")
      |> EmailTemplate.to_text()

    assert text =~ "News & updates"
    assert text =~ "Hello\nCreators"
    assert text =~ "Read more (https://example.com/news)"
    assert text =~ "https://discord.gg/4kTCvKEVuV"
    assert text =~ "support@clippster.app"
    assert text =~ "OpenWorth Technologies Inc"
    assert text =~ "https://example.com/unsubscribe"
    refute text =~ "<table"
    refute text =~ "color-scheme"
  end

  test "shared chrome includes support, Discord and the company without a postal address" do
    html = EmailTemplate.render("<p>Custom message</p>", reason: "Account notification")
    assert html =~ "<p>Custom message</p>"
    assert html =~ "https://discord.gg/4kTCvKEVuV"
    assert html =~ "mailto:support@clippster.app"
    assert html =~ "OpenWorth Technologies Inc"
    refute html =~ "412 W"
    refute html =~ "tel:"
    refute html =~ "Unsubscribe"
  end

  test "marketing emails include the supplied recipient-specific unsubscribe link" do
    html =
      EmailTemplate.render("Hello",
        unsubscribe_url: "https://example.com/unsubscribe/token?a=1&b=2"
      )

    assert html =~ "https://example.com/unsubscribe/token?a=1&amp;b=2"
    assert html =~ "Unsubscribe"
  end

  test "escapes metadata without rewriting slot-like content in the email body" do
    html =
      EmailTemplate.render("<p>__REASON__</p>",
        preheader: "<script>alert(1)</script>",
        reason: "<b>Reason</b>"
      )

    assert html =~ "<p>__REASON__</p>"
    assert html =~ "&lt;script&gt;alert(1)&lt;/script&gt;"
    assert html =~ "&lt;b&gt;Reason&lt;/b&gt;"
    refute html =~ "<script>"
  end

  test "escapes invitation names, codes and action attributes" do
    body =
      EmailTemplate.message(
        "TEAM",
        "<Admin>",
        "Hello & welcome",
        EmailTemplate.code("Code", "<123>", "10 minutes"),
        {"Join", "https://example.com/?a=1&b=2"}
      )

    assert body =~ "&lt;Admin&gt;"
    assert body =~ "&lt;123&gt;"
    assert body =~ "Hello &amp; welcome"
    assert body =~ "https://example.com/?a=1&amp;b=2"
  end
end
