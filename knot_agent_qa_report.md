# Knot AI Planning Agent QA Report

**Date:** 29 August 2026  
**App:** https://knot-web-am-woad.vercel.app  
**Account:** Avery Sample (`knotdemo@gmail.com`)  
**Group:** Sample Friday Crew (6 members: Avery, Jordan, Maya, Sam, Priya, plus one not listed in the sidebar)  
**Tester:** live browser sessions in hangout chat threads  

Each scenario was run as a fresh hangout where noted. Scenarios 1–2 shared one thread. Scenarios 4–5 shared one thread. Scenarios 6–8 shared one thread, then a venue card was tapped in that thread.

---

## Working Well

- **Welcome on a new hangout is the right first question.** Opening a brand-new untitled hangout (Scenario 10 and every fresh hangout in 3, 4, 6, 9) produced an immediate Knot message: `What are we doing?` Chips were empty (`When?` / `What time?` / `Where?`). That matches an empty plan.

- **Ambiguous timing is handled conversationally.** Scenario 3, fresh hangout:
  - User: `hangout this weekend` → Knot: `Saturday or Sunday?` with chips `This Saturday` / `This Sunday`
  - User: `probably morning` → Knot: `Saturday or Sunday morning?` with chips `Saturday morning` / `Sunday morning`
  - User: `maybe 10` → Knot: `Saturday or Sunday at 10am?`
  The agent carried weekend + morning into `10am` and asked only the missing day.

- **Venue search returns real, tappable cards.** Scenario 7: `show me some bars near downtown Toronto` → Knot: `Here are some options nearby.` Three cards appeared: Ruby Soho (587 King St W), Bar 404 (John St), After Seven (Stephanie St), with photos, ratings, and hours. Tapping **Ruby Soho** renamed the hangout, set the Where chip to `Ruby Soho`, and Knot replied `On it. Ruby Soho locked in.` then `When are you thinking?` with chips `Today` / `This Friday` / `This Weekend`.

- **Named-venue confirmation updates the Where chip.** Scenario 1 `KFC` → `On it.` and Where became `KFC`. Scenario 2 `lets go to Boston Pizza` → `On it.` and Where became `Boston Pizza`; `actually change it to KFC` → `Added.` and Where returned to `KFC`. The agent did not re-ask after KFC was set.

- **Activity choice is remembered across several turns.** Scenario 9: `maybe bowling` produced bowling cards (Lucky Strike, Mission Bowling Club, Presidio Bowl) and retitled the hangout `Bowling`. `or maybe escape room` → `Bowling or escape room. Which one.` with chips `Bowling` / `Escape room`. Later `escape room I think` switched the title to `Escape room` and showed escape-room cards (The Escape Game ×2, Escapology).

- **Mid-conversation date/time edits are tracked in chat even when chips do not persist.** Scenario 6: after `drinks Friday at 9pm at Bar Isabel` and `actually let's do Saturday instead`, a suggestion chip `Saturday 9pm` appeared. `and move it to 8pm` → Knot: `Saturday at 8pm. Locked in on Bar Isabel?` with chip `Saturday 8pm`. Venue and the Friday→Saturday shift were held in the reply.

- **Off-topic chat does not trigger a planner reply.** Scenario 5, after a planning message: `haha yeah that was funny` and `so anyway` both got no Knot message.

- **Venue change does not loop.** After KFC was confirmed, `yeah KFC` and `KFC final answer` produced no further “is it KFC?” questions.

---

## Broken or Degraded

### 1. Canned conflict reply instead of acknowledging the plan

When the user states date, time, or a full plan, Knot often replies with the same canned line:

`Someone else just changed that. Take a look.`

This is the CONFLICT copy. It appeared with only one person in the thread. Exact cases:

| Scenario | User message | Agent response |
|---|---|---|
| 1 | `dinner this Saturday` | `Someone else just changed that. Take a look.` |
| 1 | `maybe 7pm` | `Someone else just changed that. Take a look.` |
| 4 | `dinner at Montana's on Friday at 8pm` | `Someone else just changed that. Take a look.` |
| 6 | `drinks Friday at 9pm at Bar Isabel` | `Someone else just changed that. Take a look.` |
| 6 | `actually let's do Saturday instead` | `Someone else just changed that. Take a look.` |
| 9 | `afternoon` | `Someone else just changed that. Take a look.` |
| 9 | `around 3pm` | `Someone else just changed that. Take a look.` |
| 9 | `yeah escape room Saturday 3pm` | `Someone else just changed that. Take a look.` |

The hangout is not a multi-editor conflict. The user is handing the agent the plan. The reply reads as a bug.

### 2. Header plan chips do not persist date or time

Across Scenarios 1, 3, 4, 6, and 9, `When?` and `What time?` at the top of the hangout stayed as placeholders after the user named Saturday, 7pm, Friday 8pm, Saturday 8pm, afternoon, and 3pm. Suggestion chips under the composer (`Saturday 7pm`, `Saturday 8pm`, `Saturday`) sometimes reflected the values, but the header chips that lock the plan did not.

Where *did* update for named venues (KFC, Boston Pizza, Ruby Soho) and hangout **title** updated for activities (Bowling, Escape room, KFC). Date and time never stuck in the header in this pass.

### 3. Multi-field extraction does not populate the plan (Scenario 4)

User: `dinner at Montana's on Friday at 8pm`  
Knot: `Someone else just changed that. Take a look.`  
Chips after: `When?` / `What time?` / `Where?` (all empty). Title stayed `New plan`. No follow-up confirming Montana’s, Friday, or 8pm. All three fields were in one message and none landed on the hangout.

### 4. `who is coming?` does not use group or RSVP data (Scenario 8)

User: `who is coming?`  
Knot: `Need headcount. Everyone in or are we asking around?`

Sample Friday Crew members are visible in the UI (Avery Sample, Jordan Sample, Maya Sample, Sam Sample, Priya Sample). The tester RSVP was **Going**. The agent did not list names, RSVPs, or say it did not have the list. It asked a generic headcount question instead.

### 5. Vague planning intent gets silence (Scenario 9, turn 1)

User: `thinking about a hangout`  
Knot: **silent** (welcome `What are we doing?` was already on screen). No follow-up, no chips. A first planning message in a new hangout should get a question or options.

### 6. Completing the plan does not get a confirmation (Scenario 9, turn 8)

User: `yeah escape room Saturday 3pm`  
Knot: `Someone else just changed that. Take a look.`

The user restated the full plan. The agent did not confirm “escape room Saturday 3pm”, did not summarize, and did not update When/Time chips. It also did not mention that bowling had been dropped.

### 7. Downtown search ignores the rest of the plan (Scenario 1)

After `dinner this Saturday` and `maybe 7pm`, user: `somewhere downtown`  
Knot: `Here are some options nearby.` plus three San Francisco cards (Wayfare Tavern, Cafe Terminus, Boulevard). The canned venue-search line replaced any date/time acknowledgment. Cards were SF venues while later Toronto searches in Scenario 7 correctly used Toronto.

---

## Loops and Repetition

**Did not loop on venue confirmation (Scenario 2).** After KFC was set, further KFC messages were ignored rather than re-asked. That is the right non-looping behavior, though silence is a weak acknowledgment.

**Did repeat the same conflict line.** The identical sentence `Someone else just changed that. Take a look.` was the agent’s reply to many distinct planning messages (date, time, full plan, activity). That is a repetition bug from the user’s point of view even if each send is a new API call.

Scenario 1 turns 1 and 2 were back-to-back copies of that line. Scenario 6 turns 1 and 2 were the same. Scenario 9 used it for `afternoon`, `around 3pm`, and the final confirmation.

**Did not double-ask “Saturday or Sunday?”** Scenario 3 advanced the question each turn (day → day+morning → day+10am). No identical question twice there.

**Tapping a venue produced two agent messages** (`On it. Ruby Soho locked in.` and `When are you thinking?`). Two messages for one tap is slightly noisy but not a confirmation loop.

---

## Plan Chip Accuracy

Header chips are the three fields under the hangout title: When / What time / Where.

| Scenario | Confirmed field (user intent) | Header chip result |
|---|---|---|
| 1 | Saturday | **Did not update** (`When?`) |
| 1 | 7pm | **Did not update** (`What time?`). Composer chip `Saturday 7pm` appeared instead. |
| 1 | KFC | **Updated.** Where → `KFC`. Title → `KFC`. |
| 2 | Boston Pizza | **Updated.** Where → `Boston Pizza`. Title → `Boston Pizza`. |
| 2 | back to KFC | **Updated.** Where → `KFC`. Title → `KFC`. |
| 3 | weekend / morning / 10am | **Did not update.** All three header chips stayed placeholders. Composer chips `This Saturday` / `This Sunday` then `Saturday morning` / `Sunday morning` appeared. |
| 4 | Montana’s, Friday, 8pm | **Did not update.** All three stayed placeholders. |
| 6 | Bar Isabel, Friday 9pm | **Did not update** after the first message. |
| 6 | Saturday instead | **Did not update** header. Composer chip `Saturday 9pm`. |
| 6 | 8pm | **Did not update** header. Composer chip `Saturday 8pm`. Reply held Bar Isabel. |
| 7 | Ruby Soho (tapped card) | **Updated.** Where → `Ruby Soho`. Title → `Ruby Soho`. |
| 9 | bowling | Title → `Bowling`. Where header stayed `Where?`. |
| 9 | Saturday | **Did not update** header. Composer chip `Saturday`. |
| 9 | 3pm | **Did not update** header. |
| 9 | escape room | Title → `Escape room`. Where header stayed `Where?`. |
| 10 | (none) | Correctly empty. |

**Summary:** named venue via typed name or tapped card usually updates Where and title. Date and time almost never update the header chips. Activity names update the title only.

---

## Silent When It Should Speak

- **Scenario 9, `thinking about a hangout`.** First planning utterance in a new hangout. Agent stayed silent. Should have asked activity, day, or offered chips.

- **Scenario 2, `yeah KFC` and `KFC final answer`.** After the venue was already set, silence is acceptable so this is not a hard fail. A one-line lock-in (`Done. KFC it is.`) would be clearer than nothing.

- **Scenario 9, `probably Saturday`.** Computer-use log: no new Knot bubble; composer chips became `Saturday` / `Bowling` / `Escape room`. The user got chips but no sentence acknowledging Saturday.

- **Scenario 4** is the inverse: the agent *spoke* but the message was the wrong conflict line, so the user still got no useful confirmation of Montana’s / Friday / 8pm.

---

## Speaks When It Should Be Silent

- **Scenario 5 passed.** `haha yeah that was funny` and `so anyway` produced no Knot reply.

- **Borderline: conflict copy on already-stated fields.** The agent should either stay quiet or confirm. Instead it speaks with a false “someone else changed that” on the user’s own messages. That is speaking when it should not use that line.

No other off-topic replies were observed.

---

## Memory Failures

- **Date/time not written into hangout state.** The model often *remembers* in the next sentence (Scenario 3 morning→10am; Scenario 6 Saturday + Bar Isabel + 8pm) but the hangout record and header chips forget. After a reload those fields would still be empty.

- **Scenario 1 did not use Saturday or 7pm once venue search started.** After two conflict replies, `somewhere downtown` only produced venue cards. No “Saturday 7pm downtown” recap.

- **Scenario 4 treated a complete plan as a conflict** rather than storing venue + date + time.

- **Scenario 8 did not use member names** even though they are on the knot. That is missing group context, not conversational memory of this thread.

- **Scenario 9 remembered bowling vs escape room in chat** (`Bowling or escape room. Which one.` then escape-room cards) **but forgot to confirm the rejected bowling** on the final `yeah escape room Saturday 3pm`. The last reply was conflict copy, not a plan summary.

- **Scenario 6 first two turns** looked like amnesia because conflict copy replaced whatever the model would have said. Turn 3 showed the memory was still in the prompt (`Saturday at 8pm. Locked in on Bar Isabel?`).

---

## Priority Fix List

1. **Stop showing “Someone else just changed that” on the only speaker’s plan updates.** That line is the highest-impact bug in this pass: it is the default reply whenever date/time (and some full-plan) writes fail, so users never see a real confirmation and think another person overwrote the hangout.

2. **Persist When and What time into the header chips.** Typed values (Saturday, 7pm, Friday 8pm, 3pm) must update the hangout the same way KFC / Ruby Soho update Where. Until this works, the plan cannot lock from chat.

3. **Honor a complete plan in one message.** `dinner at Montana's on Friday at 8pm` and `yeah escape room Saturday 3pm` should set venue, date, and time (or ask one missing piece), not return conflict copy with empty chips.

4. **Answer `who is coming?` from knot members and RSVPs.** List names and Going/Maybe/Can’t go (or “only you have RSVP’d”) instead of a generic headcount prompt.

5. **Reply to weak planning intent and confirm the final plan.** `thinking about a hangout` should get a first question; after the user restates the full plan, acknowledge it in one short sentence and move to lock-in rather than going silent or repeating conflict copy.

---

## Scenario logs (verbatim)

### Setup

Signed in, opened Sample Friday Crew, then hangout chats via **Plan a hangout**. An existing empty hangout titled `New plan` already had Knot: `What are we doing?` (about 5h old). Scenarios 1–2 continued in that thread. Later scenarios used new hangouts from the composer.

### Scenario 1 — Basic plan creation (continued in existing `New plan` thread)

1. `dinner this Saturday` → `Someone else just changed that. Take a look.` Chips unchanged.
2. `maybe 7pm` → `Someone else just changed that. Take a look.` Composer chip: `Saturday 7pm`. Header still empty.
3. `somewhere downtown` → `Here are some options nearby.` Three SF cards (Wayfare Tavern, Cafe Terminus, Boulevard).
4. `KFC` → `On it.` Where → `KFC`. Title → `KFC`. When/Time still empty.

### Scenario 2 — Explicit venue confirmation (same thread)

1. `lets go to Boston Pizza` → `On it.` Where → `Boston Pizza`.
2. `actually change it to KFC` → `Added.` Where → `KFC`.
3. `yeah KFC` → silent.
4. `KFC final answer` → silent.

Times the agent asked again after KFC was confirmed: **0**. Venue chip did update to KFC. No confirmation loop.

### Scenario 3 — Ambiguous timing (fresh hangout)

Welcome: `What are we doing?`

1. `hangout this weekend` → `Saturday or Sunday?` Chips: `This Saturday`, `This Sunday`.
2. `probably morning` → `Saturday or Sunday morning?` Chips: `Saturday morning`, `Sunday morning`.
3. `maybe 10` → `Saturday or Sunday at 10am?`

Proposed a specific time (10am) after “maybe 10”, and carried morning into that guess. Header chips never filled. Did not pick Saturday vs Sunday because the user never chose a day.

### Scenario 4 — Multi-field in one message (fresh hangout)

`dinner at Montana's on Friday at 8pm` → `Someone else just changed that. Take a look.`  
Did **not** extract venue, date, and time onto chips. Did **not** ask a useful follow-up for missing info; it treated a complete message as a conflict.

### Scenario 5 — Irrelevant messages (same hangout as 4)

1. `haha yeah that was funny` → silent.  
2. `so anyway` → silent.  

Stayed silent on non-planning messages.

### Scenario 6 — Plan change mid-conversation (fresh hangout)

1. `drinks Friday at 9pm at Bar Isabel` → `Someone else just changed that. Take a look.` Header chips empty.
2. `actually let's do Saturday instead` → `Someone else just changed that. Take a look.` Composer chip `Saturday 9pm`.
3. `and move it to 8pm` → `Saturday at 8pm. Locked in on Bar Isabel?` Composer chip `Saturday 8pm`.

Friday→Saturday was reflected in the reply and composer chip. Venue was held in the question. Header chips still empty, so previously “confirmed” fields were not stored on the hangout.

### Scenario 7 — Venue search (same hangout as 6)

`show me some bars near downtown Toronto` → `Here are some options nearby.` **3** cards (Ruby Soho, Bar 404, After Seven). Agent spoke (required canned line). Cards were tappable; tap on Ruby Soho set Where.

### Scenario 8 — Group context (same hangout)

`who is coming?` → `Need headcount. Everyone in or are we asking around?`  
Did not list member names. Did not say it does not know. Did not use RSVPs.

### Scenario 9 — Memory stress test (fresh hangout)

1. `thinking about a hangout` → silent.
2. `maybe bowling` → `Here are some options nearby.` Bowling cards. Title `Bowling`.
3. `or maybe escape room` → `Bowling or escape room. Which one.` Chips `Bowling`, `Escape room`.
4. `probably Saturday` → no new sentence; chips `Saturday`, `Bowling`, `Escape room`.
5. `afternoon` → `Someone else just changed that. Take a look.`
6. `around 3pm` → `Someone else just changed that. Take a look.`
7. `escape room I think` → `Here are some options nearby.` Escape-room cards. Title `Escape room`.
8. `yeah escape room Saturday 3pm` → `Someone else just changed that. Take a look.` Header still `When?` / `What time?` / `Where?`.

By message 8 the **title** was escape room and venue cards matched, so activity was coherent. Bowling-as-rejected was never restated. The final plan was not confirmed; the agent did not start from scratch, but it also did not lock Saturday 3pm.

### Scenario 10 — Empty hangout welcome (fresh hangout, no user messages)

Title: `New plan`  
Knot (immediate): `What are we doing?`  
Chips: `When?` / `What time?` / `Where?`  
Composer placeholder: `What are we doing?`  
RSVP: Going / Maybe / Can’t go  

Welcome is relevant to an empty hangout and asks a sensible first question (activity/purpose, not date). No extra messages in 15 seconds.

---

## Test threads

| Scenarios | Hangout |
|---|---|
| 1–2 | Existing Sample Friday Crew hangout `New plan` → retitled KFC |
| 3 | New hangout from **Plan a hangout** |
| 4–5 | New hangout |
| 6–8 + Ruby Soho tap | New hangout → retitled Ruby Soho after card tap |
| 9 | New hangout → Bowling → Escape room |
| 10 | New hangout, welcome only |
