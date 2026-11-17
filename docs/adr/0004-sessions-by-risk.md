# 4. The next interview goes to the knowledge most at risk

## Context
Experts leave on known dates. Time spent with someone who stays, on a topic three people know, does not protect
anything.

## Decision
The planner scores each expert and topic by urgency (months left), whether the topic is critical, and how much is
probably still uncaptured (a prior per topic minus what the graph holds, lowered after a session on it). It picks
the highest expert who has sessions left and gives the interviewer two focus topics.

## Consequences
On the simulated company this helps only a little against a plain round robin, because the gap-driven interviewer
already captures most of what each session can reach. The README says so. The planner matters more when expert
time is shorter than in the simulation.
