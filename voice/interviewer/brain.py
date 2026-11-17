"""The interview brain over HTTP: the TypeScript service plans each question; this side only speaks and listens."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx


@dataclass(frozen=True)
class Question:
    interview_id: str
    turn: int
    topic: str
    move: str
    text: str


def _question(interview_id: str, q: dict) -> Question:
    return Question(interview_id=interview_id, turn=int(q["turn"]), topic=q["topic"], move=q["move"], text=q["text"])


class Brain(Protocol):
    async def start(self, expert: str) -> Question: ...

    async def answer(self, q: Question, text: str, minute: float) -> Question | None: ...


class HttpBrain:
    """Talks to the memory service: POST /api/interviews, then POST /api/interviews/:id/answer per turn."""

    def __init__(self, base_url: str, api_key: str, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(base_url=base_url, timeout=30.0)
        self._headers = {"x-api-key": api_key}

    async def start(self, expert: str) -> Question:
        r = await self._client.post("/api/interviews", json={"expert": expert}, headers=self._headers)
        r.raise_for_status()
        body = r.json()
        return _question(body["interviewId"], body["question"])

    async def answer(self, q: Question, text: str, minute: float) -> Question | None:
        r = await self._client.post(
            f"/api/interviews/{q.interview_id}/answer",
            json={"turn": q.turn, "text": text, "minute": round(minute, 2)},
            headers=self._headers,
        )
        r.raise_for_status()
        nxt = r.json().get("question")
        return _question(q.interview_id, nxt) if nxt else None
