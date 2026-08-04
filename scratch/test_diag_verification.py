import os
import sys
import json
import httpx

def run():
    print("========================================================================")
    print("[+] TESTING DIAGNOSTIC ERROR WIRING ON /api/signal/evaluate")
    print("========================================================================\n")

    url = "http://127.0.0.1:8001/api/signal/evaluate"
    payload = {
        "symbol": "BTC",
        "pair": "BTC/USDT",
        "strategy": "signals",
        "timeframe": "4h",
        "user_address": "0xe1966fcb8c2018ff18f7be7a92f7e5fb09776bc2",
        "signature": "0x_test_simulated_sig",
        "payment_tx": None
    }

    print(f"[*] Sending POST request to {url}...")
    try:
        resp = httpx.post(url, json=payload, timeout=120.0)
        print(f"[*] Response Status Code: {resp.status_code}")
        print(f"[*] Raw Response Content:\n{json.dumps(resp.json(), indent=2)}")
    except Exception as e:
        print(f"[!] Error making request: {e}")

if __name__ == "__main__":
    run()
