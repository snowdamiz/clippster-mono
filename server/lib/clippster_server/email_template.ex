defmodule ClippsterServer.EmailTemplate do
  @moduledoc "Shared email layout, also consumed by the desktop and web campaign composers."
  @external_resource Path.expand("../../priv/email/layout.html", __DIR__)
  @layout File.read!(@external_resource)
  @styles_path Path.expand("../../priv/email/body-styles.txt", __DIR__)
  @external_resource @styles_path
  @styles @styles_path
          |> File.read!()
          |> String.split(~r/\r?\n/, trim: true)
          |> Map.new(fn line ->
            [field, style] = String.split(line, "=", parts: 2)
            {field, style}
          end)

  @doc "Readable plain text generated from the same content as the HTML email."
  def to_text(html) do
    html
    |> String.replace(~r/<head\b[^>]*>[\s\S]*?<\/head>/i, "")
    |> String.replace(~r/<div hidden[^>]*>[\s\S]*?<\/div>/i, "")
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
            " &nbsp;·&nbsp; <a href=\"#{escape(unsubscribe)}\" style=\"color:#80dcff\">Unsubscribe</a>",
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
    <p style="#{@styles["category"]}">#{escape(category)}</p>
    <h1 class="email-heading" style="#{@styles["heading"]}">#{escape(title)}</h1>
    <p style="#{@styles["message"]}">#{escape(text) |> String.replace("\n", "<br>")}</p>
    #{extra}
    #{button(action)}
    <p style="#{@styles["signoff"]}">See you in the studio,<br>The Clippster team</p>
    """
  end

  def code(label, value, note) do
    """
    <div style="margin:0 0 18px;padding:20px;background-color:#192637;border:1px solid #2c3b50;border-radius:8px">
    <p style="margin:0;color:#b9c7d8;font-size:12px">#{escape(label)}</p>
    <p style="margin:8px 0;color:#f3f7ff;font-family:monospace;font-size:28px;letter-spacing:3px">#{escape(value)}</p>
    <p style="margin:0;color:#b9c7d8;font-size:12px">#{escape(note)}</p></div>
    """
  end

  defp button(nil), do: ""

  defp button({label, url}) do
    """
    <p style="#{@styles["action"]}"><a href="#{escape(url)}" style="#{@styles["button"]}">#{escape(label)}</a></p>
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
