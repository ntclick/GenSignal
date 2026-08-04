import os
import sys
import time
import json
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from genlayer_py import create_account, create_client
from genlayer_py.chains import testnet_bradbury
from genlayer_py.types import TransactionStatus

PRIMARY_RPC_URL = "https://rpc-bradbury.genlayer.com"
ORACLE_CONTRACT_ADDRESS = "0x5Fc7020bD35405dC653727b2c4694424da5D29BC"

def run():
    print("========================================================================")
    print("[+] TESTING SINGLE TX SUBMISSION & RECEIPT POLLING (NO RE-SUBMIT)")
    print("========================================================================\n")

    private_key = os.getenv("GENLAYER_PRIVATE_KEY")
    if not private_key:
        print("[!] ERROR: GENLAYER_PRIVATE_KEY is missing in .env")
        return

    key = private_key if private_key.startswith("0x") else "0x" + private_key
    account = create_account(key)
    sender_address = str(account.address)
    print(f"[*] Account Address: {sender_address}")

    client = create_client(chain=testnet_bradbury, endpoint=PRIMARY_RPC_URL, account=account)
    print(f"[*] Connected to RPC: {PRIMARY_RPC_URL}")

    # Fetch real Binance market data
    url = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=30"
    resp = httpx.get(url).json()
    closes = [float(k[4]) for k in resp]
    cur_p = closes[-1]
    ema9 = sum(closes[-9:]) / 9
    ema20 = sum(closes[-20:]) / 20

    market_summary = (
        f"Real Binance Market Data for BTC/USDT (4h): "
        f"Current Price = ${cur_p:,.2f}, EMA(9) = ${ema9:,.2f}, EMA(20) = ${ema20:,.2f}. "
        f"Price relative to EMA: {'Above EMA' if cur_p > ema20 else 'Below EMA'}."
    )
    print(f"[*] Payload:\n    {market_summary}\n")

    payment_ref = "0x_single_receipt_test_" + str(int(time.time()))
    print("[*] Submitting 1 single write_contract(evaluate_signal)...")

    t0 = time.time()
    try:
        tx_hash = client.write_contract(
            address=ORACLE_CONTRACT_ADDRESS,
            function_name="evaluate_signal",
            args=[market_summary, payment_ref, "BTC", "BTC/USDT", "signals", sender_address]
        )
        t1 = time.time()
        print(f"[OK] Tx Submitted in {round((t1 - t0)*1000, 2)}ms -> Hash: {tx_hash}")
    except Exception as e:
        import traceback
        print(f"[FAIL] Submission failed: {e}")
        traceback.print_exc()
        return

    # Now poll receipt for 120 seconds continuously without re-submitting
    print("\n[*] Polling receipt for up to 120s (interval 5s)...")
    tx_hash_str = str(tx_hash)
    
    start_poll = time.time()
    receipt = None
    for attempt in range(1, 25): # 24 x 5s = 120s
        elapsed = round(time.time() - start_poll, 1)
        print(f"    ├─ [{elapsed}s] Check {attempt}/24: Polling receipt for {tx_hash_str[:18]}...")
        try:
            r = client.get_transaction_receipt(transaction_hash=tx_hash_str)
            if r:
                receipt = r
                print(f"\n[SUCCESS] Receipt Found at {elapsed}s! Status: {r}")
                break
        except Exception as err:
            pass
        time.sleep(5)

    if not receipt:
        print(f"\n[TIMEOUT] Receipt not finalized within 120s.")
        # Check transaction status via JSON-RPC
        try:
            status_res = client.provider.make_request("gen_getTransactionStatus", [{"txId": tx_hash_str}])
            print(f"[*] Current gen_getTransactionStatus RPC response: {status_res}")
        except Exception as st_err:
            print(f"[!] Status check error: {st_err}")

if __name__ == "__main__":
    run()
