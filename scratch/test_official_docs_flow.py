"""
GenSignal — Official Docs Flow Test Script
Demonstrates exact GenLayer DApp Workflow according to GenLayer Official Docs:
1. Submit write transaction evaluate_signal()
2. Poll transaction status until ACCEPTED / FINALIZED
3. Execute readContract (get_signal) view function to parse on-chain JSON state
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

TEST_PK = "0x5d9178152f90eab7dfffd454107069fe3853c1d416ef5b3464e1b2756ab8537c"
account = create_account(TEST_PK)
CONTRACT = "0x73B568e186A16761c317F52D65e0d53a5f705a5b"
RPC_URL  = "https://studio.genlayer.com/api"

client = create_client(chain=studionet, endpoint=RPC_URL, account=account)

payment_tx_hash = f"0x{uuid.uuid4().hex}"
request_id      = f"docs_flow_{uuid.uuid4().hex[:8]}"

print("=" * 80)
print("  GENLAYER OFFICIAL DAPP WORKFLOW TEST")
print(f"  Account Address  : {account.address}")
print(f"  Contract Address : {CONTRACT}")
print(f"  Request ID       : {request_id}")
print("=" * 80)

# Build complete OHLCV market indicator payload
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

# STEP 1: Write Transaction (send_transaction)
print("\n[STEP 1] Executing @gl.public.write evaluate_signal()...")
tx_hash = client.write_contract(
    address=CONTRACT,
    function_name="evaluate_signal",
    args=[payload, payment_tx_hash, "BTC", "BTC/USDT", "Quant RSI/EMA Momentum", str(account.address), request_id]
)
clean_tx = str(tx_hash).strip()
print(f"  ✅ Transaction Submitted: {clean_tx}")
print(f"  🌐 Explorer URL        : https://explorer-studio.genlayer.com/tx/{clean_tx}")

# STEP 2: Monitor Transaction Status (monitorTransaction)
print("\n[STEP 2] Monitoring Transaction Status via RPC...")
is_finalized = False
for attempt in range(1, 30):
    time.sleep(2.5)
    try:
        r = httpx.post(
            RPC_URL,
            json={"jsonrpc": "2.0", "method": "eth_getTransactionReceipt", "params": [clean_tx], "id": 1},
            timeout=10.0
        ).json()
        status = r.get("result", {}).get("status")
        if status in ["0x1", 1]:
            print(f"  ✅ Transaction Finalized on GenLayer Consensus! Status: {status}")
            is_finalized = True
            break
        print(f"  ⌛ Polling transaction status (Attempt {attempt}/30)...")
    except Exception as e:
        print(f"  ⌛ Retrying ({e})...")

if not is_finalized:
    print("⚠️ Timeout waiting for transaction receipt — attempting direct readContract anyway.")

# STEP 3: Read Contract (readContract get_signal)
print(f"\n[STEP 3] Executing @gl.public.view readContract(get_signal, ['{request_id}'])...")
raw_output = client.read_contract(address=CONTRACT, function_name="get_signal", args=[request_id])
output = json.loads(raw_output) if isinstance(raw_output, str) else raw_output

print("\n" + "=" * 80)
print("  OFFICIAL CONTRACT READ OUTPUT (GENLAYER DAPP WORKFLOW):")
print("=" * 80)
print(json.dumps(output, indent=2))
print("=" * 80)
