defmodule ClippsterServerWeb.RumbleController do
  use ClippsterServerWeb, :controller
  require Logger

  @doc """
  Get Rumble channel information and live status.
  GET /api/rumble/channels/:channel_name
  
  Note: Rumble doesn't have an official public API, so we use web scraping
  or third-party services. This is a basic implementation that may need
  updates as Rumble's structure changes.
  """
  def get_channel(conn, %{"channel_name" => channel_name}) do
    do_get_channel_with_retry(conn, channel_name, 3)
  end

  defp do_get_channel_with_retry(conn, channel_name, retries_left) when retries_left > 0 do
    # Rumble channel URL format: https://rumble.com/c/{channel_name}
    # or https://rumble.com/user/{channel_name}
    
    # Try both URL formats
    channel_url = "https://rumble.com/c/#{channel_name}"
    user_url = "https://rumble.com/user/#{channel_name}"
    
    # Try channel URL first
    case try_fetch_rumble_page(channel_url) do
      {:ok, data} ->
        json(conn, data)
        
      {:error, :not_found} ->
        # Try user URL
        case try_fetch_rumble_page(user_url) do
          {:ok, data} ->
            json(conn, data)
            
          {:error, :not_found} ->
            json(conn, %{
              isLive: false,
              channelName: channel_name,
              error: "Channel not found"
            })
            
          {:error, :retry} when retries_left > 1 ->
            Logger.warning(
              "Rumble page fetch failed for #{channel_name}, retrying... (#{retries_left - 1} retries left)"
            )
            Process.sleep(500 * (4 - retries_left))
            do_get_channel_with_retry(conn, channel_name, retries_left - 1)
            
          {:error, reason} ->
            Logger.error("Rumble page fetch failed: #{inspect(reason)}")
            
            conn
            |> put_status(:internal_server_error)
            |> json(%{isLive: false, error: "Failed to fetch Rumble channel"})
        end
        
      {:error, :retry} when retries_left > 1 ->
        Logger.warning(
          "Rumble page fetch failed for #{channel_name}, retrying... (#{retries_left - 1} retries left)"
        )
        Process.sleep(500 * (4 - retries_left))
        do_get_channel_with_retry(conn, channel_name, retries_left - 1)
        
      {:error, reason} ->
        Logger.error("Rumble page fetch failed: #{inspect(reason)}")
        
        conn
        |> put_status(:internal_server_error)
        |> json(%{isLive: false, error: "Failed to fetch Rumble channel"})
    end
  end

  defp do_get_channel_with_retry(conn, channel_name, 0) do
    Logger.error("Rumble fetch exhausted all retries for channel #{channel_name}")
    
    conn
    |> put_status(:internal_server_error)
    |> json(%{isLive: false, error: "Rumble request failed after retries"})
  end

  defp try_fetch_rumble_page(url) do
    headers = [
      {"User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    ]
    
    case Req.get(url, headers: headers, retry: false) do
      {:ok, %Req.Response{status: 200, body: html}} when is_binary(html) ->
        parse_rumble_page(html, url)
        
      {:ok, %Req.Response{status: 404}} ->
        {:error, :not_found}
        
      {:ok, %Req.Response{status: status}} when status >= 500 ->
        {:error, :retry}
        
      {:ok, %Req.Response{status: status}} ->
        Logger.warning("Rumble returned unexpected status #{status}")
        {:error, :not_found}
        
      {:error, _exception} ->
        {:error, :retry}
    end
  end

  defp parse_rumble_page(html, url) do
    # Extract channel name from URL
    channel_name = extract_channel_name_from_url(url)
    
    # Basic parsing - look for live indicator and channel info
    # Note: This is fragile and may break if Rumble changes their HTML structure
    is_live = String.contains?(html, "LIVE NOW") or 
              String.contains?(html, "live-badge") or
              String.contains?(html, "\"isLive\":true")
    
    # Try to extract profile image from meta tags or page content
    profile_image_url = extract_meta_image(html) || extract_profile_image(html)
    
    # Try to extract channel title
    display_name = extract_channel_title(html) || channel_name
    
    # Try to extract subscriber/follower count
    follower_count = extract_follower_count(html)
    
    {:ok, %{
      isLive: is_live,
      channelName: channel_name,
      displayName: display_name,
      profileImageUrl: profile_image_url,
      followerCount: follower_count,
      platform: "rumble"
    }}
  end

  defp extract_channel_name_from_url(url) do
    url
    |> String.split("/")
    |> List.last()
    |> String.split("?")
    |> List.first()
  end

  defp extract_meta_image(html) do
    # Look for og:image meta tag
    case Regex.run(~r/<meta\s+property="og:image"\s+content="([^"]+)"/, html) do
      [_, image_url] -> image_url
      _ -> nil
    end
  end

  defp extract_profile_image(html) do
    # Look for profile image in various possible formats
    case Regex.run(~r/profile-image[^>]+src="([^"]+)"/, html) do
      [_, image_url] -> image_url
      _ -> 
        case Regex.run(~r/avatar[^>]+src="([^"]+)"/, html) do
          [_, image_url] -> image_url
          _ -> nil
        end
    end
  end

  defp extract_channel_title(html) do
    # Try to extract from title tag
    case Regex.run(~r/<title>([^<]+)<\/title>/, html) do
      [_, title] -> 
        title
        |> String.replace(" - Rumble", "")
        |> String.trim()
      _ -> nil
    end
  end

  defp extract_follower_count(html) do
    # Try to extract follower count from various possible formats
    case Regex.run(~r/(\d+(?:,\d+)*)\s+(?:followers?|subscribers?)/, html, capture: :all_but_first) do
      [count_str] -> 
        count_str
        |> String.replace(",", "")
        |> String.to_integer()
      _ -> nil
    end
  rescue
    _ -> nil
  end
end
