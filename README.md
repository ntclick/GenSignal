# ⚡ GenSignal: Decentralized AI Trading Oracle on GenLayer

> Trustless Multi-Validator AI Consensus Trading Intelligence with **x402 Micropayments** on **GenLayer Studionet**.

---

## 🌐 Deployed Smart Contracts & Live Links

### ⛓️ Deployed GenLayer Studionet Contracts
- 🤖 **SignalOracle Contract**: [`0x73B568e186A16761c317F52D65e0d53a5f705a5b`](https://explorer-studio.genlayer.com/address/0x73B568e186A16761c317F52D65e0d53a5f705a5b)
- 💰 **SignalTreasury Contract**: [`0x9e70bFAD6bd7721758ec3dae57622616d63Ed975`](https://explorer-studio.genlayer.com/address/0x9e70bFAD6bd7721758ec3dae57622616d63Ed975)

### 🚀 DApp & Services
- 🖥️ **Live Web Application (Vercel)**: [https://gensignal.vercel.app](https://gensignal.vercel.app)
- ⚡ **Live Backend API (Render Cloud)**: [https://gensignal.onrender.com](https://gensignal.onrender.com)
- 🔍 **GenLayer Studio Explorer**: [https://explorer-studio.genlayer.com](https://explorer-studio.genlayer.com)

---

## 🔒 Contract Security & Architectural Guarantees

GenSignal's Intelligent Contract (`contracts/signal_oracle.py`) implements strict contract-level security and data isolation rules to guarantee trustless execution:

### 1. 💳 One-Time Payment Verification & Anti-Forgery
- Every `evaluate_signal` invocation requires a valid `payment_tx` reference.
- **Forgery Prevention**: Blank, missing, or whitespace-only payment strings are immediately rejected via `gl.vm.UserError("Forged Payment Error")`.
- **Replay Protection**: Used payment references are recorded in persistent contract storage (`self.used_payment_txs[payment_tx] = True`). Re-using a previously submitted payment transaction fails deterministically.

### 2. 🔑 Verified Caller Authorization & Identity Binding
- Evaluation requests bind the caller's verified MetaMask address (`user_identity`).
- Tying evaluation requests to verified sender addresses ensures transparent audit trails and prevents unauthenticated data submission.

### 3. 🛡️ Isolated Per-Request Storage & Retrieval
- Results are stored in contract storage using a persistent TreeMap mapping: `self.signals_by_request[request_id]`.
- View method `@gl.public.view def get_signal(request_id: str)` retrieves results strictly keyed by `request_id`.
- **Concurrency Protection**: Independent request IDs ensure concurrent polling requests from different users can never leak or overwrite another user's trading signal.

### 4. 🧪 Automated Contract Security Test Suite (`tests/test_oracle_security.py`)
Our test suite includes 13 automated unit tests verifying contract security:
- `TestForgedPayments`: Verifies immediate rejection of empty/whitespace payment references.
- `TestReplayAttack`: Confirms duplicate `payment_tx` or `request_id` submissions are blocked.
- `TestRequestIdMismatch`: Verifies strict isolation between distinct user sessions (`User A` vs `User B`).
- `TestEquivalencePrinciple`: Validates non-deterministic 5-validator LLM comparative equivalence logic.

---

## 🧠 GenVM Multi-Validator Equivalence Principle

```
  ┌─────────────────────────────────────────────────────────────┐
  │                   GenSignal Web3 Frontend                   │
  │             (React + Vite + MetaMask EIP-712)               │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ 1. Sign & Execute (x402)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │               GenSignal FastAPI Backend Server              │
  │        (Python 3.11 + GenLayer SDK + Binance Klines)        │
  └──────────────┬──────────────────────────────┬───────────────┘
                 │                              │
  2. Micropayment│                              │ 3. 14 Market Indicators
                 ▼                              ▼
  ┌──────────────────────────────┐ ┌───────────────────────────┐
  │   SignalTreasury Contract    │ │  Binance OHLCV Live Data  │
  │ (0x9e70bFAD6bd7721758ec3dae) │ │(RSI, EMA 9/20/50, RVOL)  │
  └──────────────┬───────────────┘ └─────────────┬─────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │ 4. evaluate_signal()
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │            GenSignal Intelligent Oracle Contract            │
  │ (0x73B568e186A16761c317F52D65e0d53a5f705a5b on Studionet)  │
  ├─────────────────────────────────────────────────────────────┤
  │    gl.vm.run_nondet_unsafe(leader_fn, validator_fn)         │
  │    • Leader Node: LLM Inference → JSON Signal Format        │
  │    • 5x Validator Nodes: Comparative Equivalence Matching   │
  │    • Consensus Result: MAJORITY_AGREE (5/5 Votes)           │
  └─────────────────────────────────────────────────────────────┘
```

When evaluating trading signals, GenSignal's Intelligent Contract triggers GenVM non-deterministic execution:
1. **Leader Node Execution (`_exec_once`)**: Synthesizes full 14-indicator market payloads into structured JSON trading decisions (`verdict`, `confidence`, `expert_summary`, `supporting`, `trade`).
2. **Validator Node Equivalence (`_signal_equivalent`)**: 5 independent AI Validator nodes run verification routines to enforce:
   - **Verdict Matching**: Leader and Validator decisions must match (`Long`, `Short`, `Neutral`, `Skip`).
   - **Confidence Margin**: Confidence scores must align within a strict `±10%` threshold.
3. **On-Chain Settlement**: Upon `MAJORITY_AGREE` (5/5 votes), the finalized decision is written to contract storage.

---

## 📈 Quantitative Indicators & Supported Strategies

Each evaluation payload incorporates 14 real-time market metrics derived from 4-hour Binance OHLCV candles:
- **Momentum Indicators**: `RSI(14)`, RSI Zone (`Strong Bullish / Overbought / Oversold`).
- **Trend Moving Averages**: `EMA 9`, `EMA 20`, `EMA 50`, EMA Trend Stack.
- **Volume & Pressure**: `RVOL` (Relative Volume), Taker Buy/Sell Ratio (`%`).
- **Volatility & Channels**: `ATR(14)` & `ATR%`, Bollinger Bands Position (`%B`).
- **Macro Alignment**: 30-day Daily Trend alignment.

### 8 Trading Strategy Desks
1. **Quant RSI/EMA Momentum**
2. **Market Structure (BOS / CHOCH)**
3. **Smart Money Concepts (Order Block / FVG)**
4. **Liquidity & Stop-Hunt Sweep Map**
5. **Bollinger Volatility Squeeze**
6. **SuperTrend Trailing ATR Breakout**
7. **MACD Zero-Line Divergence**
8. **Volume Profile & VWAP POC**

---

## 🛠️ Local Development & Testing

### 1. Installation
```bash
git clone https://github.com/ntclick/GenSignal.git
cd GenSignal

# Install Python dependencies
pip install -r backend/requirements.txt
```

### 2. Run Security & Contract Test Suite
```bash
python -m pytest tests/test_oracle_security.py tests/test_signal_oracle.py -v
```

### 3. Run Live Transaction Output Extractor
```bash
# Extract 5-Validator consensus votes and Executive Thesis for any live transaction
python tests/test_get_equivalence_outputs.py 0x3496a22f6ec7ae464c1974c1cd9428c18760ff699a51c9d83f1dfb109ef52ee1
```

### 4. Start Local Backend Server
```bash
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8001 --reload
```

---

## 📜 License

MIT License. Built for the GenLayer Ecosystem.
