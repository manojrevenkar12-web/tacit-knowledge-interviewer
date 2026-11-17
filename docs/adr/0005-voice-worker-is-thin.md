# 5. The voice worker is a thin LiveKit agent over the memory's API

## Context
Speech-to-text, turn-taking and the room belong to LiveKit; the interview logic, the graph and the costs belong to
the memory service, which also has to run without voice (tests, the simulated world, typed interviews).

## Decision
The Python worker (LiveKit Agents) handles audio with OpenAI or Azure OpenAI STT and TTS. Its `llm_node` does not
call a model: it posts the expert's words to the memory service and speaks the next question it returns. The
console gets a LiveKit token from its own server route and never sees an API key.

## Consequences
One interviewer serves voice and text the same way, and the simulated experts drive it through the same HTTP calls
the worker makes. The voice path is tested with a fake brain; it has not been run against a live LiveKit server.
