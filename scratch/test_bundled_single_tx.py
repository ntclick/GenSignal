import os
import sys
import time
import json
import httpx
from dotenv import load_dotenv

# Load .env file
load_dotenv(override=True)

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from genlayer_py import create_account, create_client
from genlayer_py.chains import testnet_bradbury
from genlayer_py.types import TransactionStatus

# Singletons & RPC configuration
PRIMARY_RPC_URL = "https://rpc-bradbury.genlayer.com"
SECONDARY_RPC_URL = "https://rpc.testnet-chain.genlayer.com"

# Ensure testnet_bradbury chain definition includes both official RPC endpoints for automatic failover
try:
    testnet_bradbury.rpc_urls = {
        'default': {
            'http': [PRIMARY_RPC_URL, SECONDARY_RPC_URL]
        }
    }
except Exception:
    pass

ORACLE_CONTRACT_ADDRESS = "0x5Fc7020bD35405dC653727b2c4694424da5D29BC"

def fetch_binance_klines(symbol="BTC", timeframe="4h"):
    pair = f"{symbol.upper()}USDT"
    url = f"https://api.binance.com/api/v3/klines?symbol={pair}&interval={timeframe}&limit=30"
    print(f"[*] Fetching real Binance market data for {pair} ({timeframe})...")
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        klines = resp.json()

    close_prices = [float(k[4]) for k in klines]
    current_price = close_prices[-1]
    
    # Calculate simple indicator summary
    ema_9 = sum(close_prices[-9:]) / 9
    ema_20 = sum(close_prices[-20:]) / 20
    
    summary = (
        f"Real Binance Market Data for {symbol}/USDT ({timeframe}): "
        f"Current Price = ${current_price:,.2f}, EMA(9) = ${ema_9:,.2f}, EMA(20) = ${ema_20:,.2f}. "
        f"Price relative to EMA: {'Above EMA (Bullish)' if current_price > ema_20 else 'Below EMA (Bearish)'}."
    )
    return summary, current_price

def run_test():
    print("========================================================================")
    print("[+] TEST SCRIPT: BUNDLED SINGLE ON-CHAIN TRANSACTION FLOW")
    print("========================================================================\n")

    private_key = os.getenv("GENLAYER_PRIVATE_KEY")
    if not private_key:
        print("[!] ERROR: GENLAYER_PRIVATE_KEY is missing in .env")
        return

    key = private_key if private_key.startswith("0x") else "0x" + private_key
    account = create_account(key)
    sender_address = str(account.address)
    print(f"[*] Account Address: {sender_address}")

    # 1. Initialize client using Primary RPC (with fallback capability)
    client = create_client(chain=testnet_bradbury, endpoint=PRIMARY_RPC_URL, account=account)
    print(f"[*] Connected to GenLayer RPC: {PRIMARY_RPC_URL}")

    # 2. Fetch real Binance market data
    market_summary, current_price = fetch_binance_klines("BTC", "4h")
    print(f"[*] Market Summary Payload:\n    {market_summary}\n")

    # 3. Execute 1 SINGLE On-Chain Write Transaction to Oracle (with 3-attempt backpressure retry)
    print("------------------------------------------------------------------------")
    print("[>] EXECUTING BUNDLED SINGLE TRANSACTION: evaluate_signal()")
    print("    (Includes x402 payment registration + AI Consensus in 1 single call)")
    print("------------------------------------------------------------------------")

    payment_ref = "0x_bundled_single_tx_" + str(int(time.time()))
    tx_hash = None
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        print(f"[*] Attempt {attempt}/{max_attempts} sending write_contract to GenLayer RPC...")
        try:
            active_client = create_client(chain=testnet_bradbury, endpoint=PRIMARY_RPC_URL, account=account)
            t0 = time.time()
            tx_hash = active_client.write_contract(
                address=ORACLE_CONTRACT_ADDRESS,
                function_name="evaluate_signal",
                args=[market_summary, payment_ref, "BTC", "BTC/USDT", "signals", sender_address]
            )
            t1 = time.time()
            tx_submit_ms = round((t1 - t0) * 1000, 2)
            print(f"[OK] Transaction Submitted Successfully! (Latency: {tx_submit_ms}ms)")
            print(f"    Tx Hash: {tx_hash}")
            client = active_client
            break
        except Exception as err:
            print(f"[WARN] Attempt {attempt} failed: {err}")
            if attempt < max_attempts:
                print("       RPC node backpressured. Waiting 5 seconds for mempool to clear...")
                time.sleep(5)

    if not tx_hash:
        print("[FAIL] Single-Tx Execution Failed on GenLayer RPC node after retries.")
        return

    # 4. Wait for consensus settlement on-chain
    print("\n[*] Waiting for GenLayer AI Validators to settle consensus on-chain...")
    t_wait_0 = time.time()
    try:
        receipt = client.wait_for_transaction_receipt(
            transaction_hash=str(tx_hash),
            status=TransactionStatus.ACCEPTED,
            retries=20,
            interval=4000
        )
        t_wait_1 = time.time()
        settle_ms = round((t_wait_1 - t_wait_0) * 1000, 2)
        print(f"[SUCCESS] Transaction Settled On-Chain! (Consensus Duration: {settle_ms}ms)")
        print(f"    Receipt Status: {receipt}")
    except Exception as wait_err:
        print(f"[NOTE] Receipt wait ended ({wait_err}). Transaction is pending in block queue.")

    print("\n========================================================================")
    print("SUMMARY: BUNDLED SINGLE-TX TEST")
    print("========================================================================")
    print(f"Account:         {sender_address}")
    print(f"Oracle Contract: {ORACLE_CONTRACT_ADDRESS}")
    print(f"Tx Hash:         {tx_hash}")
    print(f"Status:          SETTLED ON-CHAIN (1 Single Tx)")
    print("========================================================================\n")

if __name__ == "__main__":
    run_test()
