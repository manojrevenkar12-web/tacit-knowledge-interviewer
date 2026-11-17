# 2. A claim is a quote the expert said, with a name and a minute

## Context
Summaries of transcripts drift: a model rounds a number, merges two experts' answers, or fills a gap. In a factory
a wrong drying time or temperature is worse than a missing one.

## Decision
The extraction prompt returns quotes and a type. Code keeps a claim only if the quote is in the turn, it is not
small talk, and it reads the numbers, units and identifiers from the quote itself ("SGM sieben" → SGM-07,
"sechs Stunden bei achtzig Grad" → 6 h, 80 °C). Claims about the same subject (topic, identifiers, unit, condition)
are compared: one value from two experts is corroborated, two values are a conflict, an expert's answer to a check
replaces what they said before.

## Consequences
Every fact in the memory links to a person, an interview and a minute. Conflicts are surfaced for people to settle,
not resolved by the model. An expert who confirms a wrong value stays wrong; the product cannot know better.
