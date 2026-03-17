#!/usr/bin/env python3
"""Audit the deployed Narralytics AWS stack."""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib import error, request

import boto3
from botocore.exceptions import BotoCoreError, ClientError


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    critical: bool = True


def emit(result: CheckResult) -> None:
    status = "OK" if result.ok else "FAIL"
    print(f"[{status}] {result.name}: {result.detail}")


def format_error(exc: Exception) -> str:
    return f"{exc.__class__.__name__}: {exc}"


def fetch_url(url: str) -> tuple[int, str]:
    try:
        with request.urlopen(url, timeout=10) as response:
            return response.status, response.read().decode("utf-8")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, body


def choose_api_base_url(api: dict[str, Any], stages: list[dict[str, Any]]) -> str:
    endpoint = api["ApiEndpoint"].rstrip("/")
    if not stages:
        return endpoint

    for stage in stages:
        if stage.get("StageName") == "$default":
            return endpoint

    return f"{endpoint}/{stages[0]['StageName']}"


def audit_identity(session: boto3.Session) -> CheckResult:
    try:
        identity = session.client("sts").get_caller_identity()
        return CheckResult(
            "AWS identity",
            True,
            f"{identity['Arn']} (account {identity['Account']})",
            critical=False,
        )
    except (ClientError, BotoCoreError) as exc:
        return CheckResult("AWS identity", False, format_error(exc))


def audit_api(api_client: Any, api_name: str) -> tuple[list[CheckResult], dict[str, Any] | None]:
    results: list[CheckResult] = []

    try:
        apis = api_client.get_apis().get("Items", [])
        api = next((item for item in apis if item.get("Name") == api_name), None)
        if api is None:
            return [CheckResult("API Gateway", False, f"API '{api_name}' not found")], None

        api_id = api["ApiId"]
        routes = api_client.get_routes(ApiId=api_id).get("Items", [])
        stages = api_client.get_stages(ApiId=api_id).get("Items", [])
        integrations = api_client.get_integrations(ApiId=api_id).get("Items", [])

        results.append(CheckResult("API Gateway", True, f"{api_id} -> {api['ApiEndpoint']}", critical=False))
        results.append(CheckResult("API integrations", bool(integrations), f"{len(integrations)} integration(s)"))
        results.append(CheckResult("API routes", bool(routes), f"{len(routes)} route(s)"))
        results.append(CheckResult("API stages", bool(stages), f"{len(stages)} stage(s)"))

        base_url = choose_api_base_url(api, stages)
        for path in ("/health", "/api/health"):
            status, body = fetch_url(f"{base_url}{path}")
            detail = f"status={status}"
            if body:
                detail = f"{detail}, body={body[:200]}"
            results.append(CheckResult(f"HTTP GET {path}", status == 200, detail))
    except (ClientError, BotoCoreError) as exc:
        results.append(CheckResult("API Gateway", False, format_error(exc)))
        return results, None

    return results, api


def audit_lambda(lambda_client: Any, function_name: str, api_host: str) -> list[CheckResult]:
    results: list[CheckResult] = []

    try:
        config = lambda_client.get_function_configuration(FunctionName=function_name)
        env_vars = config.get("Environment", {}).get("Variables", {})
        results.append(
            CheckResult(
                "Lambda configuration",
                config.get("State") == "Active" and config.get("LastUpdateStatus") == "Successful",
                (
                    f"state={config.get('State')}, update={config.get('LastUpdateStatus')}, "
                    f"runtime={config.get('Runtime')}, handler={config.get('Handler')}"
                ),
            )
        )
        results.append(
            CheckResult(
                "Lambda environment",
                bool(env_vars),
                f"{len(env_vars)} environment variables configured",
                critical=False,
            )
        )
    except (ClientError, BotoCoreError) as exc:
        return [CheckResult("Lambda configuration", False, format_error(exc))]

    event = {
        "version": "2.0",
        "routeKey": "GET /health",
        "rawPath": "/health",
        "rawQueryString": "",
        "headers": {"host": api_host},
        "requestContext": {
            "http": {
                "method": "GET",
                "path": "/health",
                "sourceIp": "127.0.0.1",
                "userAgent": "deployment-audit",
            },
            "stage": "$default",
            "timeEpoch": 0,
        },
        "isBase64Encoded": False,
    }

    try:
        response = lambda_client.invoke(
            FunctionName=function_name,
            Payload=json.dumps(event).encode("utf-8"),
        )
        payload_text = response["Payload"].read().decode("utf-8", errors="replace")
        payload = json.loads(payload_text) if payload_text else {}
        function_error = response.get("FunctionError")
        status_code = payload.get("statusCode") if isinstance(payload, dict) else None
        ok = not function_error and status_code == 200
        detail = f"status_code={status_code}, function_error={function_error}"
        if not ok:
            detail = f"{detail}, payload={payload_text[:200]}"
        results.append(CheckResult("Lambda invoke /health", ok, detail))
    except (ClientError, BotoCoreError, json.JSONDecodeError) as exc:
        results.append(CheckResult("Lambda invoke /health", False, format_error(exc)))

    return results


def audit_s3(s3_client: Any, bucket_name: str) -> list[CheckResult]:
    results: list[CheckResult] = []

    try:
        s3_client.head_bucket(Bucket=bucket_name)
        versioning = s3_client.get_bucket_versioning(Bucket=bucket_name)
        versioning_state = versioning.get("Status", "Disabled")
        results.append(CheckResult("S3 bucket", True, f"{bucket_name} reachable", critical=False))
        results.append(CheckResult("S3 versioning", versioning_state == "Enabled", f"versioning={versioning_state}"))

        object_key = f"audit/healthcheck-{uuid.uuid4().hex}.txt"
        s3_client.put_object(Bucket=bucket_name, Key=object_key, Body=b"narralytics-audit")
        s3_client.delete_object(Bucket=bucket_name, Key=object_key)
        results.append(CheckResult("S3 read/write", True, f"put/delete succeeded for {object_key}"))
    except (ClientError, BotoCoreError) as exc:
        results.append(CheckResult("S3 bucket", False, format_error(exc)))

    return results


def audit_dynamodb(dynamodb_client: Any, table_name: str) -> list[CheckResult]:
    results: list[CheckResult] = []

    try:
        table = dynamodb_client.describe_table(TableName=table_name)["Table"]
        status = table["TableStatus"]
        results.append(CheckResult("DynamoDB table", status == "ACTIVE", f"{table_name} status={status}"))

        temp_item = {
            "user_id": {"S": "__audit__"},
            "timestamp": {"S": datetime.now(UTC).isoformat()},
            "message": {"S": "narralytics deployment audit"},
        }
        dynamodb_client.put_item(TableName=table_name, Item=temp_item)
        dynamodb_client.delete_item(
            TableName=table_name,
            Key={
                "user_id": {"S": temp_item["user_id"]["S"]},
                "timestamp": {"S": temp_item["timestamp"]["S"]},
            },
        )
        results.append(CheckResult("DynamoDB read/write", True, "put/delete succeeded"))
    except (ClientError, BotoCoreError) as exc:
        results.append(CheckResult("DynamoDB table", False, format_error(exc)))

    return results


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit the deployed Narralytics AWS stack.")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--project-name", default="narralytics")
    parser.add_argument("--environment", default="prod")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    session = boto3.Session(region_name=args.region)

    api_name = f"{args.project_name}-api"
    function_name = f"{args.project_name}-backend"
    bucket_name = f"{args.project_name}-uploads-{args.environment}"
    table_name = f"{args.project_name}_history"

    print("Narralytics AWS deployment audit")
    print(f"Region: {args.region}")
    print(f"Project: {args.project_name}")
    print(f"Environment: {args.environment}")
    print()

    all_results: list[CheckResult] = [audit_identity(session)]

    api_results, api = audit_api(session.client("apigatewayv2"), api_name)
    all_results.extend(api_results)

    api_host = "localhost"
    if api is not None:
        api_host = api["ApiEndpoint"].replace("https://", "").rstrip("/")

    all_results.extend(audit_lambda(session.client("lambda"), function_name, api_host))
    all_results.extend(audit_s3(session.client("s3"), bucket_name))
    all_results.extend(audit_dynamodb(session.client("dynamodb"), table_name))

    for result in all_results:
        emit(result)

    critical_failures = [result for result in all_results if result.critical and not result.ok]
    warnings = [result for result in all_results if not result.critical and not result.ok]

    print()
    print(
        f"Summary: {len(all_results) - len(critical_failures) - len(warnings)} passing, "
        f"{len(warnings)} warning, {len(critical_failures)} failing critical check(s)"
    )

    return 1 if critical_failures else 0


if __name__ == "__main__":
    sys.exit(main())
