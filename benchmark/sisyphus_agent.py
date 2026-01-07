#!/usr/bin/env python3
import json
import os
import shlex
from datetime import datetime, timezone
from pathlib import Path

from harbor.agents.installed.base import BaseInstalledAgent, ExecInput
from harbor.models.agent.context import AgentContext
from harbor.models.trajectories import (
    Agent,
    FinalMetrics,
    Metrics,
    Observation,
    ObservationResult,
    Step,
    ToolCall,
    Trajectory,
)


class SisyphusAgent(BaseInstalledAgent):
    def __init__(
        self,
        logs_dir: Path,
        prompt_template_path: Path | str | None = None,
        version: str | None = None,
        omo_version: str | None = None,
        *args,
        **kwargs,
    ):
        super().__init__(logs_dir, prompt_template_path, version, *args, **kwargs)
        self._omo_version = omo_version or "latest"

    @staticmethod
    def name() -> str:
        return "sisyphus"

    @property
    def _install_agent_template_path(self) -> Path:
        return Path(__file__).parent / "install-sisyphus.sh.j2"

    @property
    def _template_variables(self) -> dict[str, str]:
        variables = super()._template_variables
        variables["omo_version"] = self._omo_version
        return variables

    def create_run_agent_commands(self, instruction: str) -> list[ExecInput]:
        escaped_instruction = shlex.quote(instruction)

        if not self.model_name or "/" not in self.model_name:
            raise ValueError("Model name must be in the format provider/model_name")

        provider, _ = self.model_name.split("/", 1)

        env = self._get_provider_env(provider)
        env["OPENCODE_FAKE_VCS"] = "git"

        return [
            ExecInput(
                command=(
                    f"opencode --model {self.model_name} run "
                    f"--agent Sisyphus --format=json {escaped_instruction} "
                    f"2>&1 | tee /logs/agent/sisyphus.txt"
                ),
                env=env,
            )
        ]

    def _get_provider_env(self, provider: str) -> dict[str, str]:
        env = {}
        keys = []

        provider_keys = {
            "amazon-bedrock": [
                "AWS_ACCESS_KEY_ID",
                "AWS_SECRET_ACCESS_KEY",
                "AWS_REGION",
            ],
            "anthropic": ["ANTHROPIC_API_KEY"],
            "azure": ["AZURE_RESOURCE_NAME", "AZURE_API_KEY"],
            "deepseek": ["DEEPSEEK_API_KEY"],
            "github-copilot": ["GITHUB_TOKEN"],
            "google": [
                "GEMINI_API_KEY",
                "GOOGLE_GENERATIVE_AI_API_KEY",
                "GOOGLE_APPLICATION_CREDENTIALS",
                "GOOGLE_CLOUD_PROJECT",
                "GOOGLE_CLOUD_LOCATION",
                "GOOGLE_GENAI_USE_VERTEXAI",
                "GOOGLE_API_KEY",
            ],
            "groq": ["GROQ_API_KEY"],
            "huggingface": ["HF_TOKEN"],
            "llama": ["LLAMA_API_KEY"],
            "mistral": ["MISTRAL_API_KEY"],
            "openai": ["OPENAI_API_KEY"],
            "xai": ["XAI_API_KEY"],
        }

        keys = provider_keys.get(provider, [])
        if not keys:
            raise ValueError(f"Unknown provider {provider}")

        for key in keys:
            if key in os.environ:
                env[key] = os.environ[key]

        return env

    def populate_context_post_run(self, context: AgentContext) -> None:
        output_file = self.logs_dir / "command-0" / "stdout.txt"
        if not output_file.exists():
            return

        trajectory = self._parse_opencode_output(output_file)
        if trajectory:
            trajectory_path = self.logs_dir / "trajectory.json"
            with open(trajectory_path, "w") as f:
                json.dump(trajectory.to_json_dict(), f, indent=2)

            if trajectory.final_metrics:
                context.cost_usd = trajectory.final_metrics.total_cost_usd
                context.n_input_tokens = trajectory.final_metrics.total_prompt_tokens
                context.n_output_tokens = (
                    trajectory.final_metrics.total_completion_tokens
                )

    def _parse_opencode_output(self, output_file: Path) -> Trajectory | None:
        content = output_file.read_text()
        events = []

        for line in content.split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
            except json.JSONDecodeError:
                continue

        if not events:
            return None

        steps = []
        step_id = 1
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_cost = 0.0

        for event in events:
            event_type = event.get("type", "")
            timestamp = event.get("timestamp", datetime.now(timezone.utc).isoformat())

            if event_type == "user":
                steps.append(
                    Step(
                        step_id=step_id,
                        timestamp=timestamp,
                        source="user",
                        message=event.get("content", ""),
                    )
                )
                step_id += 1

            elif event_type == "assistant":
                tool_calls = []
                observation = None

                if "tool_calls" in event:
                    for tc in event["tool_calls"]:
                        tool_calls.append(
                            ToolCall(
                                tool_call_id=tc.get("id", f"call_{step_id}"),
                                function_name=tc.get("name", ""),
                                arguments=tc.get("arguments", {}),
                            )
                        )

                if "tool_results" in event:
                    results = []
                    for tr in event["tool_results"]:
                        results.append(
                            ObservationResult(
                                source_call_id=tr.get("call_id", ""),
                                content=tr.get("content", ""),
                            )
                        )
                    if results:
                        observation = Observation(results=results)

                metrics = None
                if "usage" in event:
                    usage = event["usage"]
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    cost = usage.get("cost", 0.0)

                    total_prompt_tokens += prompt_tokens
                    total_completion_tokens += completion_tokens
                    total_cost += cost

                    metrics = Metrics(
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        cost_usd=cost,
                    )

                steps.append(
                    Step(
                        step_id=step_id,
                        timestamp=timestamp,
                        source="agent",
                        model_name=self.model_name,
                        message=event.get("content", ""),
                        reasoning_content=event.get("thinking", None),
                        tool_calls=tool_calls if tool_calls else None,
                        observation=observation,
                        metrics=metrics,
                    )
                )
                step_id += 1

        if not steps:
            return None

        return Trajectory(
            schema_version="ATIF-v1.4",
            session_id=f"sisyphus-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            agent=Agent(
                name="sisyphus",
                version=self._omo_version,
                model_name=self.model_name,
            ),
            steps=steps,
            final_metrics=FinalMetrics(
                total_prompt_tokens=total_prompt_tokens,
                total_completion_tokens=total_completion_tokens,
                total_cost_usd=total_cost,
                total_steps=len(steps),
            ),
        )


if __name__ == "__main__":
    print(f"SisyphusAgent registered: {SisyphusAgent.name()}")
