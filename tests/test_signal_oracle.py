import pytest
from genlayer import gl
from contracts.signal_oracle import SignalOracle, _signal_equivalent


def test_signal_equivalence_matching():
    a = {
        "verdict": "Long",
        "confidence": 75,
        "supporting": ["EMA golden cross", "RSI 58"],
        "counterpoint": "Slight overbought risk",
        "invalidation": "Drop below EMA 50"
    }
    b = {
        "verdict": "Long",
        "confidence": 82, # within margin 10
        "supporting": ["Bullish EMA trend", "Healthy volume"],
        "counterpoint": "Near resistance",
        "invalidation": "Drop below EMA 50"
    }
    assert _signal_equivalent(a, b) is True


def test_signal_oracle_execution(monkeypatch):
    mock_address = "0x1234567890123456789012345678901234567890"
    monkeypatch.setattr("genlayer.gl.message.sender_address", mock_address)

    mock_result = {
        "verdict": "Long",
        "confidence": 78,
        "supporting": ["EMA 50 > EMA 200", "RSI at 55"],
        "counterpoint": "Approaching resistance",
        "invalidation": "Candle close below $64,000",
        "source": "Binance BTC/USDT 4h"
    }

    def mock_run_nondet_unsafe(leader_fn, validator_fn):
        res = leader_fn()
        leader_res = gl.vm.Return(res)
        assert validator_fn(leader_res) is True
        return res

    monkeypatch.setattr("genlayer.gl.vm.run_nondet_unsafe", mock_run_nondet_unsafe)
    monkeypatch.setattr("genlayer.gl.nondet.exec_prompt", lambda prompt, response_format: mock_result)

    oracle = SignalOracle("BTC", "BTC/USDT", "RSI/EMA Trend", user_identity=mock_address)
    assert oracle.evaluated is False
    assert oracle.user_identity == mock_address

    oracle.evaluate_signal("BTC/USDT 4h price $65,200, RSI 55, EMA50 > EMA200", payment_tx_hash="0x9999")

    res = oracle.get_signal()
    assert res["evaluated"] is True
    assert res["verdict"] == "Long"
    assert res["confidence"] == 78
    assert res["payment_tx"] == "0x9999"
    assert res["paid"] is True
