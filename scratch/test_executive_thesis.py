"""
GenSignal — Live Transaction Test & Executive Thesis Extractor
Submits an evaluate_signal transaction to GenLayer Studionet, waits for AI consensus,
and extracts the exact "GenLayer LLM Executive Thesis" (expert_summary) on-chain.
"""

import os
import sys
import json
import time
import uuid
import pathlib
import httpx
from dotenv import load_dotenv
from genlayer_py import create_client, create_account, studionet

sys.stdout.reconfigure(encoding="utf-8")

# Load environment
env_path = pathlib.Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

pk = os.getenv("GENLAYER_PRIVATE_KEY", "")
if not pk.startswith("0x"):
    pk = "0x" + pk

# Use clean account key for test
TEST_PK = "0x5d9178152f90eab7dfffd454107069fe3853c1d416ef5b3464e1b2756ab8537c"
account = create_account(TEST_PK)

CONTRACT = "0x73B568e186A16761c317F52D65e0d53a5f705a5b"
RPC_URL  = "https://studio.genlayer.com/api"

client = create_client(chain=studionet, endpoint=RPC_URL, account=account)

payment_tx_hash = f"0x{uuid.uuid4().hex}"
request_id      = f"thesis_test_{uuid.uuid4().hex[:8]}"

print("=" * 80)
print("  GENSIGNAL — LIVE TRANSACTION & EXECUTIVE THESIS EXTRACTOR")
print(f"  Caller Address : {account.address}")
print(f"  Contract Addr  : {CONTRACT}")
print(f"  Payment Ref    : {payment_tx_hash}")
print(f"  Request ID     : {request_id}")
print("=" * 80)

# Build full 100% real indicator payload
payload = json.dumps({
    "asset": {
        "symbol": "BTC",
        "pair": "BTC/USDT",
        "timeframe": "4h",
        "strategy": "Quant RSI/EMA Momentum",
        "asset_class": "Macro Major (Trend & EMA Confluence)",
        "current_price": 96850.5,
        "period_change_pct": 3.42
    },
    "indicators": {
        "rsi_14": 68.4,
        "rsi_zone": "Strong bullish momentum zone (68.4 > 60)",
        "ema_9": 96210.0,
        "ema_20": 94850.25,
        "ema_50": 92400.1,
        "ema_trend": "Bullish trend stack: EMA9 > EMA20 > EMA50",
        "macd_status": "Bullish crossover with expanding histogram",
        "bb_position": "Upper band expansion (%B = 78.5%)",
        "rvol": 1.82,
        "buy_ratio": 64.2,
        "atr_14": 1850.0,
        "atr_pct": 1.91,
        "daily_trend": "+4.2% (30d). Daily price above EMA20."
    },
    "meta": {
        "user_identity": str(account.address),
        "payment_tx": payment_tx_hash,
        "request_id": request_id,
        "risk_profile": "4h Swing: Balanced analysis."
    }
})

print("\n[STEP 1] Submitting evaluate_signal transaction to GenLayer Studionet...")
tx_hash = client.write_contract(
    address=CONTRACT,
    function_name="evaluate_signal",
    args=[payload, payment_tx_hash, "BTC", "BTC/USDT", "Quant RSI/EMA Momentum", str(account.address), request_id]
)

clean_tx = str(tx_hash).strip()
print(f"  ✅ SUCCESS: Transaction submitted!")
print(f"  📌 Tx Hash : {clean_tx}")
print(f"  🌐 Explorer: https://explorer-studio.genlayer.com/tx/{clean_tx}")

print("\n[STEP 2] Waiting for GenLayer AI-Validators consensus finalization...")
for attempt in range(1, 35):
    time.sleep(2)
    try:
        r = httpx.post(
            RPC_URL,
            json={"jsonrpc": "2.0", "method": "eth_getTransactionReceipt", "params": [clean_tx], "id": 1},
            timeout=10.0
        ).json()
        status = r.get("result", {}).get("status")
        if status in ["0x1", 1]:
            print(f"  ✅ Consensus finalized! Receipt Status: ACCEPTED ({status})")
            break
        print(f"  ⌛ Polling consensus finalization (attempt {attempt}/35)...")
    except Exception as err:
        print(f"  ⌛ Retrying poll ({err})...")

print(f"\n[STEP 3] Reading output via get_signal('{request_id}')...")
time.sleep(3)

raw_signal = client.read_contract(address=CONTRACT, function_name="get_signal", args=[request_id])
signal = json.loads(raw_signal) if isinstance(raw_signal, str) else raw_signal

print("\n" + "=" * 80)
print("  🎯 GENLAYER LLM EXECUTIVE THESIS (EXPERT SUMMARY ON-CHAIN OUTPUT):")
print("=" * 80)
print(f"  • Verdict        : {signal.get('verdict')}")
print(f"  • Confidence     : {signal.get('confidence')}%")
print(f"  • Executive Thesis: \"{signal.get('expert_summary')}\"")
print("-" * 80)
print("  • Supporting Reasons:")
for idx, reason in enumerate(signal.get("supporting", []), 1):
    print(f"    {idx}. {reason}")
print("-" * 80)
print(f"  • Counterpoint   : \"{signal.get('counterpoint')}\"")
print(f"  • Invalidation   : \"{signal.get('invalidation')}\"")
print("-" * 80)
print(f"  • Trade Levels   : Entry={signal.get('trade', {}).get('entry')}, TP={signal.get('trade', {}).get('takeProfit')}, SL={signal.get('trade', {}).get('stopLoss')}, R:R={signal.get('trade', {}).get('riskReward')}")
print("=" * 80)
