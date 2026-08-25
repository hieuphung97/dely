# Design-method ownership in Dely

| Field | Value |
| --- | --- |
| Status | Superseded in part by the owner decision recorded on 2026-08-25; retained as research history. |
| Date | 2026-08-24 |
| Question | Should Dely prescribe clarification behavior, or defer it to a harness Plan Mode or a user-selected design skill? |

## Superseding correction — 2026-08-25

The outcome-level conclusion below still stands: Dely owns the approved design
contract and pre-mutation authority boundary rather than a universal questioning
algorithm. The clean three-layer split, the heading “Plan Mode is not a design
method,” and the claim that Superpowers Brainstorming and Plan Mode compose
without overlap are superseded.

Current native Plan Modes also prescribe design method. Codex defines an
exploration, intent-clarification, and implementation-design conversation through
a decision-complete plan; Claude Code documents an explore-plan-approve workflow
with requirements questions; Grok Build feeds design-direction answers into its
native plan. Superpowers Brainstorming overlaps those concerns and separately
directs users to invoke it before entering Plan Mode.

The settled boundary is capability-based: native Plan Mode governs its enforced
constraints, question and plan surfaces, artifact representation, and mode
transitions; compatible active design skills may refine methodology within those
constraints. The user, project, harness, and their normal precedence determine
which mechanisms are active. Dely does not select or compose them, and one
explicit approval is sufficient when it approves the same design scope.

Primary sources:

- [Codex Plan Mode template](https://github.com/openai/codex/blob/main/codex-rs/collaboration-mode-templates/templates/plan.md)
- [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)
- [Grok Build Plan Mode](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/19-plan-mode.md)
- [Superpowers using-superpowers](https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md)

The remainder of this file records the earlier research path and must not be read
as the current contract where it conflicts with this correction.

## Executive conclusion

Dely should own the **portable outcome and authority boundary**, not the complete
clarification method and not the harness permission UI.

The three concerns compose rather than compete:

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Delivery contract | Dely | What must be true before candidate mutation and which unresolved uncertainties require human authority |
| Design method | The active skill or harness behavior | How to explore, sequence questions, compare approaches, and express assumptions |
| Permission and approval UX | The harness | Which tools are gated while planning and how the plan is reviewed or approved |

The smallest portable Dely invariant is:

> Before candidate mutation, Control obtains explicit approval of a design
> contract. The active design method decides how to reach that contract. It must
> surface unresolved uncertainty that could materially change intent, acceptance,
> authority, public contract, architecture, or consequential risk. It may resolve
> other details from repository evidence and conventions, but must make material
> assumptions explicit.

Dely should not prescribe question count, question order, multiple-choice format,
or activation of Plan Mode. Those are collaboration-method choices. It should not
build a skill catalogue or emulate an unavailable design skill.

## Why clarification remains a Dely invariant

The evidence consistently shows that underspecified requests create real
correctness risk and that targeted interaction can recover substantial value:

- ClarifyGPT improved GPT-4 Pass@1 from 70.96% to 80.80% on its
  MBPP-sanitized evaluation by detecting ambiguity and asking targeted questions
  ([ACM FSE 2024](https://doi.org/10.1145/3660810)).
- TiCoder's programmer study found users were significantly more likely to
  evaluate generated code correctly and reported lower task-induced cognitive
  load; its scaled evaluation reported a 45.97 percentage-point average absolute
  Pass@1 improvement within five interactions
  ([IEEE TSE 2024](https://www.microsoft.com/en-us/research/publication/llm-based-test-driven-interactive-code-generation-user-study-and-empirical-evaluation/)).
- On software-engineering tasks derived from SWE-bench Verified, Ambig-SWE found
  improvements of up to 74% from interaction, while also finding that models
  struggle to distinguish specified from underspecified requests
  ([ICLR 2026](https://arxiv.org/abs/2502.13069)).
- The recent ClarifyCodeBench preprint reports that code-generation strength does
  not imply clarification strength and that clarification quality falls as the
  number of ambiguities rises
  ([arXiv 2026](https://arxiv.org/abs/2607.00711)).

Therefore Dely cannot safely delegate the existence of a pre-mutation contract to
whatever a harness happens to do. A harness or model can miss the need to clarify.

## Why Dely should not own the full questioning algorithm

More interaction is not automatically better. The relevant objective is expected
information gain relative to interruption cost:

- A task-agnostic study that was allowed to clarify only 10% of examples doubled
  the gain of random clarification selection. It explicitly separates deciding
  **when** to ask, **what** to ask, and how to use the answer
  ([Zhang and Choi 2023](https://arxiv.org/abs/2311.09469)).
- Mixed-initiative design principles recommend efficient dialog for key
  uncertainties while considering the cost of needlessly bothering the user, and
  recommend doing less when uncertainty is high to reduce backtracking
  ([Horvitz, CHI 1999](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/chi99horvitz.pdf)).
- Validated human-AI guidelines say to disambiguate or gracefully reduce scope
  when in doubt, support efficient correction, and expose controls over system
  behavior
  ([Amershi et al., CHI 2019](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)).

This evidence favors a materiality rule over either extreme: do not ask nothing,
and do not attempt to eliminate every ambiguity. Encoding a richer elicitation
algorithm inside Dely would duplicate design skills, age with model behavior, and
override user preferences without providing a portable safety benefit.

OpenAI's model guidance makes the same separation explicitly: collaboration style
controls when an assistant asks questions or makes assumptions, while goals,
success criteria, tool rules, and stopping conditions remain distinct contract
elements
([OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.5)).

## Plan Mode is not a design method

Plan Mode is useful defense in depth and approval UX, but it is not a portable
requirements-elicitation contract:

- Claude Code describes Plan Mode as research and plan proposal without source
  edits, followed by a plan-approval surface
  ([Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)).
- Grok Build recommends Plan Mode for unclear requirements and ambiguous
  architecture, but explicitly states that it gates edit tools rather than the
  shell; shell redirection can still write, and parent Plan Mode does not edit-gate
  subagents
  ([Grok Build Plan Mode](https://docs.x.ai/build/features/plan-mode)).
- A local capability check on 2026-08-24 found Claude Code 2.1.241 and Grok Build
  1.0.5 expose `plan` permission modes. Codex CLI 0.149.0 exposed no Plan Mode CLI
  flag and reported `collaboration_modes` as removed. No current official Codex
  CLI Plan Mode contract was found. This is a scoped absence finding, not a claim
  about every Codex product surface.

Consequently Dely must not equate “Plan Mode active” with “no mutation possible”
or “requirements clarified.” It also must not require a mode that is not portable
across its supported harnesses.

## Skills are the right owner for methodology

The current Superpowers `brainstorming` method asks important clarifying questions
one at a time, requires explicit design approval, and then checks whether a
requirement admits two interpretations; if it does, the skill chooses one and
makes it explicit
([Superpowers brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md?plain=1)).
This is materially closer to selective clarification than to exhaustive
clarification.

Harnesses also already own skill discovery and user control:

- Claude Code can select a relevant skill or let the user invoke it directly, and
  supports user-only invocation
  ([Claude Code skills](https://code.claude.com/docs/en/slash-commands)).
- Codex loads skill instructions progressively and supports disabling implicit
  invocation while preserving explicit `$skill` invocation
  ([OpenAI skills](https://learn.chatgpt.com/docs/build-skills)).
- Grok Build supports slash-only skills through `disable-model-invocation`
  ([Grok Build skills](https://docs.x.ai/build/features/skills-plugins-marketplaces)).

Dely should reuse those native selection mechanisms. Reimplementing them would be
a composition engine with duplicated discovery, precedence, and compatibility
rules.

## Recommended precedence and composition

Method selection and permission mode are independent axes.

For the **design method**:

1. An explicitly invoked user skill controls the method.
2. Otherwise, project instructions or native harness skill selection may choose a
   method.
3. Otherwise, normal harness reasoning applies.
4. Dely supplies only its minimal fallback invariant: ask about load-bearing
   uncertainty, make consequential assumptions explicit, and obtain approval.

For **permission and plan UX**:

- The user's active mode and project or harness configuration control whether Plan
  Mode is used.
- Dely may benefit from an already-active verified Plan Mode, but does not require,
  emulate, or silently switch it.
- Dely's approval boundary and candidate-state checks remain authoritative even
  when Plan Mode is active.

If `superpowers:brainstorming` and Plan Mode are both active, they compose cleanly:
the skill owns elicitation and design; Plan Mode owns tool gating and preview;
Dely owns the approved-contract boundary before delivery.

## Options assessed

### A. Dely prescribes selective clarification

This is closer to Superpowers than exhaustive clarification, and is a good
**fallback behavior**. As the universal contract, however, it over-specifies
collaboration style and can conflict with a user-selected method.

### B. Dely requires exhaustive clarification

Reject. It conflicts with Superpowers' ability to select and state a reasonable
interpretation, increases interruption cost, and creates a false promise that all
ambiguity can be eliminated.

### C. Dely owns a minimum invariant; method and mode remain pluggable

Recommend. It preserves a portable safety and authority floor while reusing native
Plan Mode and skill mechanisms. It is both smaller than A as a product contract and
safer than delegating everything.

## Implication for the pending design question

The earlier A/B question was at the wrong abstraction level. The durable Dely
decision should be C. Within C, the earlier A rule remains Dely's minimal fallback
and accurately describes Superpowers behavior, but it does not override an active
design skill's legitimate question flow.

This recommendation also implies no new `dely:setup` field for Plan Mode or design
skills. Control runs in the user's current session, and setup should not become a
second settings system.

## Method and limitations

The research compared the repository's proposed design and installed skill
contracts with current first-party harness documentation, the upstream
Superpowers skill, and primary HCI and software-engineering studies. Local CLI
surfaces were checked directly for the three supported harnesses.

Limitations:

- The clarification studies use controlled benchmarks and do not directly test
  Dely's multi-harness delivery protocol.
- ClarifyCodeBench is a recent preprint; its conclusions are corroborating rather
  than dispositive.
- The Codex finding is limited to the installed CLI and official documentation
  discoverable on the research date.
- No runtime change or Dely-specific comparative experiment was performed.
