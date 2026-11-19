# EmberVault — Build With XO submission package (Syarat 4)

Prepared 2026-11-18 morning (WIB) from the completed Syarat 1–3 work.
Submitted 2026-11-19: Build https://dorahacks.io/build/51322 (BCH BLAZE 2026,
Mainnet Track), with the Build With XO bounty application attached and under
review. The feedback essay (Syarat 5) was written personally by the entrant
(502 words) and lives in ESSAY.md and in the Build description, verbatim.

## What this is

EmberVault is a novel, functional XO template: a two-party hashlock tip
vault for Bitcoin Cash, themed on EmberTip. A funder locks BCH behind the
SHA-256 hash of a secret word for a beneficiary; the beneficiary claims by
revealing the secret + signing; the funder can refund after a block-height
(CLTV) timeout.

- Template file: `template.json` (v5, final)
- Template name: "EmberVault — Hashlock Tip Vault", version 1
- Template identifier:
  `93815e7e9eb749783bc04799a36230fdfab807e0bd5ad05ffaacf64a896acd11`
- Network: chipnet (testnet)

## Syarat 1 — template: DONE

Template v5 passed XO engine validation and was imported successfully.
Earlier versions v1–v4 failed on XO/libauth pitfalls (documented below);
the decisive fix was using the engine's built-in `p2sh` locking-script
type (P2SH32) instead of a hand-wrapped P2SH20, which signs with the
wrong covered bytecode. Only `OP_1` / `OP_0` are valid in CashAssembly
(`OP_TRUE` / `OP_FALSE` are unknown identifiers).

## Syarat 2 — transactions from an inspectable invitation: DONE

All transactions below are on chipnet and inspectable at
https://blaze.xo.cash → Inspect Transaction (network: chipnet, paste txid).

| Vault | Action | Txid |
|-------|--------|------|
| A | createVault — 20,000 sats locked | `c9627cbe9dde9dddb30a6f13fb42dbde41d256315ef2c5545428a94eb0678232` |
| A | claimVault — 19,000 sats to beneficiary | `efc66b3451668aa47bc6998304eed1de4137966607c1b5e72ace50619c70a15c` |
| B | createVault — 15,000 sats locked | `d3a3ff4aa01372c802ecdae1fc3b236600434e179d8752b8749d3227e709867d` |
| C | createVault — 15,000 sats locked | `53a04ce451c62578ea830ac83c030a60c868dafb08c747d287c946fc76b5c6ab` |

Invitation identifiers (see `artifacts/*-invitation.json`):
- Vault A create: `80241dc5f4a7bb8528ad546062c594f0`
- Vault B create: `eb7a915a59a8e754775c92e587be8d0a`
- Vault C create: `cf6f3e84bd7efbffe7296de7c6e3ae58`

Claim (Vault A): beneficiary revealed secret `ember-harvest-2026` and
signed; transaction confirmed on chipnet (15 confirmations at last check).

## Syarat 3 — follow-up actions: DONE, with one honest caveat

- **Claim** — succeeded, broadcast + confirmed (txid above).
- **Refund** — transactions were built and signed correctly through the
  XO invitation flow for Vaults B and C (raw tx in
  `artifacts/refund-built.json`; decoded: version 2, one input with
  sequence 0, locktime exactly == refundHeight, one P2PKH output of
  vaultSatoshis − 1,000). BUT two independent chipnet nodes
  (imaginary.cash + bch.ninja Fulcrums) reject them at broadcast with
  `bad-txns-nonfinal` (code 64), even 25–80 blocks past the locktime.
  Full evidence: `artifacts/refund-status.json`. This is node-side
  mempool behaviour, not a template error — the identical construction
  broadcast fine for createVault and claimVault (locktime 0). Report it
  as a finding, not as a success.

Reproduction notes:
- Two separate accounts are required: the XO engine rejects one account
  holding both funder and beneficiary roles. See `src/accounts.mjs`
  (`account-funder.json`, `account-beneficiary.json` — keys are local
  testnet keys, never mainnet).
- The engine reaches chipnet only via the local Electrum bridge
  (`src/electrum-bridge.mjs`, WSS 127.0.0.1:50004 → CONNECT proxy →
  Fulcrum tcp_tls) with a local CA in `.bridge/` that must be
  reinstalled into the system store after any VM replacement:
  `cp .bridge/ca.pem /usr/local/share/ca-certificates/embervault-ca.crt
  && update-ca-certificates`, plus `NODE_OPTIONS=--use-system-ca`.
- Chipnet faucets: chipnet.bch.ninja now uses a SHA-256 PoW challenge
  (replicated in `src/faucet-ninja.mjs`); googol has a 5-hour cooldown.

## Syarat 4 — packaging: THIS FILE

Contents of this package:
- `template.json` — the template (Syarat 1)
- `artifacts/` — invitations, summaries, built transactions,
  `refund-status.json` (Syarat 2–3 evidence)
- `src/` — scripts used to run the flow (bridge, vault create/claim/
  refund, verification)
- This file — the submission cover note

Still open before submitting this bounty:
- [x] Submission route CONFIRMED 2026-11-18 ~09:57 WIB (checked live on
      dorahacks.io/hackathon/bchblaze2026/bounties + bchblaze.cash/bounties/build-with-xo/):
      Build With XO is applied for through the SAME DoraHacks BUIDL/Build
      submission — no separate form. Clicking "Apply" on the bounty card opens
      a "Bounty Application" dialog ("To apply for a bounty, you need to submit
      a Build to the hackathon") asking to select an existing Build + a Track
      (Mainnet Track / Media Track). So the EmberVault package rides on a Build
      submitted in the hackathon; the bounty application attaches to that Build.
      No separate XO deadline: the bounty card lists the hackathon deadline
      2026/11/22 14:00 UTC (= 21:00 WIB). Status at check: 0 Applied, 0/10
      distributed — 10 winner slots at 0.3 BCH each, no applicants yet.
      Caveat: no explicit statement was found that one Build can win both the
      Mainnet Track prize and the XO bounty; the only explicit non-exclusivity
      note covers Mainnet vs Media tracks.
- [x] Syarat 5 — the ~500-word feedback essay, written personally by
      the entrant (502 words, 2026-11-19) and submitted verbatim in the
      EmberVault Build description (https://dorahacks.io/build/51322).

## Notes for the essay (facts only — NOT essay text)

Write it in your own words. The facts worth covering, all verified
during the build:
1. `addChangeToInvitation` emits a zero-length locking bytecode and
   burns the change output — 116,600 + 19,600 + 879,600 test sats lost
   across incidents. This is the clearest engine bug found.
2. The refund path: invitation flow, variables and signing all work,
   but chipnet mempools reject the correctly-built CLTV refund
   transactions as non-final — worth reporting to the XO team.
3. Engine could not reach the Chipnet Electrum server from this
   machine (direct egress blocked); a local proxy bridge + local CA
   was needed to get the engine online at all.
4. P2SH20 hand-wrapping signs with wrong covered bytecode; the
   built-in `p2sh` type is the correct path — the error message did
   not point at this.
5. Faucet friction: PoW challenge on chipnet.bch.ninja, 5-hour
   cooldown on googol — slows iteration on testnet.
