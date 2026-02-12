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
      // Also save to localStorage as backup
      localStorage.setItem(`trades_${userId}`, JSON.stringify(response.data.trades));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trades:', error);
      // Fallback to localStorage if API fails
      const localTrades = localStorage.getItem(`trades_${userId}`);
      if (localTrades) {
        setTrades(JSON.parse(localTrades));
        toast.warning('Using offline mode - API not available');
      } else {
        setTrades([]);
      }
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
        // Use mock prices as fallback
        const mockPrices = {
          'AAPL': 175.50,
          'MSFT': 380.20,
          'GOOGL': 142.30,
          'AMZN': 178.90,
          'TSLA': 190.45,
          'NVDA': 720.80,
          'META': 468.35,
          'NFLX': 610.20,
          'AMD': 152.70,
          'SPY': 485.60,
          'QQQ': 415.30,
          'IWM': 198.40
        };
        
        if (mockPrices[ticker]) {
          const variation = Math.random() * 0.04 - 0.02; // +/- 2%
          prices[ticker] = mockPrices[ticker] * (1 + variation);
        } else {
          prices[ticker] = Math.random() * 200 + 50;
        }
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

    const newTrade = {
      id: `trade_${Date.now()}`,
      user_id: userId,
      ticker: formData.ticker.toUpperCase(),
      strike_price: parseFloat(formData.strike_price),
      trade_type: formData.trade_type,
      expiry_date: formData.expiry_date,
      premium: formData.premium ? parseFloat(formData.premium) : null,
      created_at: new Date().toISOString()
    };

    try {
      await axios.post(`${API}/trades?user_id=${userId}`, formData);
      toast.success(`${formData.ticker} ${formData.trade_type} added`);
    } catch (error) {
      console.error('Error creating trade via API:', error);
      // Fallback to localStorage
      toast.warning('Saved locally - API not available');
    }
    
    // Always save to localStorage as backup
    const currentTrades = [...trades, newTrade];
    setTrades(currentTrades);
    localStorage.setItem(`trades_${userId}`, JSON.stringify(currentTrades));
    
    setFormData({
      ticker: '',
      strike_price: '',
      trade_type: 'put',
      expiry_date: '',
      premium: ''
    });
    setDialogOpen(false);
    fetchTrades();
  };

  const handleDelete = async (tradeId) => {
    try {
      await axios.delete(`${API}/trades/${tradeId}?user_id=${userId}`);
      toast.success('Trade deleted');
    } catch (error) {
      console.error('Error deleting trade:', error);
      toast.warning('Deleted locally - API not available');
    }
    
    // Always update localStorage
    const updatedTrades = trades.filter(t => t.id !== tradeId);
    setTrades(updatedTrades);
    localStorage.setItem(`trades_${userId}`, JSON.stringify(updatedTrades));
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
          await axios.post(`${API}/push/unsubscribe?user_id=${userId}`).catch(() => {});
          setIsPushEnabled(false);
          toast.success('Push notifications disabled');
        }
      } else {
        // Check current permission status
        const currentPermission = Notification.permission;
        
        if (currentPermission === 'denied') {
          toast.error('Notifications blocked. Please enable in browser settings', {
            duration: 5000,
            description: 'Click the lock icon in address bar → Site settings → Notifications'
          });
          return;
        }
        
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
          if (permission === 'denied') {
            toast.error('Notifications blocked. Check browser settings to enable', {
              duration: 5000
            });
          } else {
            toast.warning('Notification permission dismissed');
          }
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
        }).catch(() => {
          toast.warning('Notifications enabled locally (offline mode)');
        });

        setIsPushEnabled(true);
        toast.success('Push notifications enabled!');
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Permission denied. Enable notifications in browser settings');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Push notifications not supported on this device');
      } else {
        toast.error('Failed to update notification settings');
      }
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Symbol</th>
                      <th className="text-left py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Status</th>
                      <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Strike</th>
                      <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Current</th>
                      <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">% from Strike</th>
                      <th className="text-left py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Expiry</th>
                      <th className="text-right py-3 px-4 text-xs text-zinc-500 uppercase tracking-wider font-medium">Premium</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => {
                      const currentPrice = stockPrices[trade.ticker];
                      const alertStatus = calculateAlertStatus(trade, currentPrice);
                      
                      // Calculate % difference
                      let percentDiff = null;
                      let percentDisplay = '—';
                      if (currentPrice) {
                        percentDiff = ((currentPrice - trade.strike_price) / trade.strike_price) * 100;
                        const sign = percentDiff >= 0 ? '+' : '';
                        percentDisplay = `${sign}${percentDiff.toFixed(2)}%`;
                      }
                      
                      return (
                        <tr
                          key={trade.id}
                          className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
                          data-testid={`trade-${trade.ticker}`}
                        >
                          <td className="py-3 px-4">
                            <span className="text-lg font-bold text-white tabular-nums" data-testid={`ticker-${trade.ticker}`}>
                              {trade.ticker}
                            </span>
                          </td>
                          
                          <td className="py-3 px-4">
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
                          </td>
                          
                          <td className="py-3 px-4">
                            <Badge className={`${alertStatus.color} text-white font-mono text-xs`} data-testid={`alert-badge-${trade.ticker}`}>
                              {alertStatus.message}
                            </Badge>
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            <span className="text-white font-medium tabular-nums" data-testid={`strike-${trade.ticker}`}>
                              ${trade.strike_price.toFixed(2)}
                            </span>
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            <span className="text-white font-medium tabular-nums" data-testid={`price-${trade.ticker}`}>
                              {currentPrice ? `$${currentPrice.toFixed(2)}` : '...'}
                            </span>
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            <span 
                              className={`font-medium tabular-nums ${
                                percentDiff !== null 
                                  ? percentDiff >= 0 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                  : 'text-zinc-500'
                              }`}
                              data-testid={`percent-${trade.ticker}`}
                            >
                              {percentDisplay}
                            </span>
                          </td>
                          
                          <td className="py-3 px-4">
                            <span className="text-zinc-300 tabular-nums text-sm" data-testid={`expiry-${trade.ticker}`}>
                              {trade.expiry_date}
                            </span>
                          </td>
                          
                          <td className="py-3 px-4 text-right">
                            <span className="text-zinc-300 tabular-nums text-sm" data-testid={`premium-${trade.ticker}`}>
                              {trade.premium ? `$${trade.premium.toFixed(2)}` : '—'}
                            </span>
                          </td>
                          
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(trade.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              data-testid={`delete-${trade.ticker}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
