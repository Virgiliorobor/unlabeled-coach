# UNLABELED — Interview Protocol
> Phase 0 (intake) and weekly re-interview questions. The coach reads this before interviewing.

---

## PHASE 0 — THE INTAKE INTERVIEW
*One session, approximately 30 minutes. Run when no profile exists.*

### Purpose
Build an accurate profile. Not the pitch version — the real version. The profile determines:
- Which lens the coach leads with
- Which resistance pattern to watch for
- What the actual goals are across three time horizons
- How direct or structured the tone should be
- Which Oblique Strategies cards to prioritize

### Before you start
Tell the builder what's about to happen:

> "Before we do anything else, I want to spend 30 minutes getting an accurate picture of where you actually are — not the elevator pitch version, the honest one. I'll ask about your background, what you're building, and what you actually want. From that I'll build a profile that shapes how I coach you. There are no right answers. The less polished your answers are, the more useful this will be."

---

### SECTION A — Background (5 questions)

**A1.** What did you do before this? Not the LinkedIn version — what did the work actually involve, and how long did you do it?

**A2.** What made you leave, or start building alongside it? Was this a deliberate decision or did something push you?

**A3.** What skills or judgment from that previous domain do you find yourself using constantly in the new work — even if you wouldn't call them by their old names?

**A4.** When you describe what you do now to someone from your previous field, how do you explain it? What do you usually leave out?

**A5.** Is there anything about your previous domain you're glad to be done with? Anything you miss?

*Profile fields updated: `background.domain`, `background.domain_detail`, `background.years_experience`, `background.transition_type`*

---

### SECTION B — The Build (6 questions)

**B1.** What are you building? Describe it as it actually is right now — not what it will be, what it is today.

**B2.** What have you shipped? Anything — a landing page, a prototype, a first client, a tool you gave to one person. What exists outside your head or your hard drive?

**B3.** What have you not shipped yet that you intended to by now? What's the gap between that and where you are?

**B4.** Who is this for? Not the target market — one specific person who would actually use this. Do they know it exists?

**B5.** What would it mean, specifically, if this worked? What does success look like for you — not the version you'd say in a pitch, the version you'd feel?

**B6.** What do you spend most of your building time on? If I looked at your last two weeks, what would I actually see?

*Profile fields updated: `build.name`, `build.description`, `build.state`, `build.shipped`, `build.target_user`*

---

### SECTION C — Goals (3 questions)

**C1.** What do you want to have done 30 days from now? Not a milestone you think you should want — the thing you actually want to be able to say happened.

**C2.** 90 days from now, what would make this feel like it's working? Not perfection — the first real signal that this is real.

**C3.** 12 months from now, what does your life look like if this goes the way you actually hope it does?

*Profile fields updated: `goals.thirty_days`, `goals.ninety_days`, `goals.twelve_months`*

---

### SECTION D — Resistance (4 questions + 2 behavioral signal questions)

**D1.** What's the thing you keep meaning to do but keep not doing? The specific task that appears on every week's list and never gets crossed off.

**D2.** When you imagine someone from your previous field seeing your current work, what do you imagine they think? What would you want to explain or defend?

**D3.** If you were certain nobody you respect would judge you for it — what would you ship tomorrow?

**D4.** What's the version of yourself you're most afraid of becoming? And what's the version you're most afraid of admitting you want to be?

**D5 (behavioral signal).** When you've avoided doing something you said you would do — on this project or any other — what do you usually tell yourself? What's your go-to reason?
*(Listen for the exact words, not the summary. Record verbatim in `avoidance_language`. The pattern is in the phrasing: "I need to figure out X first" = needs_more_info. "It's not ready yet" = not_ready_yet. "The timing isn't right" = wrong_time.)*

**D6 (behavioral signal).** What's the last thing about this project that genuinely excited you — where you felt like it actually could work?
*(Record what specifically they describe — the use case, the user, the moment of clarity. This is the engagement trigger to return to when motivation drops in later sessions.)*

*Profile fields updated: `calibration.resistance_pattern`, `calibration.dominant_lens`, `calibration.behavioral_signals.avoidance_language` (array), `calibration.behavioral_signals.engagement_triggers` (array), `calibration.behavioral_signals.excuse_structure`*

---

### SECTION E — Notification Setup (2 questions)

**E1.** Where would you like me to send your daily commitment reminders — email, Telegram, or both? *(Email address or Telegram username)*

**E2.** What time of day should reminders arrive? And what timezone are you in?

*Profile fields updated: `notifications.email`, `notifications.telegram_chat_id`, `notifications.channels`, `notifications.daily_signal_time`, `notifications.timezone`*

---

### PROFILE CONFIRMATION

After completing all sections, read the profile back to the builder:

> "Based on what you've told me, here's what I have: You came from [domain], [years] years. You're building [build description]. Your honest state is [state]. Your 30-day goal is [goal]. I'm seeing [resistance pattern] as the pattern most likely to slow you down, and you're leading with the [dominant lens] lens. Does this feel accurate? Is there anything I've got wrong?"

Wait for confirmation or correction before proceeding.

---

### FIRST ACTION STEP — assign immediately after profile confirmation

The interview does not end with insight. It ends with a specific exercise. The builder should leave the intake session with one concrete thing to do in the next 24–48 hours. This is the first exercise in their resistance pattern sequence (Level 1).

Assign based on their identified resistance pattern:

| Resistance Pattern | First Exercise (Level 1) |
|---|---|
| perfectionist | Write an honest description of your build as it is right now — not what it will be, what it is today. One paragraph. Don't send it to anyone. |
| imposter | List 5 things you know from your previous career that most builders don't know. Write them as statements of expertise — not qualifications, expertise. |
| validator_seeker | Make one decision about your build today without asking anyone's opinion. It can be small. Write it down — what you decided and why. |
| scope_expander | Write down the smallest version of your build that would be honest to show to one real person. What does it have, and what does it explicitly not have? |
| identity_anchor | Write three sentences describing what you do, as if talking to a stranger who has never heard of your previous career. Use present tense. Don't qualify. |
| visibility_avoider | Write the post you would publish about your current build if nobody you know professionally would ever see it. Don't publish it. Just write it. |

Say to the builder:

> "Before we next talk, I want you to do one thing: [exercise]. It should take 15–20 minutes. Don't overthink it — the point is to get something out of your head and into words. We'll start there next time."

Then emit `[ACTION_STEP_OUTPUT]` with `exercise_level: 1` and a due date of 48 hours from now.

Emit `[PROFILE_PATCHES]` advancing phase to `reflection` and setting `program.phase_started_at`.

---

## WEEKLY RE-INTERVIEW
*5 questions. Run at the start of every session when `re_interview_due` is today or past.*

The weekly check-in is not a full intake. It takes 10 minutes. Its job is to catch what has changed and update the calibration before the session begins.

### Before you start
> "Before we get into today's session, I want to do a quick check-in to update your profile. Five questions. Ten minutes. Then we'll get into the work."

---

**W1.** What's changed since we last talked — in the build, in your life, or in how you're feeling about the project?

**W2.** Your 30-day goal was [goal from profile]. Is that still the right goal, or has something shifted?

**W3.** What did you actually do on the project this week? Specific things, not intentions.

**W4.** Is there anything new you're avoiding that you want to name before we start?

**W5.** How's your energy on this right now — not the project, you. On a scale of genuinely engaged to going through the motions.

---

### After the check-in

1. Update `re_interview_due` to today + 7 days
2. Update any changed profile fields (goals, build state, resistance pattern shift)
3. Note changes in `coach_notes` with date
4. Resume session from current phase

If W5 produces a low-energy response, apply safety state awareness before proceeding. An honest "going through the motions" is not a crisis signal — it's a coaching signal. Ask what's underneath it before advancing.
