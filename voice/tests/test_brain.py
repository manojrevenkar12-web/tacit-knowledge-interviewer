import json

import httpx
import pytest

from interviewer.brain import HttpBrain


@pytest.mark.asyncio
async def test_http_brain_speaks_the_service_api():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, request.headers["x-api-key"], json.loads(request.content or b"{}")))
        if request.url.path == "/api/interviews":
            return httpx.Response(200, json={"interviewId": "iv-1", "question": {"turn": 1, "topic": "drying", "move": "open", "text": "Wie läuft es?"}})
        return httpx.Response(200, json={"question": None, "claims": []})

    client = httpx.AsyncClient(base_url="http://memory", transport=httpx.MockTransport(handler))
    brain = HttpBrain("http://memory", "km-demo-key", client)
    q = await brain.start("E1")
    assert (q.interview_id, q.turn, q.text) == ("iv-1", 1, "Wie läuft es?")
    assert await brain.answer(q, "Sechs Stunden.", 0.7) is None
    assert seen == [
        ("POST", "/api/interviews", "km-demo-key", {"expert": "E1"}),
        ("POST", "/api/interviews/iv-1/answer", "km-demo-key", {"turn": 1, "text": "Sechs Stunden.", "minute": 0.7}),
    ]
