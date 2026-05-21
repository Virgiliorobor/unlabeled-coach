# UNLABELED — Three Horizons Framework
> Goal extraction, tracking structure, and session reference guide.

---

## WHAT THIS IS

The three horizons are the backbone of the coaching program. Every session references them. Every commitment traces back to one of them. Every re-interview checks whether they've changed.

The three horizons are not milestones. They are not a roadmap. They are an honest answer to the question: what do you actually want, across three timescales?

---

## THE THREE HORIZONS

### Horizon 1 — 30 Days
**The operational horizon.** What do you want to be able to say happened in the next 30 days?

This is the horizon of commitments. Phase 4 commitments are always anchored here. It should be specific enough that you could evaluate it with a yes or no at the end of the month.

**Good 30-day goal:** "Ship the first version to three real users and get written feedback from at least one of them."
**Bad 30-day goal:** "Make progress on the product."

**Signals that the 30-day goal is wrong:**
- It's been unchanged for more than two re-interviews
- The builder never talks about it in sessions — only about the 90-day or 12-month goal
- It doesn't require any public act to be complete
- It could be accomplished without anyone else knowing

---

### Horizon 2 — 90 Days
**The proof-of-concept horizon.** What would make this feel like it's working — not perfection, the first real signal?

This is the horizon of direction. When the builder is lost in a Phase 4 commitment that feels pointless, connecting it back to the 90-day goal restores meaning. "You said you want to have your first paying user in 90 days. Does this commitment move toward that, or is it a detour?"

**Good 90-day goal:** "Have at least one person paying for this in any amount, even if it's just to test the concept."
**Bad 90-day goal:** "Have a successful product."

**Signals that the 90-day goal is wrong:**
- It's vague enough to be uncountable
- Achieving it wouldn't feel like evidence of anything
- The builder describes it in terms of features built rather than outcomes for users

---

### Horizon 3 — 12 Months
**The identity horizon.** If this goes the way you actually hope — not the pitch version, the real one — what does your life look like?

This is the horizon of meaning. It anchors the whole program. When a builder is in Phase 3 and the resistance is strongest, returning to the 12-month horizon reminds them why this is worth the discomfort.

**Good 12-month goal:** "I am working full-time on this. I have users who are paying. I have stopped apologizing for what I do when people ask."
**Bad 12-month goal:** "I have a successful company."

**Signals that the 12-month goal is wrong:**
- It sounds like something the builder thinks they should want rather than something they actually want
- It doesn't include anything about identity ("what I am" or "how I feel about the work")
- It's so ambitious that none of today's decisions could plausibly connect to it

---

## EXTRACTION PROTOCOL

The horizons are extracted in Phase 0 using Section C of the interview. The key instruction: ask for what the builder *actually* wants, not the version they think they should want.

**Extraction technique:** Ask the question once. When the answer is vague, reflect it back and ask again. Don't rephrase the question — ask the same question with the vague answer shown back to them:

> "You said your 90-day goal is to have a successful launch. What does 'successful' mean specifically — if you looked back at that moment, what would you want to be able to count or point to?"

Repeat until the goal passes the specificity test: could you evaluate it yes or no?

---

## TRACKING IN THE PROFILE

The profile stores goals in this structure:

```yaml
goals:
  thirty_days:
    text: "Ship first version to 3 real users, get written feedback from 1"
    status: active        # active | completed | revised
    set_at: "2026-05-14"
    last_referenced: "2026-05-21"

  ninety_days:
    text: "First paying user, any amount"
    status: active
    set_at: "2026-05-14"
    last_referenced: "2026-05-21"

  twelve_months:
    text: "Working on this full-time. Have users who pay. No longer apologizing for what I do."
    status: active
    set_at: "2026-05-14"
    last_referenced: "2026-05-14"
```

When a goal is revised, update `status: revised` and add a new entry. Do not delete the old goal — the history of what shifted and why is part of the builder's story.

---

## SESSION REFERENCE RULES

**In Phase 1:** Reference the 30-day goal when surfacing behavioral contradictions. "You said your 30-day goal is X. What did you actually do this week?"

**In Phase 2:** Reference all three horizons when clarifying what the builder is making. Does the thing they're describing connect to all three? If the 12-month goal is "working on this full-time" but the 30-day goal doesn't create any external feedback — they're disconnected.

**In Phase 4:** The commitment must connect directly to the 30-day goal. Ask before finalizing: "Does this move you toward [30-day goal]?" If no, revise the commitment or the goal.

**In Phase 5:** After a commitment is resolved, ask if the 30-day goal needs to be updated. If a commitment was missed, ask if the goal was right or if the goal itself needs to be revised.

**In re-interviews:** Always ask if the 30-day goal has changed. The 90-day and 12-month goals should be more stable — if they're shifting every week, that's a coaching signal, not a planning update.

---

## STAGE 2 — DASHBOARD MAPPING

In the Stage 2 web platform, the three horizons map to the dashboard as three columns or zones:

| Horizon | Dashboard display |
|---|---|
| 30 days | Current goal + active commitment + days remaining |
| 90 days | Proof-of-concept target + progress signal |
| 12 months | Vision statement + last updated date |

Each horizon shows:
- The goal text
- Status (active / completed / revised)
- Last referenced date (so the builder can see if a goal has been ignored)
- Connected commitments (for 30-day only — the trail of commitments that fed this goal)
