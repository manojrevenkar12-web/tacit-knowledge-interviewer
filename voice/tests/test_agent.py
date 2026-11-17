import pytest
from livekit.agents import AgentSession

from interviewer.agent import GOODBYE, InterviewAgent
from interviewer.brain import Question


class FakeBrain:
    def __init__(self) -> None:
        self.answers: list[tuple[int, str]] = []

    async def start(self, expert: str) -> Question:
        return Question("iv-1", 1, "drying", "open", f"Wie läuft bei Ihnen die Materialtrocknung ab, {expert}?")

    async def answer(self, q: Question, text: str, minute: float):
        self.answers.append((q.turn, text))
        if q.turn >= 2:
            return None
        return Question("iv-1", q.turn + 1, "drying", "failure", "Was geht dabei typischerweise schief?")


@pytest.mark.asyncio
async def test_each_answer_goes_to_the_brain_and_its_next_question_is_spoken():
    brain = FakeBrain()
    agent = InterviewAgent(brain, "E3", clock=lambda: 0.0)
    async with AgentSession() as session:
        await session.start(agent)
        await session.wait_for_idle()
        assert agent.current is not None and agent.current.turn == 1

        def last_said(r):
            return [e for e in r.events if getattr(e, "type", "") == "message"][-1].item.text_content

        r = await session.run(user_input="Wir trocknen PA6-GF30 sechs Stunden.")
        assert last_said(r) == "Was geht dabei typischerweise schief?"
        assert brain.answers[-1] == (1, "Wir trocknen PA6-GF30 sechs Stunden.")
        r = await session.run(user_input="Bei Schwüle trocknen wir länger.")
        assert last_said(r) == GOODBYE
        assert brain.answers[-1] == (2, "Bei Schwüle trocknen wir länger.")
        assert agent.finished


@pytest.mark.asyncio
async def test_reply_to_starts_the_interview_once_and_counts_minutes():
    t = [100.0]
    brain = FakeBrain()
    agent = InterviewAgent(brain, "E1", clock=lambda: t[0])
    q = await agent.reply_to(None)
    assert q.startswith("Wie läuft")
    t[0] += 90
    assert agent.minutes() == pytest.approx(1.5)
    assert await agent.reply_to("") == q
