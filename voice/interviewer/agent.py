"""A LiveKit voice agent that runs an expert interview. Speech in, speech out; every question comes from the brain."""

from __future__ import annotations

import time

from livekit.agents import Agent, llm
from livekit.agents.voice import ModelSettings

from .brain import Brain, Question

GOODBYE = "Vielen Dank für Ihre Zeit. Das Interview ist für heute beendet."


class BrainSlot(llm.LLM):
    """Stands where the voice pipeline expects a language model. It is never asked: llm_node below asks the brain."""

    @property
    def model(self) -> str:
        return "interview-brain"

    def chat(self, **kwargs):  # pragma: no cover - never called
        raise RuntimeError("the interview brain plans the questions; no model is asked here")


class InterviewAgent(Agent):
    """Replaces the language model of the voice pipeline with the interview brain: the user's words go to the brain
    as the answer, and the brain's next question is what the agent says."""

    def __init__(self, brain: Brain, expert: str, clock=time.monotonic) -> None:
        super().__init__(
            instructions="Sie führen ein Experteninterview auf Deutsch. Die Fragen kommen aus dem Interviewplan.",
            llm=BrainSlot(),
        )
        self._brain = brain
        self._expert = expert
        self._clock = clock
        self._started: float | None = None
        self.current: Question | None = None
        self.finished = False

    async def on_enter(self) -> None:
        self.session.generate_reply()

    def minutes(self) -> float:
        return 0.0 if self._started is None else (self._clock() - self._started) / 60.0

    async def reply_to(self, user_text: str | None) -> str:
        if self.finished:
            return GOODBYE
        if self.current is None:
            self._started = self._clock()
            self.current = await self._brain.start(self._expert)
            return self.current.text
        if not user_text:
            return self.current.text
        nxt = await self._brain.answer(self.current, user_text, self.minutes())
        if nxt is None:
            self.finished = True
            return GOODBYE
        self.current = nxt
        return nxt.text

    async def llm_node(self, chat_ctx: llm.ChatContext, tools: list[llm.Tool], model_settings: ModelSettings) -> str:
        last = None
        for item in reversed(chat_ctx.items):
            if getattr(item, "role", None) == "user":
                last = item.text_content
                break
        return await self.reply_to(last)
