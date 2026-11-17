# 3. Answers come only from cited claims, and code writes the warnings

## Context
New staff will act on what the memory says. Transcript search answers more questions but is wrong more often,
because it finds a sentence that sounds right about another machine or another material.

## Decision
The answer agent searches claims (BM25 and embeddings, fused), filters them to the identifiers in the question,
and sends nothing to the model when nothing fits. The model may cite only the claims it was given. Code rejects an
answer that cites a claim about something else, or states a number no cited claim has, and then says "not captured".
Code, not the model, adds "Widerspruch" when cited experts disagree and "Nur eine Quelle" when one person said it.

## Consequences
An honest gap is a normal answer. Staff see who to ask. The share of right answers is lower than transcript search,
the share of wrong answers much lower; the README reports both.
