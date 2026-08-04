"""
GenSignal — Extract Equivalence Principle Consensus & Outputs Script
Queries GenLayer JSON-RPC for exact transaction status, 5-Validator Equivalence votes, and settled output.
"""

import sys
import json
import httpx

sys.stdout.reconfigure(encoding="utf-8")

RPC_URL = "https://studio.genlayer.com/api"
DEFAULT_TX_HASH = "0xa0ecdb8fa67f3ab10de787b9e154afbd65935c2042b3a04f5311d77e897c5cde"

tx_hash = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith("0x") else DEFAULT_TX_HASH

print("=" * 80)
print(f"  GENLAYER EQUIVALENCE PRINCIPLE CONSENSUS & OUTPUTS EXTRACTOR")
print(f"  Transaction Hash : {tx_hash}")
print(f"  RPC Endpoint     : {RPC_URL}")
print("=" * 80)

r = httpx.post(
    RPC_URL,
    json={"jsonrpc": "2.0", "method": "eth_getTransactionByHash", "params": [tx_hash], "id": 1},
    timeout=15.0
).json()

res = r.get("result") or {}

if not res:
    print("❌ Error: Transaction not found on GenLayer Studionet RPC.")
    sys.exit(1)

print("\n📌 1. OVERALL TRANSACTION CONSENSUS STATUS:")
print(f"  • Transaction Status : {res.get('status')}")
print(f"  • Consensus Result   : {res.get('result_name')}")
print(f"  • Sender Address     : {res.get('sender')}")
print(f"  • Contract (To)      : {res.get('recipient')}")
print(f"  • Initial Validators : {res.get('num_of_initial_validators')} AI Nodes")
print(f"  • Config Rotations   : {res.get('config_rotation_rounds')}")

last_round = res.get("last_round", {})
validators = last_round.get("round_validators", [])
votes_name = last_round.get("validator_votes_name", [])
votes_raw  = last_round.get("validator_votes", [])

print("\n⚖️ 2. EQUIVALENCE PRINCIPLE VALIDATOR VOTES (5/5 NODES):")
print("-" * 80)
for idx, (v_addr, v_vote_name, v_vote_val) in enumerate(zip(validators, votes_name, votes_raw)):
    print(f"  Validator #{idx+1}: {v_addr} | Vote: {v_vote_name} ({v_vote_val})")
print("-" * 80)
print(f"  Total Committed Votes : {last_round.get('votes_committed')}")
print(f"  Total Revealed Votes  : {last_round.get('votes_revealed')}")

print("\n🤖 3. LEADER LLM PROVIDER & EXECUTION ENGINE:")
nodes = res.get("consensus_data", {}).get("nodes", {})
for node_addr, node_info in nodes.items():
    llm_info = node_info.get("leader_sim_data", {}).get("llm_provider", {})
    genvm_info = node_info.get("leader_sim_data", {}).get("genvm_result", {})
    if llm_info:
        print(f"  • Node Address  : {node_addr}")
        print(f"  • LLM Provider  : {llm_info.get('provider')} ({llm_info.get('plugin')})")
        print(f"  • API Endpoint  : {llm_info.get('plugin_config', {}).get('api_url')}")
        print(f"  • Exec Result   : {node_info.get('leader_sim_data', {}).get('execution_result')}")

print("\n" + "=" * 80)
print("  COMPLETE!")
print("=" * 80)
