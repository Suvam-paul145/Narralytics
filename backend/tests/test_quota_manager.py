from llm.quota_manager import QuotaManager


def test_new_api_key_resets_local_backoff(tmp_path):
    quota_file = tmp_path / "quota.json"
    manager = QuotaManager(quota_file=str(quota_file))

    manager.record_quota_exhausted(retry_delay_seconds=600, api_key="old-key")
    assert manager.is_quota_available("old-key") is False

    assert manager.is_quota_available("new-key") is True
    assert manager.quota_exhausted_until is None
    assert manager.daily_requests == 0


def test_quota_error_detection_matches_rate_limit_messages(tmp_path):
    manager = QuotaManager(quota_file=str(tmp_path / "quota.json"))

    assert manager.is_quota_error("429 Too Many Requests")
    assert manager.is_quota_error("rate limit exceeded")
    assert manager.is_quota_error("quota exhausted")
    assert manager.is_quota_error("Resource exhausted for this request")
    assert manager.is_quota_error("database connection lost") is False
