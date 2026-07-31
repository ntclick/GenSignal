# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

SIGNAL_RUBRIC = """
You are an independent quantitative trading analyst operating as an AI validator on GenLayer.
Evaluate the market data and technical indicators for {symbol} ({pair}) under the {strategy} strategy.
Subscriber Identity: {user_identity}
x402 Payment Tx: {payment_tx}

Return ONLY a valid JSON object matching this exact schema:
{
  "verdict": "<Long|Short|Neutral|Skip>",
  "confidence": <int 0-100>,
  "supporting": ["<reason 1>", "<reason 2>"],
  "counterpoint": "<risk or counter-thesis>",
  "invalidation": "<condition that voids signal>",
  "source": "<data source description>"
}

Data & Price Action Context:
---
{market_data}
---
"""

CONFIDENCE_MARGIN = 10
ALLOWED_VERDICTS = {"Long", "Short", "Neutral", "Skip"}


class SignalOracle(gl.Contract):
    # ---- Persistent State ----
    symbol: str
    pair: str
    strategy: str
    user_identity: Address       # ERC-8004 Agent / User Identity
    payment_tx: str              # x402 Micropayment Tx Hash
    paid: bool
    evaluated: bool
    verdict: str
    confidence: u32
    supporting_json: str
    counterpoint: str
    invalidation: str
    source: str
    result_json: str
    evaluator: Address

    def __init__(self, symbol: str, pair: str, strategy: str, user_identity: str = ""):
        self.symbol = symbol
        self.pair = pair
        self.strategy = strategy
        self.user_identity = Address(user_identity) if user_identity else gl.message.sender_address
        self.payment_tx = ""
        self.paid = False
        self.evaluated = False
        self.verdict = ""
        self.confidence = u32(0)
        self.supporting_json = "[]"
        self.counterpoint = ""
        self.invalidation = ""
        self.source = ""
        self.result_json = "{}"
        self.evaluator = gl.message.sender_address

    @gl.public.write
    def evaluate_signal(self, market_data: str, payment_tx_hash: str = "") -> None:
        """Triggers AI-validator consensus execution after verifying x402 micropayment & ERC-8004 identity."""
        if payment_tx_hash:
            self.payment_tx = payment_tx_hash
            self.paid = True

        symbol = self.symbol
        pair = self.pair
        strategy = self.strategy
        user_identity = str(self.user_identity)
        payment_tx = self.payment_tx

        def leader_fn() -> dict:
            prompt = (
                SIGNAL_RUBRIC
                .replace("{symbol}", symbol)
                .replace("{pair}", pair)
                .replace("{strategy}", strategy)
                .replace("{user_identity}", user_identity)
                .replace("{payment_tx}", payment_tx)
                .replace("{market_data}", market_data)
            )
            response = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(response, str):
                return json.loads(response)
            return response

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                my_result = leader_fn()
                leader_result = leaders_res.calldata
                if isinstance(leader_result, str):
                    leader_result = json.loads(leader_result)
                return _signal_equivalent(my_result, leader_result)
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        if isinstance(result, str):
            result = json.loads(result)
        self._apply_result(result)

    @gl.public.view
    def get_signal(self) -> dict:
        """Returns the consensus trading signal report settled on-chain."""
        data = {}
        try:
            if self.result_json and self.result_json != "{}":
                data = json.loads(self.result_json)
        except Exception:
            pass

        data["symbol"] = self.symbol
        data["pair"] = self.pair
        data["strategy"] = self.strategy
        data["user_identity"] = str(self.user_identity)
        data["payment_tx"] = self.payment_tx
        data["paid"] = self.paid
        data["evaluated"] = self.evaluated
        data["verdict"] = self.verdict
        data["confidence"] = int(self.confidence)
        try:
            data["supporting"] = json.loads(self.supporting_json)
        except Exception:
            data["supporting"] = []
        data["counterpoint"] = self.counterpoint
        data["invalidation"] = self.invalidation
        data["source"] = self.source
        data["evaluator"] = str(self.evaluator)
        return data

    def _apply_result(self, result: dict) -> None:
        self.verdict = str(result.get("verdict", "Skip"))
        self.confidence = u32(int(result.get("confidence", 0)))
        self.supporting_json = json.dumps(result.get("supporting", []))
        self.counterpoint = str(result.get("counterpoint", ""))
        self.invalidation = str(result.get("invalidation", ""))
        self.source = str(result.get("source", "Binance"))
        self.result_json = json.dumps(result)
        self.evaluated = True


def _signal_equivalent(a: dict, b: dict) -> bool:
    """Custom Equivalence Principle: verdict match, confidence within ±10 margin, structural supporting items."""
    try:
        verdict_a = str(a.get("verdict", ""))
        verdict_b = str(b.get("verdict", ""))
        if verdict_a not in ALLOWED_VERDICTS or verdict_a != verdict_b:
            return False

        conf_a = int(a.get("confidence", -100))
        conf_b = int(b.get("confidence", -100))
        if abs(conf_a - conf_b) > CONFIDENCE_MARGIN:
            return False

        supp_a = a.get("supporting", [])
        supp_b = b.get("supporting", [])
        if len(supp_a) == 0 and len(supp_b) > 2:
            return False

        return True
    except Exception:
        return False
