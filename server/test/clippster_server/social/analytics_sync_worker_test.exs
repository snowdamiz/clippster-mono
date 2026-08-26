defmodule ClippsterServer.Social.AnalyticsSyncWorkerTest do
  use ExUnit.Case, async: true

  alias ClippsterServer.Social.AnalyticsSyncWorker

  test "only Post For Me accounts can enter feed analytics sync" do
    assert AnalyticsSyncWorker.post_for_me_account?(%{provider: "post_for_me"})
    refute AnalyticsSyncWorker.post_for_me_account?(%{provider: "tokend"})
    refute AnalyticsSyncWorker.post_for_me_account?(%{provider: nil})
  end
end
