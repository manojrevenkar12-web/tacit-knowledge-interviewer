"""The LiveKit worker: joins the interview room, listens in German, and speaks the brain's questions.

Run: python -m interviewer.worker dev   (needs LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, MEMORY_URL, MEMORY_KEY,
and either OPENAI_API_KEY or the AZURE_OPENAI_* variables for speech-to-text and text-to-speech.)
"""

from __future__ import annotations

import json
import os

from livekit.agents import AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import openai

from .agent import InterviewAgent
from .brain import HttpBrain


def speech():
    """Speech-to-text and text-to-speech from Azure OpenAI when it is configured, otherwise from OpenAI."""
    if os.environ.get("AZURE_OPENAI_ENDPOINT"):
        return (
            openai.STT.with_azure(model=os.environ.get("STT_MODEL", "gpt-4o-transcribe"), language="de"),
            openai.TTS.with_azure(model=os.environ.get("TTS_MODEL", "gpt-4o-mini-tts"), voice=os.environ.get("TTS_VOICE", "alloy")),
        )
    return (
        openai.STT(model=os.environ.get("STT_MODEL", "gpt-4o-transcribe"), language="de"),
        openai.TTS(model=os.environ.get("TTS_MODEL", "gpt-4o-mini-tts"), voice=os.environ.get("TTS_VOICE", "alloy")),
    )


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    meta = json.loads(ctx.job.metadata or ctx.room.metadata or "{}")
    stt, tts = speech()
    brain = HttpBrain(os.environ.get("MEMORY_URL", "http://localhost:8795"), os.environ.get("MEMORY_KEY", "km-demo-key"))
    session = AgentSession(stt=stt, tts=tts)
    await session.start(agent=InterviewAgent(brain, meta.get("expert", "E1")), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="expert-interviewer"))
