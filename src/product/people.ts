import { readJson } from '../config.ts'
import type { ExpertProfile, TopicProfile } from '../wire.ts'

/** The org chart and the topic list the customer gives the platform at onboarding. */
export const ORG = readJson<{ experts: ExpertProfile[]; topics: TopicProfile[] }>('knowledge/org.json')
export const EXPERT_NAMES: Record<string, string> = Object.fromEntries(ORG.experts.map((e) => [e.id, e.name]))
