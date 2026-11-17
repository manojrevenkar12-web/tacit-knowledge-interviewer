# Repeatable tasks

## Add a topic or an expert
1. Add it to `TOPICS` or `EXPERTS` in `src/world/company.ts`, with the knowledge units that belong to it.
2. `npm run org` regenerates `knowledge/org.json` (what the company tells the platform: names, roles, leaving dates, critical topics).
3. If the topic has new machines, moulds or materials, add them to `knowledge/glossary.json` with their spoken forms.
4. `npm run evaluate && npm run gate && npm run seed && npm run readme`.

## Teach the reader a new identifier or unit
1. Add the identifier to `knowledge/glossary.json` (canonical form and spoken forms) or the unit to
   `src/product/pipeline/normalize.ts`.
2. Add the spoken case to `tests/pipeline.test.ts` ("SGM sieben" → SGM-07).
3. Regenerate as above.

## Change how the interviewer chooses
1. The yield table, type weights, topic factors and stopping rule are in `config/product.json` under `interview`.
2. Check `tests/interview.test.ts`, then `npm run evaluate`: a change counts when captured knowledge or expert time
   improves on all dev seeds, not on one.

## Change a prompt or a route
1. Edit `prompts/*.md` or the routes in `config/product.json`.
2. `npm test`, then `npm run evaluate`; read the change in wrong facts and wrong answers before captured share.

## Point the platform at real models
1. Set `OPENAI_BASE_URL` and `OPENAI_API_KEY` (OpenAI, Azure OpenAI's OpenAI-compatible endpoint, or a LiteLLM proxy)
   and the model names and prices in `config/product.json`.
2. For voice, set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and either `OPENAI_API_KEY` or
   `AZURE_OPENAI_ENDPOINT` for the worker, then `cd voice && python -m interviewer.worker dev`.

## Run the held-out seeds
Once, at the end: `npm run lock && npm run heldout`, then write `docs/heldout.md` and `npm run readme`.
