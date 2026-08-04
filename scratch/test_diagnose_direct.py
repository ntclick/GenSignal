import os
import sys
import json
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import diagnose_failed_tx

def run():
    print("========================================================================")
    print("[+] DIRECT DIAGNOSTIC TOOL INTEGRATION TEST")
    print("========================================================================\n")

    # Test with a known past payment transaction hash
    tx_hash = "0xfd78eda296f240fee3d88d4b6ed4372693e7be2e489d11305be7fa22b8c90ea4"
    print(f"[*] Testing diagnose_failed_tx for tx: {tx_hash}")

    diag = diagnose_failed_tx(tx_hash)
    print("\n[*] Diagnostic Result Object:")
    print(json.dumps(diag, indent=2))

if __name__ == "__main__":
    run()
