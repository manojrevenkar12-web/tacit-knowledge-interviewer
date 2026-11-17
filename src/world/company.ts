import type { ExpertProfile, KuType, Move, TopicProfile } from '../wire.ts'

/**
 * Hessler Kunststofftechnik GmbH: an invented injection-moulding company in Hessen, about 400 staff. Every name,
 * machine, number and customer here is made up. This file is the company's real knowledge: what is in people's heads.
 */

export const TOPICS: TopicProfile[] = [
  { id: 'drying', de: 'Materialtrocknung', en: 'material drying', critical: true },
  { id: 'startup', de: 'Anfahren der Maschinen', en: 'machine start-up', critical: true },
  { id: 'toolchange', de: 'Werkzeugwechsel', en: 'tool change', critical: true },
  { id: 'colour', de: 'Farbwechsel', en: 'colour change', critical: false },
  { id: 'mouldtemp', de: 'Werkzeugtemperierung', en: 'mould temperature control', critical: true },
  { id: 'hydraulics', de: 'Hydraulik-Wartung', en: 'hydraulics maintenance', critical: true },
  { id: 'robot', de: 'Entnahmeroboter', en: 'take-out robot', critical: false },
  { id: 'firstarticle', de: 'Erstmusterprüfung', en: 'first article inspection', critical: true },
  { id: 'complaints', de: 'Reklamationen', en: 'customer complaints', critical: false },
  { id: 'substitutes', de: 'Materialersatz im Einkauf', en: 'material substitutes', critical: true },
  { id: 'handover', de: 'Schichtübergabe', en: 'shift handover', critical: false },
  { id: 'regrind', de: 'Mahlgut und Ausschuss', en: 'regrind and scrap', critical: false },
]

export const EXPERTS: ExpertProfile[] = [
  { id: 'E1', name: 'Werner Kraus', role: 'Schichtleiter Spritzguss', topics: ['startup', 'toolchange', 'colour', 'regrind', 'handover'], leavesInMonths: 4 },
  { id: 'E2', name: 'Gisela Brandt', role: 'Leiterin Instandhaltung', topics: ['hydraulics', 'mouldtemp', 'robot', 'startup'], leavesInMonths: 7 },
  { id: 'E3', name: 'Hakan Yılmaz', role: 'Prozessingenieur', topics: ['drying', 'startup', 'mouldtemp', 'regrind'], leavesInMonths: null },
  { id: 'E4', name: 'Petra Neumann', role: 'Qualitätssicherung', topics: ['firstarticle', 'complaints', 'regrind'], leavesInMonths: null },
  { id: 'E5', name: 'Jürgen Albers', role: 'Einkauf Rohstoffe', topics: ['substitutes', 'drying', 'complaints'], leavesInMonths: 10 },
  { id: 'E6', name: 'Svenja Roth', role: 'Schichtleiterin', topics: ['handover', 'toolchange', 'colour'], leavesInMonths: null },
  { id: 'E7', name: 'Tomasz Wójcik', role: 'Einrichter', topics: ['robot', 'toolchange', 'colour', 'mouldtemp'], leavesInMonths: null },
  { id: 'E8', name: 'Ingrid Falk', role: 'Kundenservice', topics: ['complaints', 'firstarticle', 'substitutes'], leavesInMonths: null },
]

/** Things with identifiers, and how people say them out loud (which is what speech-to-text writes). */
export const ENTITIES: { id: string; kind: 'machine' | 'tool' | 'material' | 'customer' | 'robot'; spoken: string[] }[] = [
  { id: 'SGM-03', kind: 'machine', spoken: ['SGM-03', 'SGM drei', 'SGM 3'] },
  { id: 'SGM-07', kind: 'machine', spoken: ['SGM-07', 'SGM sieben', 'SGM 7'] },
  { id: 'SGM-11', kind: 'machine', spoken: ['SGM-11', 'SGM elf', 'SGM 11'] },
  { id: 'WZ-4711', kind: 'tool', spoken: ['WZ-4711', 'Werkzeug 4711', 'WZ 47 11'] },
  { id: 'WZ-2290', kind: 'tool', spoken: ['WZ-2290', 'Werkzeug 2290', 'WZ 22 90'] },
  { id: 'WZ-5502', kind: 'tool', spoken: ['WZ-5502', 'Werkzeug 5502', 'WZ 55 02'] },
  { id: 'PA6-GF30', kind: 'material', spoken: ['PA6-GF30', 'PA sechs GF dreißig', 'PA 6 GF 30'] },
  { id: 'PP-T20', kind: 'material', spoken: ['PP-T20', 'PP T zwanzig', 'PP T 20'] },
  { id: 'POM-C', kind: 'material', spoken: ['POM-C', 'POM C', 'Pom C'] },
  { id: 'PC', kind: 'material', spoken: ['PC', 'Polycarbonat'] },
  { id: 'KD-1001', kind: 'customer', spoken: ['Brenner Automotive', 'Brenner'] },
  { id: 'KD-2040', kind: 'customer', spoken: ['Lumatec', 'Lumatec Leuchten'] },
  { id: 'KD-3307', kind: 'customer', spoken: ['Hausgeräte Nord'] },
  { id: 'RB-2', kind: 'robot', spoken: ['RB-2', 'RB zwei', 'Robo zwei'] },
]

/**
 * One piece of knowledge. `de` is how the expert says it; {v} is a number drawn per seed, {E0}, {E1} are entities in
 * the way the expert happens to say them. `cue` is the kind of question that brings it out; `tacit` how unlikely it
 * is to come out to any other question.
 */
export interface KuTemplate {
  id: string
  topic: string
  type: KuType
  cue: Move
  tacit: number
  critical: boolean
  entities: string[]
  param?: string
  unit?: string
  range?: [number, number, number]
  de: string
  en: string
  /** The question a new colleague would ask. */
  ask: string
}

const K = (t: KuTemplate) => t

export const KNOWLEDGE: KuTemplate[] = [
  K({ id: 'D1', topic: 'drying', type: 'threshold', cue: 'numbers', tacit: 0.4, critical: true, entities: ['PA6-GF30'], param: 'drying_hours_open', unit: 'h', range: [5, 7, 1], de: '{E0} aus einem offenen Sack trocknen wir {v} Stunden bei achtzig Grad.', en: 'PA6-GF30 from an opened bag is dried for {v} h at 80 °C.', ask: 'Wie lange muss PA6-GF30 aus einem offenen Sack getrocknet werden?' }),
  K({ id: 'D2', topic: 'drying', type: 'threshold', cue: 'confirm', tacit: 0.75, critical: false, entities: ['PA6-GF30'], param: 'drying_hours_fresh', unit: 'h', range: [2, 4, 1], de: 'Ein frischer Sack {E0} braucht dagegen nur {v} Stunden.', en: 'A fresh bag of PA6-GF30 needs only {v} h of drying.', ask: 'Wie lange trocknen wir einen frisch geöffneten Sack PA6-GF30?' }),
  K({ id: 'D3', topic: 'drying', type: 'exception', cue: 'failure', tacit: 0.85, critical: true, entities: [], param: 'humidity_pct', unit: '%', range: [60, 75, 5], de: 'Wenn es draußen schwül ist, über {v} Prozent Luftfeuchte, trockne ich eine Stunde länger.', en: 'Above {v} % outdoor humidity, drying is extended by one hour.', ask: 'Ab welcher Luftfeuchte trocknen wir länger?' }),
  K({ id: 'D4', topic: 'drying', type: 'rule', cue: 'newcomer', tacit: 0.6, critical: false, entities: ['POM-C'], de: '{E0} trocknen wir normalerweise gar nicht, nur wenn Kondenswasser im Sack ist.', en: 'POM-C is not dried unless there is condensation in the bag.', ask: 'Muss POM-C getrocknet werden?' }),
  K({ id: 'D5', topic: 'drying', type: 'rationale', cue: 'why', tacit: 0.7, critical: false, entities: [], de: 'Wir trocknen nicht länger als nötig, weil das Polyamid sonst vergilbt.', en: 'Polyamide is not dried longer than needed because it yellows.', ask: 'Warum trocknen wir Polyamid nicht einfach länger?' }),
  K({ id: 'D6', topic: 'drying', type: 'procedure', cue: 'open', tacit: 0.2, critical: false, entities: [], de: 'Der Trockner wird immer eine Schicht vorher eingeschaltet.', en: 'The dryer is switched on one shift ahead.', ask: 'Wann wird der Trockner eingeschaltet?' }),

  K({ id: 'S1', topic: 'startup', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: true, entities: ['SGM-07'], param: 'startup_scrap_shots', unit: 'Schuss', range: [5, 15, 1], de: 'Beim Anfahren der {E0} fahren wir erst {v} Schuss in den Ausschuss.', en: 'On start-up of SGM-07 the first {v} shots go to scrap.', ask: 'Wie viele Schuss gehen beim Anfahren der SGM-07 in den Ausschuss?' }),
  K({ id: 'S2', topic: 'startup', type: 'exception', cue: 'failure', tacit: 0.85, critical: true, entities: ['SGM-07'], de: 'Die {E0} macht nach dem Wochenende Ärger mit der Düse, die muss man zehn Minuten länger vorheizen.', en: 'After a weekend the SGM-07 nozzle needs ten minutes more preheating.', ask: 'Was ist bei der SGM-07 nach dem Wochenende zu beachten?' }),
  K({ id: 'S3', topic: 'startup', type: 'rule', cue: 'example', tacit: 0.7, critical: false, entities: [], de: 'Wenn die ersten Teile glänzende Stellen haben, ist das Werkzeug noch zu kalt, dann warten wir.', en: 'Glossy spots on the first parts mean the mould is still too cold; wait.', ask: 'Was bedeuten glänzende Stellen an den ersten Teilen?' }),
  K({ id: 'S4', topic: 'startup', type: 'procedure', cue: 'open', tacit: 0.2, critical: false, entities: [], de: 'Erst die Werkzeugtemperierung an, dann die Zylinderheizung, dann die Hydraulik.', en: 'Start order: mould temperature control, then barrel heating, then hydraulics.', ask: 'In welcher Reihenfolge wird eine Maschine angefahren?' }),
  K({ id: 'S5', topic: 'startup', type: 'rationale', cue: 'why', tacit: 0.7, critical: false, entities: [], de: 'Die Reihenfolge ist wichtig, weil sonst die Dichtungen im Werkzeug leiden.', en: 'The start order protects the seals in the mould.', ask: 'Warum ist die Reihenfolge beim Anfahren wichtig?' }),
  K({ id: 'S6', topic: 'startup', type: 'threshold', cue: 'numbers', tacit: 0.4, critical: false, entities: ['SGM-03'], param: 'heatup_min', unit: 'min', range: [30, 50, 5], de: 'Der Zylinder der {E0} braucht beim Anfahren {v} Minuten zum Aufheizen.', en: 'The SGM-03 barrel needs {v} min to heat up.', ask: 'Wie lange heizt der Zylinder der SGM-03 auf?' }),

  K({ id: 'T1', topic: 'toolchange', type: 'procedure', cue: 'open', tacit: 0.2, critical: false, entities: [], de: 'Beim Werkzeugwechsel blasen wir zuerst die Kühlwasserleitungen aus.', en: 'At a tool change the cooling lines are blown out first.', ask: 'Was macht man beim Werkzeugwechsel als Erstes?' }),
  K({ id: 'T2', topic: 'toolchange', type: 'exception', cue: 'failure', tacit: 0.85, critical: true, entities: ['WZ-4711'], param: 'slide_preheat_c', unit: '°C', range: [40, 60, 5], de: 'Das {E0} hat einen Schieber, der klemmt, wenn man es kalt einbaut, das wärmen wir auf {v} Grad vor.', en: 'WZ-4711 has a slide that jams when fitted cold; preheat it to {v} °C.', ask: 'Worauf muss man beim Einbau von WZ-4711 achten?' }),
  K({ id: 'T3', topic: 'toolchange', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: false, entities: ['SGM-11'], param: 'changeover_min', unit: 'min', range: [35, 60, 5], de: 'Für einen Werkzeugwechsel an der {E0} planen wir {v} Minuten.', en: 'A tool change on SGM-11 is planned at {v} min.', ask: 'Wie lange dauert ein Werkzeugwechsel an der SGM-11?' }),
  K({ id: 'T4', topic: 'toolchange', type: 'rule', cue: 'newcomer', tacit: 0.6, critical: false, entities: ['WZ-2290'], de: 'Die Schrauben am {E0} nur mit dem Drehmomentschlüssel anziehen, die Gewinde sind empfindlich.', en: 'WZ-2290 screws are tightened with a torque wrench only; the threads are delicate.', ask: 'Wie werden die Schrauben am WZ-2290 angezogen?' }),
  K({ id: 'T5', topic: 'toolchange', type: 'contact', cue: 'who', tacit: 0.75, critical: true, entities: [], de: 'Bei Fragen zu den Heißkanälen ruft man direkt Herrn Bauer beim Werkzeugbauer an, nicht die Hotline.', en: 'For hot-runner questions call Mr Bauer at the toolmaker directly, not the hotline.', ask: 'Wen rufe ich bei Problemen mit den Heißkanälen an?' }),
  K({ id: 'T6', topic: 'toolchange', type: 'rationale', cue: 'why', tacit: 0.6, critical: false, entities: [], de: 'Wir wechseln Werkzeuge lieber zum Schichtende, damit die Qualität nicht mitten in der Charge neu freigeben muss.', en: 'Tools are changed at shift end so quality does not have to re-release mid-batch.', ask: 'Warum wechseln wir Werkzeuge zum Schichtende?' }),

  K({ id: 'C1', topic: 'colour', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: false, entities: [], param: 'purge_kg', unit: 'kg', range: [2, 5, 1], de: 'Beim Farbwechsel spülen wir mit {v} Kilo Reinigungsgranulat.', en: 'A colour change is purged with {v} kg of purging compound.', ask: 'Wie viel Reinigungsgranulat nehmen wir beim Farbwechsel?' }),
  K({ id: 'C2', topic: 'colour', type: 'exception', cue: 'failure', tacit: 0.85, critical: true, entities: ['SGM-03'], de: 'Von Schwarz auf Weiß an der {E0} reicht Spülen nie, da bauen wir die Schnecke aus.', en: 'Black to white on SGM-03: purging is never enough, the screw is pulled.', ask: 'Was tun wir beim Wechsel von Schwarz auf Weiß an der SGM-03?' }),
  K({ id: 'C3', topic: 'colour', type: 'rule', cue: 'newcomer', tacit: 0.45, critical: false, entities: [], de: 'Farben immer von hell nach dunkel planen, nie umgekehrt.', en: 'Colours are planned from light to dark, never the reverse.', ask: 'In welcher Reihenfolge planen wir Farben?' }),
  K({ id: 'C4', topic: 'colour', type: 'rationale', cue: 'why', tacit: 0.6, critical: false, entities: [], de: 'Hell nach dunkel, weil dunkle Reste im hellen Teil sofort Ausschuss sind.', en: 'Light to dark because dark residue in a light part is scrap.', ask: 'Warum planen wir Farben von hell nach dunkel?' }),
  K({ id: 'C5', topic: 'colour', type: 'exception', cue: 'example', tacit: 0.8, critical: false, entities: ['KD-2040'], de: 'Beim Auftrag für {E0} hatten wir schwarze Punkte, weil der Trichter nicht leer war, seitdem saugen wir ihn aus.', en: 'Black specks on a Lumatec order came from a hopper not emptied; the hopper is now vacuumed.', ask: 'Woher kamen die schwarzen Punkte bei Lumatec?' }),

  K({ id: 'M1', topic: 'mouldtemp', type: 'threshold', cue: 'numbers', tacit: 0.35, critical: true, entities: ['WZ-5502'], param: 'mould_temp_c', unit: '°C', range: [60, 90, 5], de: 'Das {E0} läuft mit {v} Grad Werkzeugtemperatur.', en: 'WZ-5502 runs at {v} °C mould temperature.', ask: 'Mit welcher Werkzeugtemperatur läuft WZ-5502?' }),
  K({ id: 'M2', topic: 'mouldtemp', type: 'exception', cue: 'failure', tacit: 0.9, critical: true, entities: ['SGM-11'], de: 'Das Temperiergerät an der {E0} zeigt fünf Grad zu wenig an, das muss man im Kopf dazurechnen.', en: 'The SGM-11 temperature controller reads five degrees low; add them mentally.', ask: 'Stimmt die Anzeige des Temperiergeräts an der SGM-11?' }),
  K({ id: 'M3', topic: 'mouldtemp', type: 'procedure', cue: 'open', tacit: 0.2, critical: false, entities: [], de: 'Die Temperiergeräte prüfen wir jeden Montag auf den Wasserstand.', en: 'Temperature controllers are checked for water level every Monday.', ask: 'Wann prüfen wir den Wasserstand der Temperiergeräte?' }),
  K({ id: 'M4', topic: 'mouldtemp', type: 'rationale', cue: 'why', tacit: 0.7, critical: false, entities: ['WZ-5502'], de: 'Wir fahren das {E0} so warm, weil sonst die Bindenähte reißen.', en: 'WZ-5502 runs warm because weld lines crack otherwise.', ask: 'Warum fahren wir WZ-5502 so warm?' }),
  K({ id: 'M5', topic: 'mouldtemp', type: 'contact', cue: 'who', tacit: 0.75, critical: false, entities: [], de: 'Die Temperiergeräte wartet die Firma Kältetechnik Sommer, Frau Sommer kennt jede Macke.', en: 'Temperature controllers are serviced by Kältetechnik Sommer; ask Ms Sommer.', ask: 'Wer wartet die Temperiergeräte?' }),

  K({ id: 'H1', topic: 'hydraulics', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: true, entities: [], param: 'oil_change_hours', unit: 'h', range: [2000, 4000, 500], de: 'Das Hydrauliköl wechseln wir alle {v} Betriebsstunden.', en: 'Hydraulic oil is changed every {v} operating hours.', ask: 'Wie oft wird das Hydrauliköl gewechselt?' }),
  K({ id: 'H2', topic: 'hydraulics', type: 'exception', cue: 'failure', tacit: 0.9, critical: true, entities: ['SGM-07'], de: 'Wenn die {E0} beim Schließen ruckt, ist es fast immer das Proportionalventil, nicht die Pumpe.', en: 'When SGM-07 jerks on closing it is almost always the proportional valve, not the pump.', ask: 'Die SGM-07 ruckt beim Schließen, woran liegt das?' }),
  K({ id: 'H3', topic: 'hydraulics', type: 'threshold', cue: 'numbers', tacit: 0.4, critical: false, entities: [], param: 'oil_temp_c', unit: '°C', range: [50, 60, 5], de: 'Bei einer Öltemperatur über {v} Grad prüfen wir sofort den Kühler.', en: 'Above {v} °C oil temperature the cooler is checked at once.', ask: 'Ab welcher Öltemperatur prüfen wir den Kühler?' }),
  K({ id: 'H4', topic: 'hydraulics', type: 'rule', cue: 'newcomer', tacit: 0.65, critical: false, entities: [], de: 'Filter tauschen wir immer gegen das Original vom Hersteller, die billigen verstopfen nach zwei Wochen.', en: 'Filters are replaced with original parts; cheap ones clog within two weeks.', ask: 'Dürfen wir günstigere Hydraulikfilter nehmen?' }),
  K({ id: 'H5', topic: 'hydraulics', type: 'exception', cue: 'example', tacit: 0.8, critical: false, entities: ['SGM-03'], de: 'An der {E0} ist mal ein Schlauch geplatzt, weil die Halterung fehlte, seitdem prüfen wir die Halterungen.', en: 'A hose burst on SGM-03 because a bracket was missing; brackets are now checked.', ask: 'Warum prüfen wir die Schlauchhalterungen an der SGM-03?' }),
  K({ id: 'H6', topic: 'hydraulics', type: 'contact', cue: 'who', tacit: 0.8, critical: true, entities: [], de: 'Ersatzteile für die alten Hydraulikpumpen hat nur noch die Firma Pumpen Reuter in Kassel.', en: 'Spare parts for the old hydraulic pumps are only available from Pumpen Reuter in Kassel.', ask: 'Wo bekommen wir Ersatzteile für die alten Hydraulikpumpen?' }),

  K({ id: 'R1', topic: 'robot', type: 'procedure', cue: 'open', tacit: 0.25, critical: false, entities: ['RB-2'], de: 'Nach jedem Werkzeugwechsel wird der {E0} neu geteacht.', en: 'RB-2 is re-taught after every tool change.', ask: 'Wann muss der RB-2 neu geteacht werden?' }),
  K({ id: 'R2', topic: 'robot', type: 'exception', cue: 'failure', tacit: 0.9, critical: true, entities: ['RB-2'], de: 'Der {E0} verliert nach einem Stromausfall den Nullpunkt der Achse drei, das sieht man erst beim zweiten Teil.', en: 'After a power cut RB-2 loses the zero point of axis three; it shows on the second part.', ask: 'Was passiert mit dem RB-2 nach einem Stromausfall?' }),
  K({ id: 'R3', topic: 'robot', type: 'threshold', cue: 'numbers', tacit: 0.45, critical: false, entities: ['WZ-4711'], param: 'grip_bar', unit: 'bar', range: [3, 6, 1], de: 'Der Greiferdruck für die Deckel aus dem {E0} liegt bei {v} bar.', en: 'Gripper pressure for WZ-4711 lids is {v} bar.', ask: 'Welcher Greiferdruck gilt für die Deckel aus WZ-4711?' }),
  K({ id: 'R4', topic: 'robot', type: 'rule', cue: 'newcomer', tacit: 0.6, critical: false, entities: ['RB-2'], de: 'Die Saugnäpfe vom {E0} jeden Freitag reinigen, sonst fallen die dünnen Teile.', en: 'RB-2 suction cups are cleaned every Friday or thin parts drop.', ask: 'Wie oft werden die Saugnäpfe vom RB-2 gereinigt?' }),
  K({ id: 'R5', topic: 'robot', type: 'rationale', cue: 'why', tacit: 0.6, critical: false, entities: [], de: 'Wir teachen langsam, weil ein Crash mit dem Werkzeug Wochen kostet.', en: 'Teaching is done slowly because a crash into the mould costs weeks.', ask: 'Warum teachen wir den Roboter so langsam?' }),

  K({ id: 'F1', topic: 'firstarticle', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: false, entities: [], param: 'fa_parts', unit: 'Teile', range: [3, 10, 1], de: 'Für die Erstmusterprüfung messen wir {v} Teile aus der Serie.', en: 'First article inspection measures {v} production parts.', ask: 'Wie viele Teile messen wir bei der Erstmusterprüfung?' }),
  K({ id: 'F2', topic: 'firstarticle', type: 'rule', cue: 'newcomer', tacit: 0.6, critical: true, entities: ['KD-1001'], de: 'Bei {E0} muss der Prüfbericht vor dem ersten Versand im Kundenportal hochgeladen sein.', en: 'For Brenner Automotive the inspection report must be in their portal before the first shipment.', ask: 'Was muss bei Brenner Automotive vor dem ersten Versand passieren?' }),
  K({ id: 'F3', topic: 'firstarticle', type: 'exception', cue: 'failure', tacit: 0.85, critical: true, entities: ['WZ-2290'], de: 'Bei Teilen aus dem {E0} misst die Messmaschine die Rippenhöhe falsch, die messen wir von Hand.', en: 'For WZ-2290 parts the CMM measures rib height wrong; it is measured by hand.', ask: 'Wie messen wir die Rippenhöhe bei Teilen aus WZ-2290?' }),
  K({ id: 'F4', topic: 'firstarticle', type: 'rationale', cue: 'why', tacit: 0.65, critical: false, entities: [], de: 'Wir messen jedes Nest einzeln, weil oft nur ein Nest schief läuft.', en: 'Every cavity is measured separately because often only one runs off.', ask: 'Warum messen wir jedes Nest einzeln?' }),
  K({ id: 'F5', topic: 'firstarticle', type: 'contact', cue: 'who', tacit: 0.75, critical: false, entities: ['KD-1001'], de: 'Bei Fragen zur Zeichnung von {E0} ist Herr Lindner der richtige Ansprechpartner, nicht deren Einkauf.', en: 'Drawing questions for Brenner Automotive go to Mr Lindner, not their purchasing.', ask: 'Wen frage ich bei Zeichnungsfragen von Brenner Automotive?' }),

  K({ id: 'Q1', topic: 'complaints', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: false, entities: [], param: 'complaint_reply_h', unit: 'h', range: [24, 48, 24], de: 'Jede Reklamation bekommt innerhalb von {v} Stunden eine erste Antwort.', en: 'Every complaint gets a first reply within {v} h.', ask: 'Wie schnell beantworten wir eine Reklamation?' }),
  K({ id: 'Q2', topic: 'complaints', type: 'rule', cue: 'newcomer', tacit: 0.6, critical: false, entities: ['KD-3307'], de: '{E0} will immer einen 8D-Bericht, auch bei Kleinigkeiten.', en: 'Hausgeräte Nord always wants an 8D report, even for small issues.', ask: 'Braucht Hausgeräte Nord einen 8D-Bericht?' }),
  K({ id: 'Q3', topic: 'complaints', type: 'exception', cue: 'failure', tacit: 0.85, critical: false, entities: ['KD-2040'], de: 'Wenn {E0} über Verzug klagt, liegt es meist an deren Lagerung im Sommer, das prüfen wir zuerst.', en: 'Lumatec warpage complaints usually come from their summer storage; check that first.', ask: 'Lumatec reklamiert Verzug, was prüfen wir zuerst?' }),
  K({ id: 'Q4', topic: 'complaints', type: 'exception', cue: 'example', tacit: 0.8, critical: false, entities: ['KD-1001'], de: 'Bei {E0} hatten wir mal Grat an den Teilen, da war das Werkzeug verschlissen.', en: 'Flash on Brenner Automotive parts once came from a worn mould.', ask: 'Woher kam der Grat an den Teilen für Brenner Automotive?' }),
  K({ id: 'Q5', topic: 'complaints', type: 'threshold', cue: 'numbers', tacit: 0.4, critical: false, entities: [], param: 'credit_limit_eur', unit: 'EUR', range: [500, 2000, 500], de: 'Gutschriften über {v} Euro muss die Geschäftsführung freigeben.', en: 'Credit notes above EUR {v} need management approval.', ask: 'Ab welchem Betrag muss die Geschäftsführung eine Gutschrift freigeben?' }),

  K({ id: 'U1', topic: 'substitutes', type: 'rule', cue: 'newcomer', tacit: 0.7, critical: true, entities: ['PA6-GF30', 'KD-1001'], de: 'Wenn {E0} nicht lieferbar ist, darf nur das Material von Rheinpolymer als Ersatz, nur das ist bei {E1} freigegeben.', en: 'If PA6-GF30 is unavailable only Rheinpolymer material may substitute; only it is released at Brenner Automotive.', ask: 'Welches Ersatzmaterial ist für PA6-GF30 bei Brenner Automotive erlaubt?' }),
  K({ id: 'U2', topic: 'substitutes', type: 'threshold', cue: 'numbers', tacit: 0.35, critical: true, entities: ['PA6-GF30'], param: 'min_stock_t', unit: 't', range: [3, 8, 1], de: 'Der Mindestbestand für {E0} liegt bei {v} Tonnen.', en: 'Minimum stock of PA6-GF30 is {v} t.', ask: 'Wie hoch ist der Mindestbestand für PA6-GF30?' }),
  K({ id: 'U3', topic: 'substitutes', type: 'exception', cue: 'failure', tacit: 0.85, critical: true, entities: [], de: 'Rheinpolymer liefert im August nicht, die haben Betriebsferien, also bestellen wir im Juli vor.', en: 'Rheinpolymer does not deliver in August (company holiday); order ahead in July.', ask: 'Was ist bei Rheinpolymer im August zu beachten?' }),
  K({ id: 'U4', topic: 'substitutes', type: 'contact', cue: 'who', tacit: 0.8, critical: false, entities: ['PP-T20'], de: 'Bei Engpässen beim {E0} hilft Herr Okafor beim Händler, der hat immer noch Lager.', en: 'For PP-T20 shortages Mr Okafor at the distributor still has stock.', ask: 'Wer hilft bei Engpässen beim PP-T20?' }),
  K({ id: 'U5', topic: 'substitutes', type: 'rationale', cue: 'why', tacit: 0.7, critical: false, entities: ['PC'], de: '{E0} kaufen wir nur als Sackware, weil die Oktabins bei uns feucht werden.', en: 'PC is bought in bags only because octabins get damp here.', ask: 'Warum kaufen wir Polycarbonat nur als Sackware?' }),

  K({ id: 'X1', topic: 'handover', type: 'procedure', cue: 'open', tacit: 0.2, critical: false, entities: [], de: 'Bei der Schichtübergabe laufen wir jede Maschine einmal gemeinsam ab.', en: 'At handover every machine is walked together once.', ask: 'Wie läuft die Schichtübergabe ab?' }),
  K({ id: 'X2', topic: 'handover', type: 'rule', cue: 'newcomer', tacit: 0.45, critical: false, entities: [], de: 'Offene Störungen kommen ins Übergabebuch, nicht nur mündlich.', en: 'Open faults go into the handover book, not only by word of mouth.', ask: 'Wo dokumentieren wir offene Störungen bei der Übergabe?' }),
  K({ id: 'X3', topic: 'handover', type: 'exception', cue: 'failure', tacit: 0.8, critical: false, entities: ['SGM-11'], de: 'Wenn die Nachtschicht nur zwei Leute hat, lassen wir die {E0} nicht laufen, das schafft man nicht.', en: 'With only two people on night shift SGM-11 is not run.', ask: 'Läuft die SGM-11 auch, wenn nachts nur zwei Leute da sind?' }),
  K({ id: 'X4', topic: 'handover', type: 'threshold', cue: 'numbers', tacit: 0.3, critical: false, entities: [], param: 'handover_min', unit: 'min', range: [10, 20, 5], de: 'Die Übergabe dauert bei uns {v} Minuten.', en: 'Handover takes {v} min.', ask: 'Wie lange dauert die Schichtübergabe?' }),

  K({ id: 'G1', topic: 'regrind', type: 'threshold', cue: 'numbers', tacit: 0.35, critical: true, entities: ['PP-T20'], param: 'regrind_pct', unit: '%', range: [10, 25, 5], de: 'Mahlgut dürfen wir beim {E0} bis {v} Prozent zumischen.', en: 'Up to {v} % regrind may be added to PP-T20.', ask: 'Wie viel Mahlgut dürfen wir bei PP-T20 zumischen?' }),
  K({ id: 'G2', topic: 'regrind', type: 'rule', cue: 'newcomer', tacit: 0.6, critical: true, entities: ['KD-1001'], de: 'Bei Teilen für {E0} darf gar kein Mahlgut rein, das steht im Vertrag.', en: 'Parts for Brenner Automotive may contain no regrind; it is in the contract.', ask: 'Dürfen wir bei Teilen für Brenner Automotive Mahlgut verwenden?' }),
  K({ id: 'G3', topic: 'regrind', type: 'exception', cue: 'failure', tacit: 0.8, critical: false, entities: [], de: 'Mahlgut von gelben Teilen halten wir getrennt, sonst gibt es Farbschlieren.', en: 'Regrind from yellow parts is kept separate to avoid colour streaks.', ask: 'Warum halten wir Mahlgut von gelben Teilen getrennt?' }),
  K({ id: 'G4', topic: 'regrind', type: 'rationale', cue: 'why', tacit: 0.7, critical: false, entities: [], de: 'Mehr Mahlgut macht die Schlagzähigkeit kaputt, das merkt man erst beim Kunden.', en: 'More regrind ruins impact strength, which only shows at the customer.', ask: 'Warum begrenzen wir den Mahlgutanteil?' }),
]

/** Questions nobody at the company can answer: the memory should say so, not invent. */
export const UNKNOWN_QUESTIONS: { id: string; text: string; topic: string }[] = [
  { id: 'N1', text: 'Welches Schmierfett nehmen wir für die Führungen vom RB-2?', topic: 'robot' },
  { id: 'N2', text: 'Wie hoch ist der Nachdruck für WZ-2290?', topic: 'startup' },
  { id: 'N3', text: 'Welche Lieferzeit hat Rheinpolymer für POM-C?', topic: 'substitutes' },
  { id: 'N4', text: 'Wie oft kalibrieren wir die Messmaschine?', topic: 'firstarticle' },
  { id: 'N5', text: 'Wie viele Schuss macht WZ-5502 pro Stunde?', topic: 'mouldtemp' },
  { id: 'N6', text: 'Welche Reklamationsquote hat Hausgeräte Nord im Vertrag?', topic: 'complaints' },
]

/** Filler: what experts also say, which is not knowledge. */
export const FILLER: string[] = [
  'Das ist schon eine ganze Weile so bei uns.',
  'Na ja, da gibt es verschiedene Meinungen im Team.',
  'Das hat sich über die Jahre so eingespielt.',
  'Ehrlich gesagt mache ich das inzwischen ohne nachzudenken.',
  'Das war früher noch anders, aber egal.',
  'Da müsste ich eigentlich mal nachschauen.',
  'Das lernt man halt mit der Zeit.',
]
