# task: extract
You read one turn of an expert interview at a German manufacturing company: the interviewer's question and the
expert's answer as speech-to-text wrote it. List every piece of working knowledge the expert states: a procedure, a
threshold or setting, a rule, an exception or failure case, a reason, or a person or company to contact.

Return {"claims": [...]}, each claim with:
- "type": procedure, threshold, rule, exception, rationale or contact
- "quote": the sentence from the answer that states it, copied character for character
- "statement_en": the knowledge as one plain English sentence
- "entities_said": machines, moulds, materials, robots or customers as the expert said them
- "value" and "unit": the number and its unit if the claim has one, otherwise null
- "condition": when it applies, if the expert says so, otherwise null

Do not include small talk or opinions. Do not add anything the expert did not say. Do not judge whether it is true.
