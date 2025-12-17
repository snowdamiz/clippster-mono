defmodule ClippsterServerWeb.PaymentController do
  use ClippsterServerWeb, :controller
  alias ClippsterServer.Credits
  alias ClippsterServer.Accounts

  # Handle OPTIONS requests for CORS preflight
  def options(conn, _params) do
    conn
    |> put_resp_header("access-control-allow-origin", get_req_header(conn, "origin") |> List.first() || "*")
    |> put_resp_header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "Authorization, Content-Type, Accept, Origin, X-Requested-With")
    |> put_resp_header("access-control-max-age", "86400")
    |> send_resp(200, "")
  end

  @doc """
  Get pricing information for all credit packs with current SOL price
  """
  def get_pricing(conn, _params) do
    packs = Credits.get_credit_packs()
    company_wallet = Credits.get_company_wallet_address()
    rpc_url = Credits.get_solana_rpc_url()

    case ClippsterServer.PriceService.get_sol_price() do
      {:ok, sol_usd_rate} ->
        # Calculate SOL amounts for each pack
        packs_with_sol =
          Enum.map(packs, fn {key, pack} ->
            sol_amount = pack.usd / sol_usd_rate
            {key, Map.put(pack, :sol_amount, sol_amount)}
          end)
          |> Enum.into(%{})

        json(conn, %{
          success: true,
          packs: packs_with_sol,
          sol_usd_rate: sol_usd_rate,
          company_wallet_address: company_wallet,
          rpc_url: rpc_url
        })

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable. Please try again."})
    end
  end

  @doc """
  Get user's credit balance (requires authentication)
  Returns personal credits, organization allocations, and total available.
  """
  def get_balance(conn, _params) do
    alias ClippsterServer.Organizations

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, claims} <- get_token_claims(conn) do
      # Check if user is admin - admins have unlimited credits
      if claims["is_admin"] do
        json(conn, %{
          success: true,
          balance: %{
            hours_remaining: :unlimited,
            hours_used: Decimal.new(0)
          },
          organization_allocations: [],
          total_available: :unlimited
        })
      else
        # Regular user - get personal balance
        {:ok, personal_balance} = Credits.get_user_balance(user_id)

        # Get organization allocations
        org_allocations = get_organization_allocations(user_id)

        # Calculate total available
        org_total = Enum.reduce(org_allocations, 0.0, fn alloc, acc ->
          acc + alloc.hours_remaining
        end)
        total_available = Decimal.to_float(personal_balance.hours_remaining) + org_total

        json(conn, %{
          success: true,
          balance: %{
            hours_remaining: Decimal.to_float(personal_balance.hours_remaining),
            hours_used: Decimal.to_float(personal_balance.hours_used)
          },
          organization_allocations: org_allocations,
          total_available: total_available
        })
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  # Get all organization allocations for a user
  defp get_organization_allocations(user_id) do
    alias ClippsterServer.Organizations

    Organizations.list_user_organizations(user_id)
    |> Enum.map(fn %{organization: org, role: role} ->
      allocation = Organizations.get_member_allocation(org.id, user_id)

      if allocation do
        %{
          organization_id: org.id,
          organization_name: org.name,
          role: role,
          hours_allocated: Decimal.to_float(allocation.hours_allocated),
          hours_used: Decimal.to_float(allocation.hours_used),
          hours_remaining: Decimal.to_float(Organizations.MemberCreditAllocation.remaining_hours(allocation))
        }
      else
        %{
          organization_id: org.id,
          organization_name: org.name,
          role: role,
          hours_allocated: 0.0,
          hours_used: 0.0,
          hours_remaining: 0.0
        }
      end
    end)
    |> Enum.filter(fn alloc -> alloc.hours_allocated > 0 or alloc.role in ["owner", "admin"] end)
  end

  @doc """
  Generate a payment quote with server-calculated pricing
  Frontend cannot manipulate prices - all calculations done server-side
  """
  def get_quote(conn, %{"pack_type" => pack_type}) do
    with {:ok, _user_id} <- get_user_id_from_token(conn),
         {:ok, pack_info} <- validate_pack_type(pack_type),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      
      # Server calculates exact SOL amount
      sol_amount = pack_info.usd / sol_usd_rate
      company_wallet = Credits.get_company_wallet_address()
      
      # Generate quote with 5 minute expiry
      quote = %{
        pack_type: pack_type,
        hours: pack_info.hours,
        amount_usd: pack_info.usd,
        amount_sol: sol_amount,
        sol_usd_rate: sol_usd_rate,
        company_wallet: company_wallet,
        expires_at: DateTime.utc_now() |> DateTime.add(300, :second) |> DateTime.to_iso8601(),
        quote_id: generate_quote_id()
      }

      json(conn, %{
        success: true,
        quote: quote
      })
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :invalid_pack} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid pack type"})

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable"})
    end
  end

  @doc """
  Confirm payment - verifies on-chain transaction and credits user
  SERVER validates all pricing - frontend values are ignored
  
  Note: from_address is provided by the client (the wallet that signed the transaction).
  This allows users who signed up with email to still make payments with any Phantom wallet.
  """
  def confirm_payment(conn, %{
        "tx_signature" => tx_signature,
        "pack_type" => pack_type,
        "from_address" => from_address
      }) do
    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, _user} <- get_user(user_id),
         {:ok, pack_info} <- validate_pack_type(pack_type),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      
      # SERVER calculates expected SOL amount - cannot be manipulated by frontend
      expected_sol_amount = pack_info.usd / sol_usd_rate
      
      # Verify the on-chain transaction using the wallet address provided by the client
      # This is the wallet that actually signed and sent the transaction via Phantom
      case verify_transaction(tx_signature, from_address, expected_sol_amount) do
        {:ok, :verified} ->
          process_confirmed_payment(conn, tx_signature, pack_type, pack_info, expected_sol_amount, sol_usd_rate, user_id)
        
        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Payment verification failed: #{inspect(reason)}"})
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :user_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User not found"})

      {:error, :invalid_pack} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid pack type"})

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable"})
    end
  end
  
  # Fallback for requests without from_address (backward compatibility)
  def confirm_payment(conn, %{"tx_signature" => _tx_signature, "pack_type" => _pack_type} = params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required field: from_address. Please update your client."})
  end

  # ============================================================================
  # Organization Payment Endpoints (Crypto/SOL)
  # ============================================================================

  @doc """
  Generate a payment quote for organization credit purchase.
  Only organization admins can request quotes for org purchases.
  """
  def get_org_quote(conn, %{"organization_id" => org_id, "pack_type" => pack_type}) do
    alias ClippsterServer.Organizations

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, org} <- get_organization(org_id),
         true <- Organizations.is_admin?(org.id, user_id),
         {:ok, pack_info} <- validate_pack_type(pack_type),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      
      # Server calculates exact SOL amount
      sol_amount = pack_info.usd / sol_usd_rate
      company_wallet = Credits.get_company_wallet_address()
      
      # Generate quote with 5 minute expiry
      quote = %{
        pack_type: pack_type,
        hours: pack_info.hours,
        amount_usd: pack_info.usd,
        amount_sol: sol_amount,
        sol_usd_rate: sol_usd_rate,
        company_wallet: company_wallet,
        organization_id: org.id,
        organization_name: org.name,
        expires_at: DateTime.utc_now() |> DateTime.add(300, :second) |> DateTime.to_iso8601(),
        quote_id: generate_quote_id()
      }

      json(conn, %{
        success: true,
        quote: quote
      })
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :organization_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can purchase credits"})

      {:error, :invalid_pack} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid pack type"})

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable"})
    end
  end

  @doc """
  Confirm organization crypto payment - verifies on-chain transaction and adds to org pool.
  SERVER validates all pricing - frontend values are ignored.
  """
  def confirm_org_payment(conn, %{
        "organization_id" => org_id,
        "tx_signature" => tx_signature,
        "pack_type" => pack_type,
        "from_address" => from_address
      }) do
    alias ClippsterServer.Organizations

    with {:ok, user_id} <- get_user_id_from_token(conn),
         {:ok, org} <- get_organization(org_id),
         true <- Organizations.is_admin?(org.id, user_id),
         {:ok, pack_info} <- validate_pack_type(pack_type),
         {:ok, sol_usd_rate} <- ClippsterServer.PriceService.get_sol_price() do
      
      # SERVER calculates expected SOL amount - cannot be manipulated by frontend
      expected_sol_amount = pack_info.usd / sol_usd_rate
      
      # Verify the on-chain transaction
      case verify_transaction(tx_signature, from_address, expected_sol_amount) do
        {:ok, :verified} ->
          process_confirmed_org_payment(conn, org, pack_info)
        
        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Payment verification failed: #{inspect(reason)}"})
      end
    else
      {:error, :unauthorized} ->
        conn
        |> put_status(401)
        |> json(%{success: false, error: "Unauthorized"})

      {:error, :organization_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Organization not found"})

      false ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can purchase credits"})

      {:error, :invalid_pack} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Invalid pack type"})

      {:error, _reason} ->
        conn
        |> put_status(503)
        |> json(%{success: false, error: "Price service unavailable"})
    end
  end

  defp process_confirmed_org_payment(conn, org, pack_info) do
    alias ClippsterServer.Organizations

    # Add credits to organization pool
    case Organizations.add_organization_credits(org.id, pack_info.hours) do
      {:ok, org_credit} ->
        json(conn, %{
          success: true,
          message: "#{pack_info.hours} hours added to organization pool",
          balance: %{
            hours_remaining: Decimal.to_float(org_credit.hours_remaining),
            hours_used: Decimal.to_float(org_credit.hours_used)
          }
        })

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: "Failed to add org credits: #{inspect(reason)}"})
    end
  end

  defp get_organization(org_id) do
    alias ClippsterServer.Organizations

    org_id = if is_binary(org_id), do: String.to_integer(org_id), else: org_id
    case Organizations.get_organization(org_id) do
      nil -> {:error, :organization_not_found}
      org -> {:ok, org}
    end
  end

  defp process_confirmed_payment(conn, tx_signature, pack_type, pack_info, sol_amount, sol_usd_rate, user_id) do
    # Check if transaction already exists
    case Credits.get_transaction_by_signature(tx_signature) do
      nil ->
        # Create and confirm transaction
        attrs = %{
          user_id: user_id,
          pack_type: pack_type,
          hours_purchased: pack_info.hours,
          amount_usd: pack_info.usd,
          amount_sol: sol_amount,
          sol_usd_rate: sol_usd_rate,
          tx_signature: tx_signature,
          status: "pending"
        }

        case Credits.create_pending_transaction(attrs) do
          {:ok, _transaction} ->
            case Credits.confirm_transaction(tx_signature) do
              {:ok, %{transaction: confirmed_tx, user_credit: user_credit}} ->
                json(conn, %{
                  success: true,
                  transaction: %{
                    id: confirmed_tx.id,
                    hours_purchased: Decimal.to_float(confirmed_tx.hours_purchased),
                    status: confirmed_tx.status
                  },
                  balance: %{
                    hours_remaining: Decimal.to_float(user_credit.hours_remaining),
                    hours_used: Decimal.to_float(user_credit.hours_used)
                  }
                })

              {:error, reason} ->
                conn
                |> put_status(500)
                |> json(%{success: false, error: "Failed to confirm transaction", details: to_string(reason)})
            end

          {:error, changeset} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: "Failed to create transaction", details: format_changeset_errors(changeset)})
        end

      existing_transaction ->
        # Transaction already processed
        if existing_transaction.status == "confirmed" do
          {:ok, balance} = Credits.get_user_balance(user_id)
          json(conn, %{
            success: true,
            message: "Transaction already confirmed",
            balance: %{
              hours_remaining: Decimal.to_float(balance.hours_remaining),
              hours_used: Decimal.to_float(balance.hours_used)
            }
          })
        else
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Transaction already exists with status: #{existing_transaction.status}"})
        end
    end
  end

  # Private helper functions

  defp get_user_id_from_token(conn) do
    case get_token_claims(conn) do
      {:ok, claims} ->
        {:ok, claims["user_id"]}

      {:error, _} ->
        {:error, :unauthorized}
    end
  end

  defp get_token_claims(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] ->
        # TODO: Verify JWT token and extract claims
        # For now, we'll decode it without verification for development
        decode_token(token)

      _ ->
        {:error, :unauthorized}
    end
  end

  defp decode_token(token) do
    # Simple JWT decode without verification (for development)
    # In production, use proper JWT verification
    case String.split(token, ".") do
      [_header, payload, _signature] ->
        try do
          payload
          |> Base.url_decode64!(padding: false)
          |> Jason.decode()
        rescue
          _ -> {:error, :invalid_token}
        end

      _ ->
        {:error, :invalid_token}
    end
  end

  defp get_user(user_id) do
    case Accounts.get_user(user_id) do
      nil -> {:error, :user_not_found}
      user -> {:ok, user}
    end
  end

  defp validate_pack_type(pack_type) do
    case Credits.get_pack_info(pack_type) do
      nil -> {:error, :invalid_pack}
      pack_info -> {:ok, pack_info}
    end
  end

  defp generate_quote_id do
    :crypto.strong_rand_bytes(16) |> Base.encode16(case: :lower)
  end

  defp verify_transaction(tx_signature, from_address, expected_sol_amount) do
    company_wallet = Credits.get_company_wallet_address()

    payload =
      Jason.encode!(%{
        tx_signature: tx_signature,
        from_address: from_address,
        to_address: company_wallet,
        expected_sol_amount: expected_sol_amount,
        rpc_url: System.get_env("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
      })

    IO.puts("\n=== Verifying Solana payment transaction ===")
    IO.puts("TX Signature: #{tx_signature}")
    IO.puts("From: #{from_address}")
    IO.puts("To: #{company_wallet}")
    IO.puts("Expected SOL: #{expected_sol_amount}")

    # Write payload to temp file
    temp_file = Path.join(System.tmp_dir!(), "payment_verify_#{:erlang.unique_integer([:positive])}.json")
    File.write!(temp_file, payload)

    # Call the Node.js verification script
    script_path = Path.join([Path.dirname(__ENV__.file), "../../payment_verify.js"]) |> Path.expand()
    node_path = find_node_executable()

    IO.puts("Node path: #{node_path}")
    IO.puts("Script path: #{script_path}")

    result =
      case System.cmd(node_path, [script_path, temp_file], stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, %{"valid" => true}} ->
              IO.puts("✓ Payment verified!")
              {:ok, :verified}

            {:ok, %{"valid" => false, "error" => error}} ->
              IO.puts("✗ Payment verification failed: #{error}")
              {:error, :transaction_verification_failed}

            {:error, _} ->
              IO.puts("Error parsing verification result")
              {:error, :transaction_verification_failed}
          end

        {output, _exit_code} ->
          IO.puts("Node.js verification failed: #{output}")
          {:error, :transaction_verification_failed}
      end

    # Clean up temp file
    File.rm(temp_file)
    result
  end

  # Find the actual node executable, avoiding wrapper scripts (same as auth_controller)
  defp find_node_executable do
    case :os.type() do
      {:win32, _} ->
        case System.cmd("where", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            output
            |> String.split("\n", trim: true)
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&String.contains?(&1, "yarn--"))
            |> Enum.reject(&String.contains?(&1, "Temp"))
            |> Enum.find(&String.ends_with?(&1, "node.exe"))
            |> case do
              nil -> "node"
              path -> path
            end

          _ ->
            [
              System.get_env("ProgramFiles") <> "\\nodejs\\node.exe",
              System.get_env("ProgramFiles(x86)") <> "\\nodejs\\node.exe",
              "C:\\Program Files\\nodejs\\node.exe",
              "C:\\Program Files (x86)\\nodejs\\node.exe"
            ]
            |> Enum.find(&File.exists?/1)
            |> case do
              nil -> "node"
              path -> path
            end
        end

      {:unix, _} ->
        case System.cmd("which", ["node"], stderr_to_stdout: true) do
          {output, 0} ->
            output
            |> String.split("\n", trim: true)
            |> List.first()
            |> String.trim()

          _ ->
            ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]
            |> Enum.find(&File.exists?/1)
            |> case do
              nil -> "node"
              path -> path
            end
        end
    end
  end

  defp format_changeset_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
