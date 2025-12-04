defmodule ClippsterServer.AI.VisionAPI do
  @moduledoc """
  Client for Google Cloud Vision API for face detection and analysis.
  Used for speaker detection and point-of-interest analysis in video frames.

  Documentation: https://cloud.google.com/vision/docs/reference/rest/v1/images/annotate
  """

  @google_vision_url "https://vision.googleapis.com/v1/images:annotate"

  # Retry configuration
  @max_retries 3
  @base_delay_ms 1000
  @max_delay_ms 10_000

  @doc """
  Detects faces in a base64-encoded image using Google Cloud Vision API.

  Returns a list of detected faces with bounding boxes, confidence scores,
  and facial landmarks.

  ## Parameters
    - image_base64: Base64-encoded image data (JPEG or PNG)

  ## Returns
    - {:ok, faces} where faces is a list of face detection results
    - {:error, reason} on failure
  """
  def detect_faces(image_base64) do
    api_key = System.get_env("GOOGLE_VISION_API_KEY")

    case api_key do
      nil ->
        IO.puts("[VisionAPI] GOOGLE_VISION_API_KEY environment variable not set")
        {:error, "GOOGLE_VISION_API_KEY environment variable not set"}

      _ ->
        IO.puts("[VisionAPI] Detecting faces in image...")
        
        request_body = build_face_detection_request(image_base64)
        url = "#{@google_vision_url}?key=#{api_key}"
        
        execute_request_with_retry(url, request_body, 0)
    end
  end

  @doc """
  Detects faces in multiple images in a single batch request.
  More efficient than making individual requests for each frame.

  ## Parameters
    - images: List of {image_base64, metadata} tuples

  ## Returns
    - {:ok, results} where results is a list of face detection results per image
    - {:error, reason} on failure
  """
  def detect_faces_batch(images) when is_list(images) do
    api_key = System.get_env("GOOGLE_VISION_API_KEY")

    case api_key do
      nil ->
        IO.puts("[VisionAPI] GOOGLE_VISION_API_KEY environment variable not set")
        {:error, "GOOGLE_VISION_API_KEY environment variable not set"}

      _ ->
        IO.puts("[VisionAPI] Detecting faces in #{length(images)} images (batch)...")
        
        request_body = build_batch_face_detection_request(images)
        url = "#{@google_vision_url}?key=#{api_key}"
        
        execute_batch_request_with_retry(url, request_body, 0)
    end
  end

  @doc """
  Parses Google Vision API face detection response into a normalized format.

  ## Returns
  List of face detections, each containing:
    - bbox: %{x: float, y: float, width: float, height: float} (normalized 0-1)
    - confidence: float (0-1)
    - landmarks: map of facial landmarks
    - roll_angle: head rotation angle
    - pan_angle: head left/right angle
    - tilt_angle: head up/down angle
  """
  def parse_face_annotations(nil), do: []
  def parse_face_annotations([]), do: []
  def parse_face_annotations(face_annotations) when is_list(face_annotations) do
    Enum.map(face_annotations, &parse_single_face/1)
  end

  # Build request body for single image face detection
  defp build_face_detection_request(image_base64) do
    %{
      requests: [
        %{
          image: %{
            content: image_base64
          },
          features: [
            %{
              type: "FACE_DETECTION",
              maxResults: 10
            }
          ]
        }
      ]
    }
    |> Jason.encode!()
  end

  # Build request body for batch face detection
  defp build_batch_face_detection_request(images) do
    requests = Enum.map(images, fn {image_base64, _metadata} ->
      %{
        image: %{
          content: image_base64
        },
        features: [
          %{
            type: "FACE_DETECTION",
            maxResults: 10
          }
        ]
      }
    end)

    %{requests: requests}
    |> Jason.encode!()
  end

  # Execute HTTP request with retry logic
  defp execute_request_with_retry(url, body, attempt) do
    headers = [
      {"Content-Type", "application/json"},
      {"User-Agent", "Clippster/1.0"}
    ]

    request = Finch.build(:post, url, headers, body)

    case Finch.request(request, ClippsterFinch, receive_timeout: 30_000, pool_timeout: 10_000) do
      {:ok, %Finch.Response{status: 200, body: response_body}} ->
        IO.puts("[VisionAPI] Received successful response (attempt #{attempt + 1})")
        parse_response(response_body)

      {:ok, %Finch.Response{status: 429, body: response_body}} ->
        if attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)
          IO.puts("[VisionAPI] Rate limited (429), retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})...")
          Process.sleep(delay)
          execute_request_with_retry(url, body, attempt + 1)
        else
          {:error, "Vision API rate limited after #{@max_retries} retries: #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}} when status_code in [500, 502, 503, 504] ->
        if attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)
          IO.puts("[VisionAPI] Server error #{status_code}, retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})...")
          Process.sleep(delay)
          execute_request_with_retry(url, body, attempt + 1)
        else
          {:error, "Vision API error after #{@max_retries} retries (#{status_code}): #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}} ->
        IO.puts("[VisionAPI] API returned error status: #{status_code}")
        IO.puts("[VisionAPI] Error body: #{response_body}")
        {:error, "Vision API error (#{status_code}): #{response_body}"}

      {:error, reason} ->
        if retryable_error?(reason) and attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)
          IO.puts("[VisionAPI] Transient error, retrying in #{delay}ms (attempt #{attempt + 1}/#{@max_retries})...")
          Process.sleep(delay)
          execute_request_with_retry(url, body, attempt + 1)
        else
          {:error, "Network error after #{attempt + 1} attempts: #{inspect(reason)}"}
        end
    end
  end

  # Execute batch request with retry logic
  defp execute_batch_request_with_retry(url, body, attempt) do
    headers = [
      {"Content-Type", "application/json"},
      {"User-Agent", "Clippster/1.0"}
    ]

    request = Finch.build(:post, url, headers, body)

    case Finch.request(request, ClippsterFinch, receive_timeout: 60_000, pool_timeout: 10_000) do
      {:ok, %Finch.Response{status: 200, body: response_body}} ->
        IO.puts("[VisionAPI] Received batch response (attempt #{attempt + 1})")
        parse_batch_response(response_body)

      {:ok, %Finch.Response{status: 429, body: response_body}} ->
        if attempt < @max_retries do
          delay = calculate_backoff_delay(attempt) * 2  # Longer delay for batch requests
          IO.puts("[VisionAPI] Rate limited (429), retrying in #{delay}ms...")
          Process.sleep(delay)
          execute_batch_request_with_retry(url, body, attempt + 1)
        else
          {:error, "Vision API rate limited after #{@max_retries} retries: #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}} when status_code in [500, 502, 503, 504] ->
        if attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)
          IO.puts("[VisionAPI] Server error #{status_code}, retrying...")
          Process.sleep(delay)
          execute_batch_request_with_retry(url, body, attempt + 1)
        else
          {:error, "Vision API error after retries (#{status_code}): #{response_body}"}
        end

      {:ok, %Finch.Response{status: status_code, body: response_body}} ->
        {:error, "Vision API error (#{status_code}): #{response_body}"}

      {:error, reason} ->
        if retryable_error?(reason) and attempt < @max_retries do
          delay = calculate_backoff_delay(attempt)
          IO.puts("[VisionAPI] Transient error, retrying...")
          Process.sleep(delay)
          execute_batch_request_with_retry(url, body, attempt + 1)
        else
          {:error, "Network error: #{inspect(reason)}"}
        end
    end
  end

  # Parse single image response
  defp parse_response(response_body) do
    case Jason.decode(response_body) do
      {:ok, %{"responses" => [%{"faceAnnotations" => face_annotations}]}} ->
        faces = parse_face_annotations(face_annotations)
        {:ok, faces}

      {:ok, %{"responses" => [%{"error" => error}]}} ->
        {:error, "Vision API error: #{inspect(error)}"}

      {:ok, %{"responses" => [%{}]}} ->
        # No faces detected
        {:ok, []}

      {:ok, %{"error" => error}} ->
        {:error, "Vision API error: #{inspect(error)}"}

      {:error, reason} ->
        {:error, "Failed to parse response: #{inspect(reason)}"}
    end
  end

  # Parse batch response
  defp parse_batch_response(response_body) do
    case Jason.decode(response_body) do
      {:ok, %{"responses" => responses}} when is_list(responses) ->
        results = Enum.map(responses, fn response ->
          case response do
            %{"faceAnnotations" => face_annotations} ->
              parse_face_annotations(face_annotations)
            %{"error" => _error} ->
              []
            %{} ->
              []
          end
        end)
        {:ok, results}

      {:ok, %{"error" => error}} ->
        {:error, "Vision API error: #{inspect(error)}"}

      {:error, reason} ->
        {:error, "Failed to parse batch response: #{inspect(reason)}"}
    end
  end

  # Parse single face annotation from Google Vision API response
  defp parse_single_face(face_annotation) do
    # Get bounding polygon vertices
    bounding_poly = Map.get(face_annotation, "fdBoundingPoly", %{})
    vertices = Map.get(bounding_poly, "vertices", [])

    # Calculate normalized bounding box from vertices
    bbox = calculate_bbox_from_vertices(vertices)

    # Get detection confidence
    confidence = Map.get(face_annotation, "detectionConfidence", 0.0)

    # Get head pose angles
    roll_angle = Map.get(face_annotation, "rollAngle", 0.0)
    pan_angle = Map.get(face_annotation, "panAngle", 0.0)
    tilt_angle = Map.get(face_annotation, "tiltAngle", 0.0)

    # Get facial landmarks for more precise positioning
    landmarks = parse_landmarks(Map.get(face_annotation, "landmarks", []))

    %{
      bbox: bbox,
      confidence: confidence,
      roll_angle: roll_angle,
      pan_angle: pan_angle,
      tilt_angle: tilt_angle,
      landmarks: landmarks,
      # Joy/sorrow likelihood can help identify active speaker
      joy_likelihood: Map.get(face_annotation, "joyLikelihood", "UNKNOWN"),
      sorrow_likelihood: Map.get(face_annotation, "sorrowLikelihood", "UNKNOWN")
    }
  end

  # Calculate bounding box from vertices (in pixel coordinates)
  # Returns raw pixel coordinates; normalization happens at detection level
  defp calculate_bbox_from_vertices([]) do
    %{x: 0.0, y: 0.0, width: 0.0, height: 0.0}
  end
  defp calculate_bbox_from_vertices(vertices) do
    xs = Enum.map(vertices, &(Map.get(&1, "x", 0)))
    ys = Enum.map(vertices, &(Map.get(&1, "y", 0)))

    min_x = Enum.min(xs, fn -> 0 end)
    max_x = Enum.max(xs, fn -> 0 end)
    min_y = Enum.min(ys, fn -> 0 end)
    max_y = Enum.max(ys, fn -> 0 end)

    %{
      x: min_x,
      y: min_y,
      width: max_x - min_x,
      height: max_y - min_y
    }
  end

  # Parse facial landmarks
  defp parse_landmarks([]), do: %{}
  defp parse_landmarks(landmarks) do
    landmarks
    |> Enum.map(fn landmark ->
      type = Map.get(landmark, "type", "UNKNOWN")
      position = Map.get(landmark, "position", %{})
      {type, %{
        x: Map.get(position, "x", 0),
        y: Map.get(position, "y", 0),
        z: Map.get(position, "z", 0)
      }}
    end)
    |> Map.new()
  end

  # Check if error is retryable
  defp retryable_error?(%Mint.TransportError{reason: reason})
    when reason in [:closed, :timeout, :econnrefused, :econnreset] do
    true
  end
  defp retryable_error?(%Mint.TransportError{reason: {:tls_alert, _}}), do: true
  defp retryable_error?(%Finch.Error{reason: :pool_timeout}), do: true
  defp retryable_error?(_), do: false

  # Calculate exponential backoff delay
  defp calculate_backoff_delay(attempt) do
    base = @base_delay_ms * :math.pow(2, attempt)
    jitter = :rand.uniform(round(base * 0.3))
    min(round(base) + jitter, @max_delay_ms)
  end

  @doc """
  Normalizes face bounding boxes to 0-1 range based on image dimensions.

  ## Parameters
    - faces: List of face detections with pixel-based bboxes
    - width: Image width in pixels
    - height: Image height in pixels

  ## Returns
    - List of faces with normalized bboxes
  """
  def normalize_face_bboxes(faces, width, height) when width > 0 and height > 0 do
    Enum.map(faces, fn face ->
      bbox = face.bbox
      normalized_bbox = %{
        x: bbox.x / width,
        y: bbox.y / height,
        width: bbox.width / width,
        height: bbox.height / height
      }
      Map.put(face, :bbox, normalized_bbox)
    end)
  end
  def normalize_face_bboxes(faces, _, _), do: faces
end

