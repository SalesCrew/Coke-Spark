# Fragebogen Bouquet System — Core Philosophy

## Three-Tier Hierarchy

The Fragebogen system is built on a strict three-tier hierarchy designed around **reusability** and **modularity**. Each tier serves a distinct purpose, and together they keep the system maintainable even at scale (hundreds of questionnaires across thousands of markets).

---

### Tier 1: Fragen (Questions)

The **smallest, atomic unit**. Each question is an independent, reusable building block.

- A question has a **type**: yes/no, multiple choice, photo upload, text input, number, etc.
- A question stands on its own — it has no awareness of which module or fragebogen it belongs to.
- Questions are created and managed in a central library. The same question can appear in many modules without duplication.

Examples:
- "Ist das Display korrekt aufgebaut?" (yes/no)
- "Foto vom Regal hochladen" (photo)
- "Anzahl der platzierten Produkte" (number)

---

### Tier 2: Module (Modules)

The **middle tier** — themed groups of questions, like a "bouquet of flowers."

- A module bundles related questions in a specific order (e.g., "Display Check" = 5 questions about display placement).
- Modules exist independently in a library and can be **reused across multiple Fragebogen** without duplicating their questions.
- **Key advantage**: If you update a question inside a module, every Fragebogen using that module gets the update automatically.
- Modules can hold **conditional logic rules** (e.g., if answer to Q1 is "No", skip Q3).

Examples:
- "Display Check" — 5 questions about display placement
- "Shelf Compliance" — 8 questions about shelf arrangement
- "OOS Erfassung" — 3 questions about out-of-stock situations

---

### Tier 3: Fragebogen (Questionnaires)

The **largest unit** — the final "packaging" that gets deployed.

- A Fragebogen bundles one or more modules in a specific order.
- It assigns a **time window**: always active, or date-bounded (start/end).
- It links to **specific markets** or market groups.
- This is what the end user (Gebietsleiter / SM) actually fills out during a market visit.

Examples:
- "Wöchentlicher Store Check" — uses modules: Shelf Compliance + OOS Erfassung
- "Neuprodukt-Launch Q1" — uses modules: Display Check + Shelf Compliance

---

## Why This Structure?

The same set of questions about shelf placement might be needed in a "Weekly Store Check" **and** a "New Product Launch" fragebogen. Instead of copying questions into each one:

1. Create the **questions** once.
2. Group them into a **module** once.
3. Plug that module into **both Fragebogen**.

When product requirements change, edit the module in one place — all Fragebogen using it are updated.

The three tiers cleanly separate:
- **What to ask** → Fragen
- **How to group it** → Module
- **Where and when to deploy it** → Fragebogen

This keeps the system maintainable, prevents duplication, and ensures consistency across all questionnaires.
