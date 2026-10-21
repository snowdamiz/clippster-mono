defmodule ClippsterServer.Kick.ArchivePage do
  @moduledoc "Decodes the current archived-video catalogue embedded in Kick's public channel page."

  def videos(html, channel) when is_binary(html) do
    # Flight records can span script tags. Decode JSON strings before joining them,
    # preserving escaped titles and splitting only at actual record boundaries.
    records =
      Regex.scan(~r/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/s, html,
        capture: :all_but_first
      )
      |> Enum.flat_map(fn [encoded] ->
        case Jason.decode(encoded) do
          {:ok, text} when is_binary(text) -> [text]
          _ -> []
        end
      end)
      |> Enum.join()
      |> String.split("\n", trim: true)

    catalogues =
      Enum.flat_map(records, fn record ->
        case String.split(record, ":", parts: 2) do
          [_, json] ->
            case Jason.decode(json) do
              {:ok, value} -> find_catalogues(value, channel)
              _ -> []
            end

          _ ->
            []
        end
      end)

    case catalogues do
      [] -> {:error, :archive_catalogue_missing}
      _ -> {:ok, catalogues |> List.flatten() |> Enum.uniq_by(& &1["id"])}
    end
  end

  defp find_catalogues(%{"data" => data} = value, channel) when is_list(data) and data != [] do
    if Enum.all?(data, &archive_record?(&1, channel)) do
      [data]
    else
      value |> Map.values() |> Enum.flat_map(&find_catalogues(&1, channel))
    end
  end

  defp find_catalogues(value, channel) when is_map(value),
    do: value |> Map.values() |> Enum.flat_map(&find_catalogues(&1, channel))

  defp find_catalogues(value, channel) when is_list(value),
    do: Enum.flat_map(value, &find_catalogues(&1, channel))

  defp find_catalogues(_, _), do: []

  defp archive_record?(
         %{
           "id" => id,
           "duration" => duration,
           "is_live" => live,
           "recording_url" => source,
           "channel" => %{"slug" => slug}
         },
         channel
       ) do
    is_binary(id) and Regex.match?(~r/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i, id) and
      is_number(duration) and is_boolean(live) and is_binary(source) and is_binary(slug) and
      String.downcase(slug) == String.downcase(channel)
  end

  defp archive_record?(_, _), do: false
end
