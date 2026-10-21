defmodule ClippsterServer.EmailTemplate do
  @moduledoc "Shared email layout, also consumed by the desktop and web campaign composers."
  @external_resource Path.expand("../../priv/email/layout.html", __DIR__)
  @layout File.read!(@external_resource)

  @doc "Readable plain text generated from the same content as the HTML email."
  def to_text(html) do
    html
    |> String.replace(~r/<head\b[^>]*>[\s\S]*?<\/head>/i, "")
    |> String.replace(~r/<div style="display:none[^>]*>[\s\S]*?<\/div>/i, "")
    |> String.replace(~r/<img\b[^>]*alt="([^"]*)"[^>]*>/i, "\\1")
    |> String.replace(~r/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i, "\\2 (\\1)")
    |> String.replace(~r/<br\s*\/?\s*>/i, "\n")
    |> String.replace(~r/<\/(p|h[1-6]|div|tr|li)>/i, "\n\n")
    |> String.replace(~r/<[^>]+>/, "")
    |> String.replace("&nbsp;", " ")
    |> String.replace("&lt;", "<")
    |> String.replace("&gt;", ">")
    |> String.replace("&quot;", "\"")
    |> String.replace("&#39;", "'")
    |> String.replace("&amp;", "&")
    |> String.replace(~r/[ \t]+/, " ")
    |> String.replace(~r/\n[ \t]+/, "\n")
    |> String.replace(~r/\n{3,}/, "\n\n")
    |> String.trim()
  end

  def render(body, opts \\ []) do
    unsubscribe = Keyword.get(opts, :unsubscribe_url)

    slots = %{
      "APP_NAME" => escape(Keyword.get(opts, :app_name, "Clippster")),
      "PREHEADER" => escape(Keyword.get(opts, :preheader, "")),
      "BODY" => body,
      "SUPPORT_EMAIL" => escape(Keyword.get(opts, :support_email, "support@clippster.app")),
      "REASON" => escape(Keyword.get(opts, :reason, "")),
      "UNSUBSCRIBE" =>
        if(unsubscribe,
          do:
            " &nbsp;·&nbsp; <a href=\"#{escape(unsubscribe)}\" style=\"color:#a1a9b7\">Unsubscribe</a>",
          else: ""
        )
    }

    # Replace once so user content containing slot names stays literal.
    Regex.replace(
      ~r/__(APP_NAME|PREHEADER|BODY|SUPPORT_EMAIL|REASON|UNSUBSCRIBE)__/,
      @layout,
      fn _, key -> Map.fetch!(slots, key) end
    )
  end

  def message(category, title, text, extra \\ "", action \\ nil) do
    """
    <p style="margin:0 0 18px;color:#38bdf8;font-size:11px;letter-spacing:1.8px">#{escape(category)}</p>
    <h1 style="margin:0 0 26px;color:#eef0f4;font-size:32px;font-weight:600;letter-spacing:-0.7px;line-height:1.2">#{escape(title)}</h1>
    <p style="margin:0 0 24px;color:#a1a9b7;font-size:15px;line-height:1.75">#{escape(text) |> String.replace("\n", "<br>")}</p>
    #{extra}
    #{button(action)}
    <p style="margin:8px 0 0;color:#eef0f4;font-size:14px;line-height:1.75">See you in the studio,<br>The Clippster team</p>
    """
  end

  def code(label, value, note) do
    """
    <div style="margin:0 0 24px;padding:20px;background-color:#191c23;border:1px solid #292d35;border-radius:8px">
    <p style="margin:0;color:#a1a9b7;font-size:12px">#{escape(label)}</p>
    <p style="margin:8px 0;color:#eef0f4;font-family:monospace;font-size:28px;letter-spacing:3px">#{escape(value)}</p>
    <p style="margin:0;color:#a1a9b7;font-size:12px">#{escape(note)}</p></div>
    """
  end

  defp button(nil), do: ""

  defp button({label, url}) do
    """
    <p style="margin:0 0 24px"><a href="#{escape(url)}" style="display:inline-block;background-color:#eef0f4;color:#0b0d11;padding:14px 22px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">#{escape(label)}</a></p>
    """
  end

  defp escape(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end
end
