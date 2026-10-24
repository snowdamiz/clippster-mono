defmodule ClippsterServer.AI.VideoAgentPrompts do
  @moduledoc """
  The video agent's and planner's system prompts and the agent's on-demand skills, embedded at
  compile time so the cached prompt prefixes are byte-identical on every request.

  Skills are addressed by their path under `priv/prompts/video_agent/skills` without `.md`
  (for example `hyperframes-core/references/sub-compositions`). Only embedded files resolve.
  """

  @root Path.expand("../../../priv/prompts/video_agent", __DIR__)
  @skills_root Path.join(@root, "skills")

  @external_resource Path.join(@root, "system.md")
  @system_prompt File.read!(Path.join(@root, "system.md"))
  @external_resource Path.join(@root, "plan.md")
  @plan_prompt File.read!(Path.join(@root, "plan.md"))

  @skill_paths Path.wildcard(Path.join(@skills_root, "**/*.md"))
  for path <- @skill_paths, do: @external_resource(path)

  @skills Map.new(@skill_paths, fn path ->
            name = path |> Path.relative_to(@skills_root) |> Path.rootname(".md")
            {name, File.read!(path)}
          end)

  @skill_names @skills |> Map.keys() |> Enum.sort()

  # Recompile when skills are added or removed, not only when an embedded file changes.
  def __mix_recompile__? do
    Path.wildcard(Path.join(@skills_root, "**/*.md")) |> Enum.sort() != Enum.sort(@skill_paths)
  end

  @spec system_prompt() :: String.t()
  def system_prompt, do: @system_prompt

  @spec plan_prompt() :: String.t()
  def plan_prompt, do: @plan_prompt

  @spec skill_names() :: [String.t()]
  def skill_names, do: @skill_names

  @doc "Content of one skill. Accepts an optional `.md` suffix and a `SKILL` file by folder name."
  @spec skill(String.t()) :: {:ok, String.t()} | {:error, String.t()}
  def skill(name) when is_binary(name) do
    normalized = name |> String.trim() |> String.trim_leading("/") |> String.replace_suffix(".md", "")

    case Map.fetch(@skills, normalized) do
      {:ok, content} ->
        {:ok, content}

      :error ->
        case Map.fetch(@skills, normalized <> "/SKILL") do
          {:ok, content} -> {:ok, content}
          :error -> {:error, "No skill named #{inspect(name)}. Available: #{Enum.join(@skill_names, ", ")}"}
        end
    end
  end

  def skill(_), do: {:error, "Skill name must be a string."}
end
