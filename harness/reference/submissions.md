---

# 8. HACKATHON-WIDE PROJECT SUBMISSION REQUIREMENTS

In addition to the Ryde-specific requirements above, the project must satisfy the following hackathon-wide submission requirements.

## Project Basic Requirements

The project must be original and built on at least one of the products CodeBuddy or WorkBuddy.

Proof of product usage is mandatory: chat screenshots, API call logs, or a written development-process description. Without proof, the project will not proceed to scoring.

---

## Submission Requirements

### 1. Project Title — Required

- [ ] Provide the name of the AI Agent project.

Requirement:

> The name of your AI Agent project

---

### 2. Short Blurb — Required

- [ ] Provide a short summary of the project.
- [ ] Hard limit: under 10 words.

Requirement:

> A summary of what your project does or the value it delivers. Hard limit: under 10 words

---

### 3. Project Description — Required

The Project Description must cover the following areas:

#### Project Overview

- [ ] Target Scenarios
- [ ] Users
- [ ] Value Proposition

Requirement:

> Project Overview: Target Scenarios, Users, and Value Proposition

#### Real-World Scenario Insights

- [ ] Source of Pain Points
- [ ] Target Audience
- [ ] Core Problems Solved

Requirement:

> Real-World Scenario Insights: Source of Pain Points, Target Audience, and Core Problems Solved

#### Comprehensive Solution Design

- [ ] Business architecture
- [ ] Technical architecture
- [ ] Explain how prompts drive the AI generation

Requirement:

> Comprehensive Solution Design: business and technical architecture, and how prompts drive the AI generation.

#### Business Value

- [ ] Include quantifiable metrics; or
- [ ] Clearly define the expected impact.

Requirement:

> Business Value: quantifiable metrics or clearly defined impact.

---

### 4. CodeBuddy / WorkBuddy Conversation History — Required

- [ ] Provide a minimum of 3 screenshots or screen recording of development chat logs.
- [ ] Chat logs must come from CodeBuddy or WorkBuddy.
- [ ] Evidence should show usage during the development process.

Requirement:

> Minimum of 3 screenshots/screen recording of your chat logs from CodeBuddy or WorkBuddy during the development process

This is particularly important because proof of CodeBuddy / WorkBuddy usage is mandatory for the project to proceed to scoring.

---

### 5. Cover Image — Required

- [ ] Provide a 16:9 project cover image.
- [ ] The image will be used for the online showcase.
- [ ] Recommended size: 380 × 216px.

Requirement:

> A 16:9 cover image for your project, used for the online showcase. Recommended size: 380×216px.

---

### 6. Demo Video — Optional

A demo video is optional.

If submitted:

- [ ] Length: 5–8 minutes
- [ ] Cover the Project Overview
- [ ] Demonstrate the Core Agent features
- [ ] Explain how the system is used
- [ ] Include a short reflection on the build approach
- [ ] Include development tool tips
- [ ] Reference CodeBuddy / WorkBuddy usage

Requirement:

> A 5–8 minute video covering:
>
> - Project overview
> - Core Agent features and how it's used
> - A short reflection on your build approach and any development tool tips with reference to CodeBuddy/WorkBuddy

---

### 7. Project Link — Optional

- [ ] Provide a live URL or demo link if available.
- [ ] A project link is optional.
- [ ] Providing one earns bonus points.

Requirement:

> A live URL or demo link for your project. Optional, but earns bonus points.

---

### 8. Other Requirements as per the Challenge Statement — Optional

Requirement:

> Please check the respective challenge statement for specific requirements.

For the Ryde track, those challenge-specific requirements are captured earlier in this document.

They include, among other things:

- The three required Core Agents
- Text-based and structured evidence
- At least two dispute categories
- Observable inter-agent communication
- Working Prototype
- Architecture Diagram
- Demo Walkthrough
- Complete GitHub Repository

---

# 9. COMPLETE SUBMISSION CHECKLIST — RYDE + HACKATHON REQUIREMENTS

The following combines the Ryde challenge requirements with the hackathon-wide project submission requirements into one checklist.

## A. Eligibility / Basic Project Requirements

- [ ] Project is original.
- [ ] Project is built using at least one of:
  - [ ] CodeBuddy
  - [ ] WorkBuddy
- [ ] Proof of CodeBuddy / WorkBuddy usage is included.
- [ ] Proof includes at least 3 screenshots or a screen recording of development chat logs.

---

## B. Project Identity

- [ ] Project title prepared.
- [ ] Short blurb prepared.
- [ ] Short blurb is under 10 words.
- [ ] Ryde case study is clearly identified.
- [ ] Chosen case study is stated at the beginning of the presentation.

---

## C. Project Description

### Project Overview

- [ ] Target scenarios explained.
- [ ] Target users explained.
- [ ] Value proposition explained.

### Real-World Scenario Insights

- [ ] Pain points identified.
- [ ] Source of the pain points explained.
- [ ] Target audience identified.
- [ ] Core problems solved explained.

### Solution Design

- [ ] Business architecture explained.
- [ ] Technical architecture explained.
- [ ] AI / agent architecture explained.
- [ ] Prompting approach explained.
- [ ] How prompts drive AI generation explained.

### Business Value

- [ ] Business impact explained.
- [ ] Quantifiable metrics included where possible.
- [ ] Expected impact clearly defined.

---

## D. Ryde Core Multi-Agent Requirements

- [ ] Rider Advocate Agent implemented.
- [ ] Driver Advocate Agent implemented.
- [ ] Judge Agent implemented.

### Rider Advocate Agent

- [ ] Gathers rider-side evidence.
- [ ] Builds the rider's case.
- [ ] References company policy.
- [ ] Argues for rider-favorable outcomes.

### Driver Advocate Agent

- [ ] Gathers driver-side evidence.
- [ ] Builds the driver's case.
- [ ] References company policy.
- [ ] Argues for driver-favorable outcomes.

### Judge Agent

- [ ] Receives both advocate cases.
- [ ] Weighs evidence.
- [ ] Applies company policy.
- [ ] Produces a final ruling.
- [ ] Produces a confidence score.
- [ ] Produces natural-language reasoning.
- [ ] Produces a recommended action.

---

## E. Evidence Sources

The MVP should support text-based and structured evidence including:

- [ ] GPS & Telemetry Data
- [ ] Chat & Communication Logs
- [ ] Payment & Fare Data
- [ ] Historical Behavior Profiles

---

## F. Dispute Categories

The system must work end-to-end for at least two dispute categories.

Recommended MVP categories:

- [ ] Route Deviation
- [ ] No-Show Charge

Other possible categories:

- [ ] Property Damage / Mess
- [ ] Safety Incident

Note:

Property Damage / Mess requires image analysis and is identified as a stretch goal.

---

## G. Required End-to-End Flow

- [ ] Dispute is filed.
- [ ] Rider Advocate gathers evidence.
- [ ] Driver Advocate gathers evidence.
- [ ] Rider Advocate builds its case.
- [ ] Driver Advocate builds its case.
- [ ] Relevant company policy is cited.
- [ ] Both cases are passed to the Judge Agent.
- [ ] Judge Agent weighs evidence.
- [ ] Judge Agent applies policy.
- [ ] Judge Agent produces a ruling.
- [ ] Judge Agent produces a confidence score.
- [ ] Judge Agent produces a reasoning summary.
- [ ] System generates recommended action.
- [ ] System provides an explanation to both parties.

---

## H. Agent Observability

- [ ] Inter-agent communication is observable.
- [ ] Judges can see how agents exchange information.
- [ ] Judges can see how agents build their cases.
- [ ] Evidence gathered by each agent is visible.
- [ ] Judge evaluation is visible.
- [ ] Final ruling is visible.

Possible implementation:

- Visible communication log
- Agent trace
- Workflow timeline
- Multi-agent activity panel
- Equivalent UI

---

## I. Required Ryde Deliverables

- [ ] Working Prototype
- [ ] Architecture Diagram
- [ ] Demo Walkthrough
- [ ] Complete Source Code
- [ ] GitHub Repository

### Working Prototype

- [ ] End-to-end.
- [ ] Handles at least two dispute categories.

### Architecture Diagram

- [ ] Clearly shows the multi-agent architecture.
- [ ] Shows key system components.

### Demo Walkthrough

- [ ] Live demonstration available.
- [ ] Shows a dispute being submitted.
- [ ] Shows evidence gathering.
- [ ] Shows both advocates building their cases.
- [ ] Shows Judge Agent evaluation.
- [ ] Shows autonomous dispute resolution.

### Source Code

- [ ] Complete source code available.
- [ ] Source code submitted through GitHub.

---

## J. Required Hackathon Submission Assets

- [ ] Project Title
- [ ] Short Blurb — under 10 words
- [ ] Project Description
- [ ] Minimum 3 CodeBuddy / WorkBuddy development screenshots or screen recording
- [ ] 16:9 Cover Image
- [ ] Recommended cover image size: 380 × 216px

---

## K. Optional Submission Assets

### Demo Video

- [ ] 5–8 minutes
- [ ] Project overview
- [ ] Core Agent features
- [ ] Usage walkthrough
- [ ] Reflection on build approach
- [ ] Development tool tips
- [ ] Reference to CodeBuddy / WorkBuddy

### Project Link

- [ ] Live URL / demo URL provided if available.

Note:

A project link is optional but earns bonus points.

---

## L. Optional Ryde Stretch Goals

Only pursue these after the core MVP is fully functional.

- [ ] Evidence Collection Agent
- [ ] Fraud & Bad-Faith Detection Agent
- [ ] Policy & Precedent Agent
- [ ] Image Analysis / Multi-Modal
- [ ] Escalation Protocol
- [ ] Learning Feedback Loop
- [ ] SLA & Routing Manager

---

# 10. DEFINITION OF DONE

For the purposes of this project, the minimum submission should not be considered complete until all of the following are true:

1. The three mandatory Ryde agents work.
2. At least two dispute categories work end-to-end.
3. The agents autonomously gather and analyse the required evidence.
4. Both advocates independently construct their cases.
5. Company policy is incorporated into the cases and ruling.
6. The Judge Agent produces a ruling, confidence score, reasoning summary, and recommended action.
7. Inter-agent communication is observable.
8. The working prototype can be demonstrated live.
9. An architecture diagram has been prepared.
10. Complete source code is available through GitHub.
11. The project was built using CodeBuddy or WorkBuddy.
12. Proof of CodeBuddy / WorkBuddy usage has been captured.
13. At least 3 development chat screenshots or a screen recording are available.
14. The project title has been finalised.
15. The short blurb is under 10 words.
16. The Project Description covers scenarios, users, value proposition, pain points, solution design, prompting approach, and business value.
17. A 16:9 cover image has been prepared.
18. All required submission materials are ready for submission.