import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Plus, Trash2, Bell, BellOff, LogOut, User, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ userId, isGuest, onLogin, onLogout }) => {
  const [trades, setTrades] = useState([]);
  const [stockPrices, setStockPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  
  const [formData, setFormData] = useState({
    ticker: '',
    strike_price: '',
    trade_type: 'put',
    expiry_date: '',
    premium: ''
  });

  useEffect(() => {
    if (userId) {
      fetchTrades();
      checkPushSubscription();
    }
  }, [userId]);

  useEffect(() => {
    if (trades.length > 0) {
      const interval = setInterval(() => {
        fetchStockPrices();
      }, 15000);
      fetchStockPrices();
      return () => clearInterval(interval);
    }
  }, [trades]);

  const checkPushSubscription = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsPushEnabled(!!subscription);
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await axios.get(`${API}/trades?user_id=${userId}`);
      setTrades(response.data.trades);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast.error('Failed to load trades');
      setLoading(false);
    }
  };

  const fetchStockPrices = async () => {
    const uniqueTickers = [...new Set(trades.map(t => t.ticker))];
    const prices = {};
    
    for (const ticker of uniqueTickers) {
      try {
        const response = await axios.get(`${API}/stock-price/${ticker}`);
        prices[ticker] = response.data.price;
      } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error);
      }
    }
    
    setStockPrices(prices);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.ticker || !formData.strike_price || !formData.expiry_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/trades?user_id=${userId}`, formData);
      toast.success(`${formData.ticker} ${formData.trade_type} added`);
      setFormData({
        ticker: '',
        strike_price: '',
        trade_type: 'put',
        expiry_date: '',
        premium: ''
      });
      setDialogOpen(false);
      fetchTrades();
    } catch (error) {
      console.error('Error creating trade:', error);
      toast.error('Failed to create trade');
    }
  };

  const handleDelete = async (tradeId) => {
    try {
      await axios.delete(`${API}/trades/${tradeId}?user_id=${userId}`);
      toast.success('Trade deleted');
      fetchTrades();
    } catch (error) {
      console.error('Error deleting trade:', error);
      toast.error('Failed to delete trade');
    }
  };

  const togglePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications not supported in this browser');
      return;
    }

    try {
      if (isPushEnabled) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await axios.post(`${API}/push/unsubscribe?user_id=${userId}`);
          setIsPushEnabled(false);
          toast.success('Push notifications disabled');
        }
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Permission denied for notifications');
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib8DEK8rYQ9xzY9Zvu5UoF1-p4qJ_ej-VwI09f0Vld1DBDP0nwUX0mFxXdw';
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        await axios.post(`${API}/push/subscribe?user_id=${userId}`, {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth'))
          }
        });

        setIsPushEnabled(true);
        toast.success('Push notifications enabled');
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      toast.error('Failed to update notification settings');
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const calculateAlertStatus = (trade, currentPrice) => {
    if (!currentPrice) return { level: 'none', message: 'Price unavailable', color: 'bg-zinc-700' };
    
    const strike = trade.strike_price;
    const pctDiff = ((strike - currentPrice) / strike) * 100;
    
    if (trade.trade_type === 'put') {
      if (pctDiff >= 20) return { level: 'critical', message: '20%+ below', color: 'bg-red-500' };
      if (pctDiff >= 15) return { level: 'high', message: '15%+ below', color: 'bg-orange-500' };
      if (pctDiff >= 10) return { level: 'medium', message: '10%+ below', color: 'bg-yellow-500' };
      if (pctDiff >= 5) return { level: 'low', message: '5%+ below', color: 'bg-blue-500' };
      return { level: 'safe', message: 'Safe', color: 'bg-green-500/20' };
    } else {
      if (pctDiff <= 1 && pctDiff >= 0) return { level: 'critical', message: 'Within 1%', color: 'bg-red-500' };
      if (pctDiff <= 2 && pctDiff >= 0) return { level: 'high', message: 'Within 2%', color: 'bg-orange-500' };
      return { level: 'safe', message: 'Safe', color: 'bg-green-500/20' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              Options Tracker
            </h1>
            <p className="text-zinc-400 mt-2">Monitor your cash-secured puts and covered calls</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isGuest && (
              <Button
                variant="outline"
                onClick={() => setShowAuth(true)}
                className="border-zinc-700 hover:bg-zinc-800"
                data-testid="login-button"
              >
                <User className="h-4 w-4 mr-2" />
                Login
              </Button>
            )}
            
            {!isGuest && (
              <Button
                variant="ghost"
                onClick={onLogout}
                className="text-zinc-400 hover:text-white"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant={isPushEnabled ? "default" : "outline"}
              onClick={togglePushNotifications}
              className={isPushEnabled ? "bg-white text-black hover:bg-zinc-200" : "border-zinc-700 hover:bg-zinc-800"}
              data-testid="notifications-toggle"
            >
              {isPushEnabled ? (
                <><Bell className="h-4 w-4 mr-2" /> Alerts On</>
              ) : (
                <><BellOff className="h-4 w-4 mr-2" /> Alerts Off</>
              )}
            </Button>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-zinc-200" data-testid="add-trade-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Trade
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#18181B] border-zinc-800 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">Add New Trade</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter the details of your option position
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="ticker" className="text-zinc-300">Stock Symbol</Label>
                    <Input
                      id="ticker"
                      value={formData.ticker}
                      onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})}
                      placeholder="AAPL"
                      className="bg-zinc-950 border-zinc-800 text-white"
                      data-testid="ticker-input"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="strike" className="text-zinc-300">Strike Price</Label>
                      <Input
                        id="strike"
                        type="number"
                        step="0.01"
                        value={formData.strike_price}
                        onChange={(e) => setFormData({...formData, strike_price: e.target.value})}
                        placeholder="150.00"
                        className="bg-zinc-950 border-zinc-800 text-white"
                        data-testid="strike-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="type" className="text-zinc-300">Type</Label>
                      <Select 
                        value={formData.trade_type} 
                        onValueChange={(value) => setFormData({...formData, trade_type: value})}
                      >
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          <SelectItem value="put">Put Option</SelectItem>
                          <SelectItem value="call">Covered Call</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry" className="text-zinc-300">Expiry Date</Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={formData.expiry_date}
                        onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                        className="bg-zinc-950 border-zinc-800 text-white"
                        data-testid="expiry-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="premium" className="text-zinc-300">Premium (Optional)</Label>
                      <Input
                        id="premium"
                        type="number"
                        step="0.01"
                        value={formData.premium}
                        onChange={(e) => setFormData({...formData, premium: e.target.value})}
                        placeholder="2.50"
                        className="bg-zinc-950 border-zinc-800 text-white"
                        data-testid="premium-input"
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200" data-testid="submit-trade-button">
                    Add Trade
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-[#18181B] border-zinc-800" data-testid="trades-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-white">Active Positions</CardTitle>
                <CardDescription className="text-zinc-400">{trades.length} open positions</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchStockPrices}
                className="text-zinc-400 hover:text-white"
                data-testid="refresh-button"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p>No trades yet. Add your first position above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {trades.map((trade) => {
                  const currentPrice = stockPrices[trade.ticker];
                  const alertStatus = calculateAlertStatus(trade, currentPrice);
                  
                  return (
                    <div
                      key={trade.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors"
                      data-testid={`trade-${trade.ticker}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-white tabular-nums" data-testid={`ticker-${trade.ticker}`}>
                              {trade.ticker}
                            </h3>
                            <Badge 
                              variant="outline" 
                              className={`${trade.trade_type === 'put' ? 'border-red-500/50 text-red-400' : 'border-green-500/50 text-green-400'} font-mono text-xs uppercase`}
                              data-testid={`type-badge-${trade.ticker}`}
                            >
                              {trade.trade_type === 'put' ? (
                                <><TrendingDown className="h-3 w-3 mr-1" /> PUT</>
                              ) : (
                                <><TrendingUp className="h-3 w-3 mr-1" /> CALL</>
                              )}
                            </Badge>
                            
                            <Badge className={`${alertStatus.color} text-white font-mono text-xs`} data-testid={`alert-badge-${trade.ticker}`}>
                              {alertStatus.message}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Strike</p>
                              <p className="text-lg font-medium text-white tabular-nums" data-testid={`strike-${trade.ticker}`}>
                                ${trade.strike_price.toFixed(2)}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current</p>
                              <p className="text-lg font-medium text-white tabular-nums" data-testid={`price-${trade.ticker}`}>
                                {currentPrice ? `$${currentPrice.toFixed(2)}` : 'Loading...'}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Expiry</p>
                              <p className="text-sm font-medium text-zinc-300 tabular-nums" data-testid={`expiry-${trade.ticker}`}>
                                {trade.expiry_date}
                              </p>
                            </div>
                            
                            {trade.premium && (
                              <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Premium</p>
                                <p className="text-sm font-medium text-zinc-300 tabular-nums" data-testid={`premium-${trade.ticker}`}>
                                  ${trade.premium.toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(trade.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          data-testid={`delete-${trade.ticker}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {showAuth && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAuth(false)}>
            <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-white mb-4">Create Account</h2>
              <p className="text-zinc-400 mb-6">Sign up to save your trades across devices and enable push notifications.</p>
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  id="auth-email"
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  id="auth-password"
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
                <Button
                  className="w-full bg-white text-black hover:bg-zinc-200"
                  onClick={async () => {
                    const email = document.getElementById('auth-email').value;
                    const password = document.getElementById('auth-password').value;
                    
                    if (!email || !password) {
                      toast.error('Please fill in all fields');
                      return;
                    }
                    
                    try {
                      const response = await axios.post(`${API}/auth/register`, { email, password });
                      onLogin(response.data.access_token, email);
                      setShowAuth(false);
                      toast.success('Account created successfully');
                    } catch (error) {
                      toast.error('Failed to create account');
                    }
                  }}
                >
                  Create Account
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
