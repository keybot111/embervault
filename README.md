# EmberVault — Hashlock Tip Vault (XO Template)

A novel, functional XO template built for the **Build With XO** bounty at
BCH BLAZE 2026 (sponsor: General Protocols). A two-party hashlock tip
vault for Bitcoin Cash, themed on EmberTip:

- A **funder** locks BCH behind the SHA-256 hash of a secret word.
- The **beneficiary** claims by revealing the secret (preimage) plus a
  signature.
- The **funder** can refund after a block-height (CLTV) timeout.

- Template: `template.json` (v5, id
  `93815e7e9eb749783bc04799a36230fdfab807e0bd5ad05ffaacf64a896acd11`),
  network: chipnet. Earlier iterations in `template-v1.json` …
  `template-v4.json`.
- Proof: Vault A create tx
  `c9627cbe9dde9dddb30a6f13fb42dbde41d256315ef2c5545428a94eb0678232` and
  claim tx `efc66b3451668aa47bc6998304eed1de4137966607c1b5e72ace50619c70a15c`,
  both broadcast and confirmed on chipnet and inspectable at
  https://blaze.xo.cash (Inspect Transaction, chipnet). Invitations and
  summaries live in `artifacts/` and `exchange/`.
- Full submission package, reproduction notes and the honest refund
  caveat: see `SUBMISSION.md`.
- The entrant's personally written feedback essay: see `ESSAY.md`.

Account key files and local engine state are deliberately not in this
repository. MIT licensed.
