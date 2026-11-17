# Held-out run

**The gate holds on the held-out seeds, with less room than on dev.** The platform captured 87% of what the experts
knew (dev 90%), 91% of the leaving experts' critical knowledge (dev 97%), and answered 70% of staff questions right
(dev 76%) with 4.0% wrong (dev 1.8%). It kept 5 wrong values as fact across five companies (dev 2). Every limit in
`config/gate.json` passes, the right-answer floor of 70% by a fraction of a point. The gate was not moved.

**The risk planner did not beat alphabetical order here.** With the same interviewer, sessions in alphabetical order
captured 90% against the planner's 87%, and answered more questions right, while the planner kept a small lead on
the leaving experts' critical knowledge (91% against 89%). On dev the planner was ahead on both. What carries the
result is the gap-driven interviewer and the checks, not the order of the sessions; the planner's case rests on
companies where expert time runs out before everyone is interviewed, which this simulation does not stress.

**Checking stated values matters as much on held-out as on dev.** Without the check (`no_check`) the memory kept 13
wrong values as fact against the platform's 5.

**Transcript search stays wrong about one answer in five** (21.8% with the platform's interviews, `graph_off`), the
graph 4.0%.

## The first attempt crashed, and what changed

The first held-out attempt stopped before it wrote any scores. On one held-out company both models on the
extraction route returned 503 for the same turn, and the interview threw instead of going on: in production that is
an expert left mid-sentence. The fix, made and measured on dev before re-locking:

- the gateway tries an overloaded model again (`retries` in `config/product.json`) before moving to the next model;
- if every model on a route is still down, the question is asked from a template in config, and the answer is kept
  in the transcript as unread instead of being dropped or counted as "nothing new";
- `tests/outage.test.ts` covers both.

Dev results did not change beyond a tenth of a point. The first lock (`9a249df0…`) was replaced by the lock of the
fixed platform (`2d289e16…`, in `config/heldout.lock`), and the held-out seeds were then run once. No turn was left
unread in that run.
