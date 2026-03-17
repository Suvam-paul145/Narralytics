"""
Test file for the durable data processing workflow
Demonstrates how to test durable functions locally
"""

# Note: Install with: pip install aws-durable-execution-sdk-python-testing
from aws_durable_execution_sdk_python_testing import DurableFunctionTestRunner
from data_processing_workflow import data_processing_handler
import json

def test_successful_workflow():
    """Test a complete successful workflow"""
    
    # Create test input
    test_event = {
        "dataset_id": "test_dataset_001",
        "row_count": 5000,  # Small dataset, no review required
        "columns": ["sales", "region", "date"],
        "data_source": "s3://test-bucket/test_data.csv",
        "notify_users": ["test@example.com"]
    }
    
    # Run the durable function test
    with DurableFunctionTestRunner(data_processing_handler) as runner:
        result = runner.run(input=test_event)
        
        # Verify the result
        assert result["status"] == "completed"
        assert result["dataset_id"] == "test_dataset_001"
        assert "analysis_summary" in result
        assert result["notifications_sent"] == 1
        
        # Verify all expected operations were executed
        operations = runner.get_operations()
        
        # Check that all steps were executed with correct names
        step_names = [op.name for op in operations if op.type == "step"]
        expected_steps = [
            "validate_data",
            "run_analysis", 
            "generate_insights",
            "send_notifications"
        ]
        
        for step_name in expected_steps:
            assert step_name in step_names, f"Missing step: {step_name}"
        
        print("✅ Successful workflow test passed!")
        print(f"Result: {json.dumps(result, indent=2)}")


def test_workflow_with_review():
    """Test workflow that requires human review"""
    
    test_event = {
        "dataset_id": "large_dataset_001", 
        "row_count": 15000,  # Large dataset, requires review
        "columns": ["sales", "region", "date", "product"],
        "data_source": "s3://test-bucket/large_data.csv",
        "notify_users": ["analyst@example.com", "manager@example.com"]
    }
    
    with DurableFunctionTestRunner(data_processing_handler) as runner:
        # First run - will wait for human review
        result = runner.run(input=test_event)
        
        operations = runner.get_operations()
        
        # Should have a wait operation for human review
        wait_ops = [op for op in operations if op.type == "wait"]
        assert len(wait_ops) == 1
        assert wait_ops[0].name == "await_human_review"
        
        # Simulate human review callback (in real scenario, external system would call this)
        # For testing, we can simulate the callback result
        
        print("✅ Workflow with review test setup completed!")
        print(f"Operations executed: {[op.name for op in operations]}")


def test_invalid_data():
    """Test workflow with invalid input data"""
    
    test_event = {
        # Missing required dataset_id
        "row_count": 1000,
        "notify_users": ["test@example.com"]
    }
    
    with DurableFunctionTestRunner(data_processing_handler) as runner:
        result = runner.run(input=test_event)
        
        # Should fail at validation step
        assert result["status"] == "failed"
        assert result["reason"] == "invalid_data"
        
        operations = runner.get_operations()
        step_names = [op.name for op in operations if op.type == "step"]
        
        # Should only have validation step
        assert "validate_data" in step_names
        assert "run_analysis" not in step_names  # Should not reach this step
        
        print("✅ Invalid data test passed!")


if __name__ == "__main__":
    print("Running durable function tests...")
    print("Note: These tests require the AWS durable execution SDK to be installed")
    print()
    
    try:
        test_successful_workflow()
        print()
        test_workflow_with_review() 
        print()
        test_invalid_data()
        print()
        print("🎉 All tests completed!")
        
    except ImportError as e:
        print(f"❌ SDK not installed: {e}")
        print("Install with: pip install aws-durable-execution-sdk-python aws-durable-execution-sdk-python-testing")
    except Exception as e:
        print(f"❌ Test failed: {e}")