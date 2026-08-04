"""
Contract-level Security Tests for SignalOracle
Covers all 3 requirements from Pavel Kolosov's reviewer feedback:
  1. Forged / missing payment → rejected with UserError
  2. Replay attack on payment_tx or request_id → rejected with UserError
  3. Request-ID mismatch / unknown ID → returns NOT_FOUND, never leaks other user's signal
"""
import json
import pytest
from genlayer import gl
from contracts.signal_oracle import SignalOracle, _signal_equivalent

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
SENDER_A = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
SENDER_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

MOCK_RESULT = {
    "verdict": "Long",
    "confidence": 70,
    "expert_summary": "RSI 64 with bullish EMA stack supports long bias.",
    "supporting": ["RSI(14) at 64.2 — bullish zone", "EMA9 > EMA20 > EMA50 — bullish stack"],
    "counterpoint": "Approaching resistance near $96k",
    "invalidation": "Close below EMA20 at $93,900",
    "trade": {"entry": 95420.5, "takeProfit": 99641.5, "stopLoss": 93210.5, "riskReward": 2.0},
    "source": "Binance OHLCV klines",
    "source_type": "GenLayer LLM Consensus"
}

MARKET_JSON = json.dumps({
    "asset": {"symbol": "BTC", "pair": "BTC/USDT", "timeframe": "4h",
              "strategy": "RSI/EMA", "current_price": 95420.5},
    "indicators": {"rsi_14": 64.2, "ema_trend": "Bullish stack", "rvol": 1.45},
    "meta": {"user_identity": SENDER_A, "payment_tx": "__PAYMENT__", "request_id": "__REQID__"}
})


def make_oracle(monkeypatch, sender=SENDER_A):
    """Create fresh SignalOracle with mocked GenLayer runtime."""
    monkeypatch.setattr("genlayer.gl.message.sender_address", sender)

    def mock_nondet(leader_fn, validator_fn):
        result = leader_fn()
        assert validator_fn(gl.vm.Return(result)) is True
        return result

    monkeypatch.setattr("genlayer.gl.vm.run_nondet_unsafe", mock_nondet)
    monkeypatch.setattr("genlayer.gl.nondet.exec_prompt",
                        lambda prompt, response_format="json": json.dumps(MOCK_RESULT))

    return SignalOracle("BTC", "BTC/USDT", "RSI/EMA", user_identity=sender)


def submit(oracle, payment_tx, request_id, market=None):
    """Helper: build JSON payload and call evaluate_signal."""
    payload = json.loads(MARKET_JSON)
    payload["meta"]["payment_tx"] = payment_tx
    payload["meta"]["request_id"] = request_id
    if market:
        payload["asset"].update(market)
    oracle.evaluate_signal(json.dumps(payload))


def get_sig(oracle, req_id=""):
    res = oracle.get_signal(req_id)
    if isinstance(res, str):
        return json.loads(res)
    return res


# ===========================================================================
# TEST GROUP 1 — Forged / Missing Payments
# ===========================================================================

class TestForgedPayments:
    def test_missing_payment_tx_is_rejected(self, monkeypatch):
        """Contract MUST reject if payment_tx_hash is empty string."""
        oracle = make_oracle(monkeypatch)
        payload = json.loads(MARKET_JSON)
        payload["meta"]["payment_tx"] = ""          # Forged: no payment
        payload["meta"]["request_id"] = "req_forge_1"
        with pytest.raises(gl.vm.UserError, match="Forged Payment Error"):
            oracle.evaluate_signal(json.dumps(payload))

    def test_whitespace_only_payment_tx_is_rejected(self, monkeypatch):
        """Whitespace-only payment string counts as missing/forged."""
        oracle = make_oracle(monkeypatch)
        payload = json.loads(MARKET_JSON)
        payload["meta"]["payment_tx"] = "   "       # Forged: whitespace
        payload["meta"]["request_id"] = "req_forge_2"
        with pytest.raises(gl.vm.UserError, match="Forged Payment Error"):
            oracle.evaluate_signal(json.dumps(payload))

    def test_valid_payment_tx_is_accepted(self, monkeypatch):
        """Happy path: real payment_tx must succeed."""
        oracle = make_oracle(monkeypatch)
        submit(oracle, payment_tx="0xABC123", request_id="req_valid_1")
        result = get_sig(oracle, "req_valid_1")
        assert result["evaluated"] is True
        assert result["verdict"] == "Long"
        assert result["payment_tx"] == "0xABC123"


# ===========================================================================
# TEST GROUP 2 — Replay Attacks
# ===========================================================================

class TestReplayAttack:
    def test_replay_payment_tx_is_rejected(self, monkeypatch):
        """Re-using the same payment_tx for a second request MUST be rejected."""
        oracle = make_oracle(monkeypatch)
        submit(oracle, payment_tx="0xPAY_ONCE", request_id="req_replay_1")

        # Second call — same payment, different request_id
        with pytest.raises(gl.vm.UserError, match="Replay Attack Detected"):
            submit(oracle, payment_tx="0xPAY_ONCE", request_id="req_replay_2")

    def test_replay_request_id_is_rejected(self, monkeypatch):
        """Re-submitting the same request_id (even with a new payment) MUST be rejected."""
        oracle = make_oracle(monkeypatch)
        submit(oracle, payment_tx="0xPAY_A", request_id="req_fixed_id")

        # Second call — same request_id, fresh payment
        with pytest.raises(gl.vm.UserError, match="Replay Attack Detected"):
            submit(oracle, payment_tx="0xPAY_B", request_id="req_fixed_id")

    def test_two_unique_requests_both_succeed(self, monkeypatch):
        """Two completely unique (payment_tx, request_id) pairs MUST both succeed."""
        oracle = make_oracle(monkeypatch)
        submit(oracle, payment_tx="0xPAY_X", request_id="req_x")
        submit(oracle, payment_tx="0xPAY_Y", request_id="req_y")

        res_x = get_sig(oracle, "req_x")
        res_y = get_sig(oracle, "req_y")
        assert res_x["evaluated"] is True
        assert res_y["evaluated"] is True
        assert res_x["request_id"] == "req_x"
        assert res_y["request_id"] == "req_y"


# ===========================================================================
# TEST GROUP 3 — Request-ID Mismatch / Isolation
# ===========================================================================

class TestRequestIdMismatch:
    def test_unknown_request_id_returns_not_found(self, monkeypatch):
        """Querying an unknown request_id MUST return NOT_FOUND status, never raise."""
        oracle = make_oracle(monkeypatch)
        result = get_sig(oracle, "nonexistent_req_id")
        # Must not return another user's data
        assert result.get("evaluated") is not True or result.get("request_id") == "nonexistent_req_id"
        # Must signal that this ID is not found or pending
        status = result.get("status", "")
        assert "NOT_FOUND" in status or "MISMATCH" in status or result.get("evaluated") is False

    def test_user_a_cannot_read_user_b_signal(self, monkeypatch):
        """Concurrent polling: User A's request_id must never return User B's signal data."""
        oracle = make_oracle(monkeypatch)

        # User A submits first
        submit(oracle, payment_tx="0xPAY_USER_A", request_id="req_user_a")

        # User B submits second (overwrites singleton state)
        monkeypatch.setattr("genlayer.gl.message.sender_address", SENDER_B)
        submit(oracle, payment_tx="0xPAY_USER_B", request_id="req_user_b")

        # Polling: User A reads their own request_id → must get THEIR own signal
        res_a = get_sig(oracle, "req_user_a")
        assert res_a["evaluated"] is True
        assert res_a["request_id"] == "req_user_a"

        # Polling: User B reads their own request_id → must get THEIR own signal
        res_b = get_sig(oracle, "req_user_b")
        assert res_b["evaluated"] is True
        assert res_b["request_id"] == "req_user_b"

        # Cross-check: neither user can read the other's entry as their own
        assert res_a["request_id"] != res_b["request_id"]

    def test_mismatched_request_id_format_returns_not_found(self, monkeypatch):
        """Querying with a differently-cased or slightly different request_id must not find the correct entry."""
        oracle = make_oracle(monkeypatch)
        submit(oracle, payment_tx="0xPAY_CASE", request_id="req_CaseSensitive")

        # Slightly wrong ID — must not return the real result
        result = get_sig(oracle, "req_casesensitive")  # lowercase mismatch
        # Should be not found or pending
        assert result.get("request_id") != "req_CaseSensitive" or result.get("evaluated") is False


# ===========================================================================
# TEST GROUP 4 — Equivalence Principle (existing, extended)
# ===========================================================================

class TestEquivalencePrinciple:
    def test_same_verdict_within_margin_passes(self):
        a = {"verdict": "Long", "confidence": 70, "supporting": ["RSI 64 bullish"]}
        b = {"verdict": "Long", "confidence": 80, "supporting": ["EMA stack bullish"]}   # diff=10 < margin=15
        assert _signal_equivalent(a, b) is True

    def test_different_verdict_fails(self):
        a = {"verdict": "Long", "confidence": 70, "supporting": ["RSI bullish"]}
        b = {"verdict": "Short", "confidence": 70, "supporting": ["RSI bearish"]}
        assert _signal_equivalent(a, b) is False

    def test_confidence_beyond_margin_fails(self):
        a = {"verdict": "Long", "confidence": 50, "supporting": ["RSI neutral"]}
        b = {"verdict": "Long", "confidence": 80, "supporting": ["EMA bullish"]}   # diff=30 > margin=15
        assert _signal_equivalent(a, b) is False

    def test_invalid_verdict_both_sides_fails(self):
        """Two invalid verdicts matching should NOT pass validation."""
        a = {"verdict": "HACK", "confidence": 70, "supporting": ["injected"]}
        b = {"verdict": "HACK", "confidence": 70, "supporting": ["injected"]}
        assert _signal_equivalent(a, b) is False
