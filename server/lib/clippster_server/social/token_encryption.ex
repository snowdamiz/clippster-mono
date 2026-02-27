defmodule ClippsterServer.Social.TokenEncryption do
  @moduledoc """
  Handles encryption and decryption of OAuth tokens using AES-256-GCM.

  Tokens are stored encrypted at rest in the database for security.
  The encryption key should be set via the SOCIAL_TOKEN_ENCRYPTION_KEY environment variable.
  """

  @aad "ClippsterSocialTokens"

  @doc """
  Encrypts a token string using AES-256-GCM.
  Returns the encrypted binary that can be stored in the database.
  """
  def encrypt(nil), do: nil
  def encrypt(""), do: nil

  def encrypt(plaintext) when is_binary(plaintext) do
    key = get_encryption_key()
    iv = :crypto.strong_rand_bytes(16)

    {ciphertext, tag} =
      :crypto.crypto_one_time_aead(
        :aes_256_gcm,
        key,
        iv,
        plaintext,
        @aad,
        true
      )

    # Combine IV + tag + ciphertext for storage
    iv <> tag <> ciphertext
  end

  @doc """
  Decrypts an encrypted token binary.
  Returns the original token string or nil if decryption fails.
  """
  def decrypt(nil), do: nil
  def decrypt(<<>>), do: nil

  def decrypt(encrypted) when is_binary(encrypted) and byte_size(encrypted) > 32 do
    key = get_encryption_key()

    # Extract IV (16 bytes), tag (16 bytes), and ciphertext
    <<iv::binary-16, tag::binary-16, ciphertext::binary>> = encrypted

    case :crypto.crypto_one_time_aead(
           :aes_256_gcm,
           key,
           iv,
           ciphertext,
           @aad,
           tag,
           false
         ) do
      plaintext when is_binary(plaintext) -> plaintext
      :error -> nil
    end
  rescue
    _ -> nil
  end

  def decrypt(_), do: nil

  @doc """
  Generates a new random encryption key (32 bytes for AES-256).
  Use this to generate a key for the environment variable.
  """
  def generate_key do
    :crypto.strong_rand_bytes(32) |> Base.encode64()
  end

  # Private functions

  defp get_encryption_key do
    case Application.get_env(:clippster_server, :social_token_encryption_key) ||
           System.get_env("SOCIAL_TOKEN_ENCRYPTION_KEY") do
      nil ->
        raise """
        SOCIAL_TOKEN_ENCRYPTION_KEY is not set!
        Generate a key using: ClippsterServer.Social.TokenEncryption.generate_key()
        Then set the SOCIAL_TOKEN_ENCRYPTION_KEY environment variable.
        """

      key when is_binary(key) ->
        case Base.decode64(key) do
          {:ok, decoded} when byte_size(decoded) == 32 ->
            decoded

          {:ok, decoded} ->
            raise "SOCIAL_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (256 bits) when decoded. Got #{byte_size(decoded)} bytes."

          :error ->
            # Try using the key directly if it's already 32 bytes
            if byte_size(key) == 32 do
              key
            else
              raise "SOCIAL_TOKEN_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key."
            end
        end
    end
  end
end
