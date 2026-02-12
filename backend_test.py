import requests
import sys
import json
from datetime import datetime, timedelta

class OptionsTrackerAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.guest_token = None
        self.user_token = None
        self.guest_user_id = None
        self.registered_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_trades = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if not headers:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_guest_token(self):
        """Test guest token generation"""
        success, response = self.run_test(
            "Guest Token Generation",
            "GET",
            "auth/guest-token",
            200
        )
        if success and 'access_token' in response:
            self.guest_token = response['access_token']
            self.guest_user_id = f"guest_{datetime.now().timestamp()}"
            return True
        return False

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().timestamp()}@example.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={"email": test_email, "password": "TestPass123!"}
        )
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            self.registered_user_id = test_email
            return True
        return False

    def test_user_login(self):
        """Test user login with registered credentials"""
        if not self.registered_user_id:
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": self.registered_user_id, "password": "TestPass123!"}
        )
        return success and 'access_token' in response

    def test_create_put_trade(self):
        """Test creating a PUT option trade"""
        if not self.guest_token or not self.guest_user_id:
            return False

        trade_data = {
            "ticker": "AAPL",
            "strike_price": 150.00,
            "trade_type": "put",
            "expiry_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "premium": 2.50
        }

        success, response = self.run_test(
            "Create PUT Trade",
            "POST",
            f"trades?user_id={self.guest_user_id}",
            200,
            data=trade_data
        )
        
        if success and 'id' in response:
            self.created_trades.append(response['id'])
            return True
        return False

    def test_create_call_trade(self):
        """Test creating a CALL option trade"""
        if not self.guest_token or not self.guest_user_id:
            return False

        trade_data = {
            "ticker": "TSLA",
            "strike_price": 200.00,
            "trade_type": "call",
            "expiry_date": (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d"),
            "premium": 5.75
        }

        success, response = self.run_test(
            "Create CALL Trade",
            "POST",
            f"trades?user_id={self.guest_user_id}",
            200,
            data=trade_data
        )
        
        if success and 'id' in response:
            self.created_trades.append(response['id'])
            return True
        return False

    def test_get_trades(self):
        """Test retrieving user trades"""
        if not self.guest_user_id:
            return False

        success, response = self.run_test(
            "Get User Trades",
            "GET",
            f"trades?user_id={self.guest_user_id}",
            200
        )
        
        if success and 'trades' in response:
            trades = response['trades']
            print(f"   Found {len(trades)} trades")
            return len(trades) >= 2  # Should have PUT and CALL trades
        return False

    def test_stock_price_aapl(self):
        """Test stock price fetching for AAPL"""
        success, response = self.run_test(
            "Get AAPL Stock Price",
            "GET",
            "stock-price/AAPL",
            200
        )
        
        if success and 'price' in response and 'ticker' in response:
            price = response['price']
            ticker = response['ticker']
            print(f"   AAPL Price: ${price}")
            return ticker == "AAPL" and isinstance(price, (int, float)) and price > 0
        return False

    def test_stock_price_tsla(self):
        """Test stock price fetching for TSLA"""
        success, response = self.run_test(
            "Get TSLA Stock Price",
            "GET",
            "stock-price/TSLA",
            200
        )
        
        if success and 'price' in response and 'ticker' in response:
            price = response['price']
            ticker = response['ticker']
            print(f"   TSLA Price: ${price}")
            return ticker == "TSLA" and isinstance(price, (int, float)) and price > 0
        return False

    def test_push_subscription(self):
        """Test push notification subscription"""
        if not self.guest_user_id:
            return False

        subscription_data = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
            "keys": {
                "p256dh": "test-p256dh-key",
                "auth": "test-auth-key"
            }
        }

        success, response = self.run_test(
            "Push Notification Subscribe",
            "POST",
            f"push/subscribe?user_id={self.guest_user_id}",
            200,
            data=subscription_data
        )
        return success

    def test_push_unsubscribe(self):
        """Test push notification unsubscribe"""
        if not self.guest_user_id:
            return False

        success, response = self.run_test(
            "Push Notification Unsubscribe",
            "POST",
            f"push/unsubscribe?user_id={self.guest_user_id}",
            200
        )
        return success

    def test_delete_trade(self):
        """Test deleting a trade"""
        if not self.created_trades or not self.guest_user_id:
            return False

        trade_id = self.created_trades[0]
        success, response = self.run_test(
            "Delete Trade",
            "DELETE",
            f"trades/{trade_id}?user_id={self.guest_user_id}",
            200
        )
        return success

    def test_invalid_stock_ticker(self):
        """Test handling of invalid stock ticker"""
        success, response = self.run_test(
            "Invalid Stock Ticker",
            "GET",
            "stock-price/INVALIDTICKER123",
            404
        )
        return success

def main():
    print("🚀 Starting Options Tracker API Tests")
    print("=" * 50)
    
    tester = OptionsTrackerAPITester()
    
    # Test sequence
    test_results = []
    
    # Authentication tests
    test_results.append(("Guest Token", tester.test_guest_token()))
    test_results.append(("User Registration", tester.test_user_registration()))
    test_results.append(("User Login", tester.test_user_login()))
    
    # Trade management tests
    test_results.append(("Create PUT Trade", tester.test_create_put_trade()))
    test_results.append(("Create CALL Trade", tester.test_create_call_trade()))
    test_results.append(("Get Trades", tester.test_get_trades()))
    
    # Stock price tests
    test_results.append(("AAPL Stock Price", tester.test_stock_price_aapl()))
    test_results.append(("TSLA Stock Price", tester.test_stock_price_tsla()))
    test_results.append(("Invalid Ticker", tester.test_invalid_stock_ticker()))
    
    # Push notification tests
    test_results.append(("Push Subscribe", tester.test_push_subscription()))
    test_results.append(("Push Unsubscribe", tester.test_push_unsubscribe()))
    
    # Cleanup tests
    test_results.append(("Delete Trade", tester.test_delete_trade()))
    
    # Print results summary
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<25} {status}")
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed - check logs above")
        return 1

if __name__ == "__main__":
    sys.exit(main())