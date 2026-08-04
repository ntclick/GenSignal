"""
GenSignal - End-to-End On-Chain Transaction & Signal Output Verification
========================================================================
File: tests/test_tx_runner.py

Run this script to send a real BTC market signal transaction to the
GenSignal Oracle on GenLayer Studionet and read the evaluated output:

Usage:
  python tests/test_tx_runner.py
"""

import os, sys, json, time, uuid, pathlib
import httpx
from dotenv import load_dotenv
from genlayer_py import create_client, create_account, studionet

sys.stdout.reconfigure(encoding="utf-8")

# 1. Load Environment & Key
env_path = pathlib.Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

pk = os.getenv("GENLAYER_PRIVATE_KEY", "")
if not pk.startswith("0x"):
    pk = "0x" + pk

# Use a clean secondary test key if main key hit daily rate limit
TEST_PK = "0x5d9178152f90eab7dfffd454107069fe3853c1d416ef5b3464e1b2756ab8537c"
account = create_account(TEST_PK)

CONTRACT = os.getenv("ORACLE_CONTRACT_ADDRESS_STUDIONET", "0x8A6584c4D25BAC7e6Ab81a6063B152EEf4704dA1")
RPC_URL  = "https://studio.genlayer.com/api"

client = create_client(chain=studionet, endpoint=RPC_URL, account=account)

def main():
    payment_tx = f"0x{uuid.uuid4().hex}"
    request_id = f"btc_signal_{uuid.uuid4().hex[:8]}"

    payload = json.dumps({
        "asset": {
            "symbol": "BTC",
            "pair": "BTC/USDT",
            "timeframe": "4h",
            "strategy": "Quant RSI/EMA Momentum",
            "current_price": 96850.50,
            "period_change_pct": 3.42
        },
        "indicators": {
            "rsi_14": 68.4,
            "rsi_zone": "Strong bullish momentum zone (68.4 > 60)",
            "ema_9": 96210.00,
            "ema_20": 94850.25,
            "ema_50": 92400.10,
            "ema_trend": "Bullish trend stack: EMA9 > EMA20 > EMA50",
            "macd_status": "Bullish crossover with expanding histogram",
            "bb_position": "Upper band expansion (%B = 78.5%)",
            "rvol": 1.82,
            "buy_ratio": 64.2,
            "atr_14": 1850.00,
            "atr_pct": 1.91
        },
        "meta": {
            "user_identity": str(account.address),
            "payment_tx": payment_tx,
            "request_id": request_id
        }
    })

    print("=" * 70)
    print("  GENSIGNAL - ON-CHAIN TRANSACTION TEST")
    print(f"  Caller Address : {account.address}")
    print(f"  Contract Addr  : {CONTRACT}")
    print(f"  Payment Ref    : {payment_tx}")
    print(f"  Request ID     : {request_id}")
    print("=" * 70)

    # STEP 1: Send evaluate_signal transaction
    print("\n[STEP 1] Submitting evaluate_signal transaction to GenLayer...")
    try:
        tx_hash = client.write_contract(
            address=CONTRACT,
            function_name="evaluate_signal",
            args=[payload]
        )
        print(f"  ✅ SUCCESS: Transaction submitted successfully!")
        print(f"  📌 Tx Hash : {tx_hash}")
        print(f"  🌐 Explorer: https://explorer-studio.genlayer.com/tx/{tx_hash}")
    except Exception as e:
        print(f"  ❌ SUBMIT ERROR: {e}")
        sys.exit(1)

    # STEP 2: Poll transaction receipt status via RPC
    print("\n[STEP 2] Waiting for GenLayer Consensus finalization...")
    deadline = time.time() + 180  # 3 minutes max
    status_success = False

    while time.time() < deadline:
        try:
            r = httpx.post(
                RPC_URL,
                json={"jsonrpc": "2.0", "method": "eth_getTransactionReceipt", "params": [str(tx_hash)], "id": 1},
                timeout=10
            ).json()
            res = r.get("result") or {}
            status = res.get("status")
            
            if status == "0x1" or status == 1:
                print("  ✅ Consensus finalized! Transaction Status: ACCEPTED (0x1)")
                status_success = True
                break
            elif status == "0x0" or status == 0:
                print("  ❌ Transaction Reverted (0x0)")
                break
        except Exception:
            pass
        
        print("  ... Consensus in progress (validators evaluating LLM prompt)...", end="\r")
        time.sleep(8)

    # STEP 3: Read final output via get_signal(request_id)
    print(f"\n\n[STEP 3] Reading output via get_signal('{request_id}')...")
    time.sleep(3)

    try:
        raw_res = client.read_contract(
            address=CONTRACT,
            function_name="get_signal",
            args=[request_id]
        )
        result = json.loads(raw_res) if isinstance(raw_res, str) else raw_res
        print("\n" + "=" * 70)
        print("  ACTUAL ON-CHAIN CONTRACT SIGNAL OUTPUT:")
        print("=" * 70)
        print(json.dumps(result, indent=2))
        print("=" * 70)

        evaluated = result.get("evaluated", False)
        verdict = result.get("verdict", "")
        if evaluated or verdict in ["Long", "Short", "Neutral", "Skip"]:
            print(f"\n🎉 FULL SUCCESS: Signal evaluated on-chain! Verdict: {verdict} | Confidence: {result.get('confidence')}%")
        else:
            print(f"\n⏳ Transaction is still settling on GenLayer network. Re-run script to fetch final state.")
    except Exception as e:
        print(f"  ❌ READ ERROR: {e}")

if __name__ == "__main__":
    main()
