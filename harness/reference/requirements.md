# Tencent Cloud AI Singapore Hackathon 2026
## Ryde — Digital Native Track

# 1. CASE STUDY

## 5. The Digital Native Track - Ryde

### Description:

The Digital Native Track features real-world business challenges contributed by Ryde, a Singapore-headquartered ride-hailing and carpooling platform.

Participants will tackle industry-relevant problem statements and leverage AI technologies to develop practical, impactful solutions for the mobility and digital services sector.

### Requirement:

This challenge presents ONE real-world enterprise challenge statements.

Each team is required to select only ONE case study to solve.

Please clearly indicate your chosen case study at the beginning of your presentation.

---

# Challenge Statement:

## Multi-Agent Autonomous Dispute Resolution System

### Introduction

Ride-hailing companies process thousands of dispute tickets daily — ranging from fare disputes and route deviations to property damage, safety incidents, and no-show charges.

These disputes are complex, subjective, and emotionally charged, requiring human agents to manually review GPS telemetry, chat logs, photos, payment records, and company policy before reaching a decision.

This current approach results in:

- High operational costs — millions spent annually on human support hours
- Slow resolution times — typically 24–72 hours per dispute
- Inconsistent rulings — different agents reach different conclusions on similar cases
- User churn — customers who feel unfairly treated leave the platform

### Problem Statement

Build an autonomous, multi-agent dispute resolution system that can handle complex, multi-party conflicts between riders and drivers — gathering evidence, building cases, applying company policy, and issuing fair rulings quickly, transparently, and without human intervention for the majority of standard dispute categories.

---

# What the Solution Should Solve

## The AI Agent Solution — Multi-Agent Architecture

### 1. MVP (Required) — Core Agents

Teams must implement the following three core agents. These agents should operate on text-based and structured data evidence (GPS coordinates as data points, chat logs, fare breakdowns, timestamps).

| Agent | Role | Required Capabilities |
|---|---|---|
| Rider Advocate Agent | Represents the rider's perspective | Gathers rider-side evidence, articulates the rider's claim based on company policy, and argues for rider-favorable outcomes. |
| Driver Advocate Agent | Represents the driver's perspective | Gathers driver-side evidence, articulates the driver's defense based on policy, and argues for driver-favorable outcomes. |
| Judge Agent | Acts as the impartial arbitrator | Weighs evidence from both advocates, applies company policy, issues a final ruling (refund, compensation, no action), and generates a natural language explanation of its reasoning. |

### MVP Evidence Sources (Text & Structured Data):

- **GPS & Telemetry Data** — Route deviation analysis (comparing actual route vs. optimal route as data points), unexpected stops, trip duration vs. estimated time
- **Chat & Communication Logs** — Text analysis for sentiment, agreements, disagreements, and threats
- **Payment & Fare Data** — Fare breakdown validation, surge pricing disputes, promo code usage
- **Historical Behavior Profiles** — Rider and driver dispute history, rating patterns, account age

### MVP Workflow:

- A dispute is filed (e.g., "The driver took a longer route and I was overcharged.")
- The Rider Advocate Agent and Driver Advocate Agent autonomously gather their respective evidence from the available data sources.
- Each advocate builds and presents its case, citing relevant company policy.
- The Judge Agent reviews both cases, applies policy, and issues a ruling with a confidence score and natural language reasoning summary.
- The system outputs the ruling, recommended action (e.g., partial refund of $3.25), and explanation to both parties.

---

## 2. Stretch Goals (Bonus Points) — Advanced Agents & Multi-Modal Capabilities

The following are optional enhancements for teams that have completed the MVP and wish to demonstrate deeper technical capability. Implementing these will earn bonus points in the judging criteria.

| Agent / Capability | Role | Why It's a Stretch Goal |
|---|---|---|
| Evidence Collection Agent | Autonomously orchestrates multi-modal data retrieval across all tools and APIs, feeding structured evidence to the advocate agents. | Adds orchestration complexity; requires tool-use and API integration design. |
| Fraud & Bad-Faith Detection Agent | Runs in parallel to assess whether either party exhibits patterns of dispute abuse, fake claims, or collusion. Feeds risk signals to the Judge Agent. | Requires behavioral modeling and risk scoring beyond the core dispute flow. |
| Policy & Precedent Agent | Maintains a dynamic knowledge base of company policies and past dispute rulings. Provides the Judge Agent with precedent-based recommendations for ruling consistency. | Requires building and querying a precedent knowledge base (e.g., RAG architecture). |
| Image Analysis (Multi-Modal) | Analyzes "mess" or damage photos for validity — checks if the photo is genuine, matches the trip timestamp, and is not AI-generated. | Introduces computer vision / multi-modal LLM capabilities — a significant technical leap. |
| Escalation Protocol | Confidence-scoring mechanism. When the Judge Agent's confidence falls below a threshold, it autonomously escalates to a human reviewer with a full case summary. | Adds conditional logic, threshold tuning, and human-in-the-loop design. |
| Learning Feedback Loop | When a human reviewer overrides the Judge Agent's ruling, the correction is captured and fed back into the Policy & Precedent Agent's knowledge base for continuous improvement. | Requires feedback ingestion and knowledge base updating — advanced system design. |
| SLA & Routing Manager | Prioritizes disputes by urgency and value. High-priority disputes (e.g., safety-related) are fast-tracked. | Adds a queue management and prioritization layer. |

---

## 3. Strategic Guardrails for Participants

To ensure teams deliver a working prototype within the hackathon timeline, the following guardrails apply:

### Scope Management

The three Core Agents handling text-based and structured evidence are the required deliverable. Teams will be evaluated primarily on this.

Advanced Agents, image processing, and multi-modal capabilities are stretch goals. Teams should only attempt these after the MVP is fully functional.

Teams are encouraged to mock or simulate external APIs and data sources where real APIs are unavailable. A sample dataset will be provided.

### Technical Constraints

Teams may use any LLM or AI agent framework of their choice (e.g., LangChain, AutoGen, CrewAI, or custom implementations).

The system should be demoable — a working end-to-end flow for at least two dispute categories (e.g., route deviation + no-show charge) is expected by Demo Day.

Inter-agent communication should be observable — judges should be able to see how agents exchange information and build their cases (e.g., via a visible communication log or UI).

### Dispute Categories (Sample)

Teams should ensure their system can handle at least two of the following dispute types:

| # | Dispute Type | Example |
|---|---|---|
| 1 | Route Deviation | "Driver took a longer route and I was overcharged." |
| 2 | No-Show Charge | "Driver didn't show up but I was charged a cancellation fee." |
| 3 | Property Damage / Mess | "Rider spilled drinks in the car and driver is claiming cleaning fees." (requires image analysis — stretch goal) |
| 4 | Safety Incident | "Driver behaved inappropriately during the trip." |

---

# The Solution Should Include

- **Working Prototype** – An end-to-end solution capable of handling at least two dispute categories.
- **Architecture Diagram** – A clear visual representation of the multi-agent system and key components.
- **Demo Walkthrough** – A live demonstration showing how a dispute is processed and resolved autonomously.
- **Source Code** – Complete source code submitted through a GitHub repository.

**Note:** The features listed above are provided as guidance only. Participants are strongly encouraged to explore alternative approaches that meaningfully address the problem statement.

---

# 2. REQUIREMENTS FOR THE RYDE SUBMISSION

## A. Case Study

- [ ] Select the **Ryde — Multi-Agent Autonomous Dispute Resolution System** case study.
- [ ] Clearly indicate the chosen case study at the beginning of the presentation.

---

## B. Mandatory MVP — Three Core Agents

The submission must implement:

- [ ] **Rider Advocate Agent**
- [ ] **Driver Advocate Agent**
- [ ] **Judge Agent**

### Rider Advocate Agent

Role:

> Represents the rider's perspective

Required capability:

> Gathers rider-side evidence, articulates the rider's claim based on company policy, and argues for rider-favorable outcomes.

### Driver Advocate Agent

Role:

> Represents the driver's perspective

Required capability:

> Gathers driver-side evidence, articulates the driver's defense based on policy, and argues for driver-favorable outcomes.

### Judge Agent

Role:

> Acts as the impartial arbitrator

Required capability:

> Weighs evidence from both advocates, applies company policy, issues a final ruling (refund, compensation, no action), and generates a natural language explanation of its reasoning.

---

## C. MVP Evidence Sources

The system should work with text-based and structured evidence.

Evidence sources specified in the case study are:

- [ ] GPS & Telemetry Data
- [ ] Chat & Communication Logs
- [ ] Payment & Fare Data
- [ ] Historical Behavior Profiles

### GPS & Telemetry Data

Should support:

- Route deviation analysis
- Actual route vs. optimal route comparison
- Unexpected stops
- Trip duration vs. estimated time

### Chat & Communication Logs

Should support analysis of:

- Sentiment
- Agreements
- Disagreements
- Threats

### Payment & Fare Data

Should support:

- Fare breakdown validation
- Surge pricing disputes
- Promo code usage

### Historical Behavior Profiles

Should consider:

- Rider dispute history
- Driver dispute history
- Rating patterns
- Account age

---

## D. Required MVP Workflow

The working system should demonstrate the following flow:

1. [ ] A dispute is filed.

2. [ ] Rider Advocate Agent autonomously gathers rider-side evidence.

3. [ ] Driver Advocate Agent autonomously gathers driver-side evidence.

4. [ ] Each advocate builds its case.

5. [ ] Each advocate cites relevant company policy.

6. [ ] Judge Agent receives and reviews both cases.

7. [ ] Judge Agent weighs the evidence.

8. [ ] Judge Agent applies company policy.

9. [ ] Judge Agent issues a ruling.

10. [ ] Judge Agent outputs a confidence score.

11. [ ] Judge Agent generates a natural language reasoning summary.

12. [ ] Final system output contains:
    - Ruling
    - Recommended action
    - Explanation to both parties

Example recommended action given in the handbook:

> partial refund of $3.25

---

## E. At Least Two Dispute Categories

The system must demonstrate a working end-to-end flow for **at least two dispute categories**.

Available sample categories:

### 1. Route Deviation

> "Driver took a longer route and I was overcharged."

### 2. No-Show Charge

> "Driver didn't show up but I was charged a cancellation fee."

### 3. Property Damage / Mess

> "Rider spilled drinks in the car and driver is claiming cleaning fees."

Note: This requires image analysis and is therefore a stretch goal.

### 4. Safety Incident

> "Driver behaved inappropriately during the trip."

The handbook specifically gives the following example for the expected Demo Day implementation:

> route deviation + no-show charge

Therefore, a straightforward MVP choice is:

- [ ] Route Deviation
- [ ] No-Show Charge

---

## F. Observable Agent-to-Agent Communication

The multi-agent interaction should be visible to the judges.

Requirement:

> Inter-agent communication should be observable — judges should be able to see how agents exchange information and build their cases (e.g., via a visible communication log or UI).

Therefore:

- [ ] Show Rider Advocate activity.
- [ ] Show Driver Advocate activity.
- [ ] Show evidence gathered by each agent.
- [ ] Show each agent constructing its case.
- [ ] Show the cases being passed to the Judge Agent.
- [ ] Show the Judge Agent's evaluation.
- [ ] Show the resulting ruling.
- [ ] Provide a visible communication log, agent trace, or equivalent UI.

---

## G. Required Final Deliverables

### 1. Working Prototype

- [ ] End-to-end solution
- [ ] Capable of handling at least two dispute categories

### 2. Architecture Diagram

- [ ] Clear visual representation of the multi-agent system
- [ ] Shows key components

### 3. Demo Walkthrough

- [ ] Live demonstration
- [ ] Shows how a dispute is processed
- [ ] Shows how the dispute is resolved autonomously

### 4. Source Code

- [ ] Complete source code
- [ ] Submitted through a GitHub repository

---

# 3. OPTIONAL STRETCH GOALS / BONUS POINTS

These are explicitly optional.

Teams should only attempt them after the MVP is fully functional.

## 1. Evidence Collection Agent

Purpose:

- Autonomously orchestrates multi-modal data retrieval
- Works across tools and APIs
- Feeds structured evidence to advocate agents

Technical extension:

- Tool use
- API integration
- Agent orchestration

---

## 2. Fraud & Bad-Faith Detection Agent

Purpose:

- Detect dispute abuse
- Detect fake claims
- Detect possible collusion
- Produce risk signals for the Judge Agent

Technical extension:

- Behavioral modelling
- Risk scoring

---

## 3. Policy & Precedent Agent

Purpose:

- Maintain company policies
- Maintain past dispute rulings
- Give precedent-based recommendations to Judge Agent
- Improve ruling consistency

Possible implementation:

- RAG architecture
- Policy knowledge base
- Precedent database

---

## 4. Image Analysis (Multi-Modal)

Purpose:

Analyze "mess" or damage photos for validity.

Should potentially determine:

- Whether photo is genuine
- Whether photo corresponds to trip timestamp
- Whether image may be AI-generated

Technical extension:

- Computer vision
- Multi-modal LLM

---

## 5. Escalation Protocol

Purpose:

Use Judge Agent confidence scores to determine whether a case should be escalated.

Workflow:

Judge Agent ruling
→ Confidence score
→ Compare against threshold
→ If below threshold
→ Human reviewer

Human reviewer receives:

- Full case summary

Technical extension:

- Conditional logic
- Confidence threshold tuning
- Human-in-the-loop design

---

## 6. Learning Feedback Loop

Purpose:

When a human reviewer overrides the Judge Agent:

1. Capture the correction.
2. Feed it back into the Policy & Precedent Agent.
3. Update the knowledge base.
4. Improve future decisions.

Technical extension:

- Feedback ingestion
- Knowledge-base updating
- Continuous improvement

---

## 7. SLA & Routing Manager

Purpose:

Prioritize disputes according to:

- Urgency
- Value
- Risk

Example:

> High-priority disputes (e.g., safety-related) are fast-tracked.

Technical extension:

- Queue management
- Prioritization logic

---

# 4. SCOPE / IMPLEMENTATION GUARDRAILS

The handbook explicitly prioritises completing the MVP.

## Required

- Three Core Agents
- Text-based evidence
- Structured evidence
- At least two dispute categories
- Working end-to-end flow
- Observable agent communication

## Optional / Stretch

- Additional agents
- Image processing
- Multi-modal capabilities
- Fraud detection
- Policy / precedent RAG
- Human escalation
- Feedback learning
- SLA routing

The handbook states:

> The three Core Agents handling text-based and structured evidence are the required deliverable. Teams will be evaluated primarily on this.

And:

> Advanced Agents, image processing, and multi-modal capabilities are stretch goals. Teams should only attempt these after the MVP is fully functional.

---

# 5. DEVELOPMENT FLEXIBILITY

The handbook allows:

- [ ] Any LLM
- [ ] Any AI agent framework
- [ ] LangChain
- [ ] AutoGen
- [ ] CrewAI
- [ ] Custom implementations

External APIs and data sources may also be mocked or simulated where real APIs are unavailable.

The handbook states:

> Teams are encouraged to mock or simulate external APIs and data sources where real APIs are unavailable. A sample dataset will be provided.

---

# 6. MINIMUM RYDE MVP CHECKLIST

Before considering the Ryde prototype complete, verify all of the following:

## Agents

- [ ] Rider Advocate Agent exists and functions
- [ ] Driver Advocate Agent exists and functions
- [ ] Judge Agent exists and functions

## Evidence

- [ ] Agents can retrieve/use structured evidence
- [ ] GPS/telemetry supported
- [ ] Chat/communication logs supported
- [ ] Fare/payment data supported
- [ ] Historical profile data supported

## Case Building

- [ ] Rider Agent builds rider-side case
- [ ] Driver Agent builds driver-side case
- [ ] Both reference company policy
- [ ] Evidence used by each side is visible

## Judging

- [ ] Judge receives both cases
- [ ] Judge weighs evidence
- [ ] Judge applies policy
- [ ] Judge produces final ruling
- [ ] Judge produces confidence score
- [ ] Judge produces natural-language explanation

## Output

- [ ] Final ruling displayed
- [ ] Recommended action displayed
- [ ] Explanation provided to rider
- [ ] Explanation provided to driver

## Dispute Coverage

- [ ] At least two dispute types work end-to-end

Recommended MVP:

- [ ] Route Deviation
- [ ] No-Show Charge

## Observability

- [ ] Inter-agent communication visible
- [ ] Evidence-gathering process visible
- [ ] Case construction visible
- [ ] Judge reasoning/result visible

## Submission Deliverables

- [ ] Working Prototype
- [ ] Architecture Diagram
- [ ] Demo Walkthrough
- [ ] Complete GitHub Repository

---

# 7. IMPORTANT NOTE

The Ryde-specific requirements above come from pages 20–25 of the handbook.

These are separate from the hackathon-wide Project Submission Requirements later in the handbook.

For the actual competition submission, both sets of requirements should be satisfied:

1. **Ryde challenge requirements**
2. **Hackathon-wide project submission requirements**