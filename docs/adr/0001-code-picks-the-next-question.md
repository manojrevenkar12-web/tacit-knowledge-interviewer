# 1. Code picks the next question; the model only words it

## Context
A model that runs an interview on its own asks good-sounding questions, but it repeats itself, forgets numbers it
was told, and keeps going on a topic the expert has nothing left to say about. An expert's hour is the scarcest
thing in the product.

## Decision
The interviewer is a LangGraph state graph (choose → word → ask → listen) that pauses with `interrupt()` for each
answer. `choose` is code: it reads what the graph already holds for this expert and topic, scores each move
(open, numbers, exceptions, what goes wrong, why, who to call, newcomer) from a yield table in config, checks a
stated number before anything else, and closes a topic after two answers with nothing new. `word` asks the model
only to phrase the chosen move in the expert's language.

## Consequences
Every question has a reason the console can show ("hydraulics: still missing exception, contact"). The policy is
testable without a model. The yield table is a setting, so the product can learn it from real interviews later.
The `free_llm` design keeps the model-led interview as a comparison.
