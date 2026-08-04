"""
GenSignal - Live Contract Consensus & Security Verification Script
==================================================================
Run this script to perform a full end-to-end test on GenLayer Studionet:
  1. Submits evaluate_signal() with a unique payment_tx & request_id
  2. Waits for GenLayer consensus
  3. Queries get_signal(request_id) to verify isolated result

Usage:
  python tests/test_live_consensus.py
"""

import os, sys, json, time, uuid, pathlib
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

account = create_account(pk)
contract_address = os.getenv("ORACLE_CONTRACT_ADDRESS_STUDIONET", "0x73B568e186A16761c317F52D65e0d53a5f705a5b")
rpc_endpoint = "https://studio.genlayer.com/api"

client = create_client(chain=studionet, endpoint=rpc_endpoint, account=account)

def run_test():
    payment_tx = f"0x{uuid.uuid4().hex}"
    request_id = f"req_live_{uuid.uuid4().hex[:8]}"

    payload = json.dumps({
        "asset": {
            "symbol": "BTC",
            "pair": "BTC/USDT",
            "timeframe": "4h",
            "strategy": "Trading Signals (RSI/EMA)",
            "current_price": 95418.72,
            "period_change_pct": 2.85
        },
        "indicators": {
            "rsi_14": 64.8,
            "rsi_zone": "Bullish momentum zone",
            "ema_9": 94820.50,
            "ema_20": 93910.30,
            "ema_50": 92140.80,
            "ema_trend": "Bullish trend stack",
            "macd_status": "Bullish crossover",
            "bb_position": "Mid-upper band",
            "rvol": 1.58,
            "buy_ratio": 61.3,
            "atr_14": 2108.40,
            "atr_pct": 2.2
        },
        "meta": {
            "user_identity": str(account.address),
            "payment_tx": payment_tx,
            "request_id": request_id
        }
    })

    print("=" * 65)
    print("  GENSIGNAL ON-CHAIN LIVE TEST")
    print(f"  Account : {account.address}")
    print(f"  Contract: {contract_address}")
    print(f"  Explorer: https://explorer-studio.genlayer.com/address/{contract_address}")
    print("=" * 65)

    print("\n[1/3] Submitting evaluate_signal transaction...")
    tx_hash = client.write_contract(
        address=contract_address,
        function_name="evaluate_signal",
        args=[payload]
    )
    print(f"  ✅ Tx Hash : {tx_hash}")
    print(f"  🔗 Explorer: https://explorer-studio.genlayer.com/tx/{tx_hash}")

    print("\n[2/3] Waiting 60 seconds for GenLayer LLM consensus finalization...")
    for remaining in range(60, 0, -10):
        print(f"  ... remaining {remaining}s", end="\r")
        time.sleep(10)
    print("  ... Consensus wait complete!              ")

    print(f"\n[3/3] Querying get_signal('{request_id}')...")
    result = client.read_contract(
        address=contract_address,
        function_name="get_signal",
        args=[request_id]
    )

    print("\n==================================================")
    print("  ACTUAL ON-CHAIN CONTRACT OUTPUT:")
    print("==================================================")
    print(json.dumps(result, indent=2))
    print("==================================================")

    evaluated = result.get("evaluated", False)
    verdict = result.get("verdict", "")

    if evaluated or verdict in ["Long", "Short", "Neutral", "Skip"]:
        print(f"\n🏆 TEST SUCCESS: Contract evaluated signal -> Verdict: {verdict}")
    else:
        print(f"\n⏳ Transaction is processing on GenLayer testnet.")
        print(f"   You can re-query get_signal('{request_id}') via SDK or Explorer link above.")

if __name__ == "__main__":
    run_test()
