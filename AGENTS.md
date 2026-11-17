# Working in tacit-knowledge-interviewer

Fast feedback first: `npm test` runs the normaliser, graph, policy, answer, service (on PGlite, PostgreSQL in WASM with
pgvector) and invariant tests in under half a minute. `npm run typecheck` checks the core. For the console:
`cd web && npm test && npm run typecheck`. For the voice worker: `cd voice && pip install -e '.[test]' && pytest`.

After any change to the interviewer, the pipeline, the agents, the world or the settings run

```bash
npm run evaluate && npm run gate && npm run seed && npm run readme
```

and commit the regenerated `reports/`, `demo/seed.json` and `README.md`. CI fails when they disagree with the code.

## Layout

| path | what it is | may import |
|---|---|---|
| `src/product/interview` | the gap policy and the LangGraph interviewer (choose → word → ask → listen) | `src/wire.ts`, `src/config.ts`, the product |
| `src/product/pipeline` | turns into claims, the knowledge graph, hybrid search | the same |
| `src/product/agents` | the answer agent and the risk planner | the same |
| `src/product/service` | the memory service (Fastify, PostgreSQL or PGlite with pgvector) | the same |
| `src/world` | the simulated company: experts, what they know, how they talk, the models | `src/wire.ts`, `src/keyed.ts`, `src/config.ts` |
| `src/eval` | runs the designs on the world, scores, reports, the README | everything |
| `web` | the Next.js console | the memory's HTTP API, through its own server routes |
| `voice` | the LiveKit Agents worker | the memory's HTTP API |

## Invariants (checked in `tests/invariants.test.ts` and the tests)

1. **The truth stays in the world.** `src/product` never imports `src/world` or `src/eval`. The demo seed holds what
   the platform heard and kept, never what the experts really know.
2. **The world does not read the platform's settings.** `src/world` reads `config/world.json` only, never
   `product.json`, `designs.json`, `gate.json` or `service.json`.
3. **Same luck for every design.** Every random draw is keyed by what it is about (`src/keyed.ts`): the expert, the
   piece of knowledge, the question, the model call. Two designs that ask the same question get the same answer.
4. **The model reads and code decides.** The model words the question and quotes what was said. Code picks the next
   move, checks every quote against the transcript, reads numbers and identifiers, decides what the graph keeps, which
   claims an answer may cite, and writes the conflict and single-source warnings. Only the `free_llm` design lets the
   model run the interview.
5. **Settings in config.** Models, routes, prices, the yield table, thresholds, the planner and the designs live in
   `config/`; the console's colours, type and durations in `web/src/shared/theme.css` and `tokens.ts`.
6. **Generated reports.** README numbers come from `reports/`; the README is written by `npm run readme`.

## The held-out rule

`config/heldout.json` is run once: `npm run lock` records a fingerprint of the platform (code, prompts, knowledge,
settings) in `config/heldout.lock`; `npm run heldout` then refuses any other platform and refuses to run twice. It
writes `reports/heldout.json`; findings go into `docs/heldout.md`. Fixes are made and measured on the dev seeds. The
held-out seeds are not run again and `config/gate.json` is not moved.
