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

def wait_for_tx_receipt_safe(client, tx_hash: str, retries=25, interval_ms=3000):
    tx_clean = tx_hash if tx_hash.startswith("0x") else "0x" + tx_hash
    print(f"[*] Starting safe receipt polling for {tx_clean[:18]}... (Grace period 2s)")
    time.sleep(2.0)

    for attempt in range(1, retries + 1):
        try:
            receipt = client.wait_for_transaction_receipt(
                transaction_hash=tx_clean,
                status=TransactionStatus.ACCEPTED,
                retries=1,
                interval=1000
            )
            if receipt:
                print(f"[✅] Safe Poll SUCCESS on attempt {attempt}! Receipt: {receipt}")
                return receipt
        except Exception as e:
            err_str = str(e)
            print(f"    ├─ Attempt {attempt}/{retries}: {err_str[:90]}...")
        
        time.sleep(interval_ms / 1000.0)

    raise Exception(f"Transaction {tx_clean} receipt timeout after {retries} attempts.")

def run():
    private_key = os.getenv("GENLAYER_PRIVATE_KEY")
    key = private_key if private_key.startswith("0x") else "0x" + private_key
    account = create_account(key)
    sender_address = str(account.address)

    client = create_client(chain=testnet_bradbury, endpoint=PRIMARY_RPC_URL, account=account)

    url = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=30"
    resp = httpx.get(url).json()
    closes = [float(k[4]) for k in resp]
    cur_p = closes[-1]
    ema9 = sum(closes[-9:]) / 9
    ema20 = sum(closes[-20:]) / 20

    market_summary = (
        f"Real Binance Market Data for BTC/USDT (4h): "
        f"Current Price = ${cur_p:,.2f}, EMA(9) = ${ema9:,.2f}, EMA(20) = ${ema20:,.2f}."
    )

    payment_ref = "0x_safe_wait_test_" + str(int(time.time()))
    print("[*] Submitting write_contract...")
    tx_hash = client.write_contract(
        address=ORACLE_CONTRACT_ADDRESS,
        function_name="evaluate_signal",
        args=[market_summary, payment_ref, "BTC", "BTC/USDT", "signals", sender_address]
    )
    print(f"[OK] Tx Hash: {tx_hash}")

    receipt = wait_for_tx_receipt_safe(client, str(tx_hash), retries=20, interval_ms=3000)
    print("🎉 Final Result:", receipt)

if __name__ == "__main__":
    run()
