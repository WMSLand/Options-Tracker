import React, { useState, useEffect } from 'react';
import '@/App.css';
import Dashboard from '@/components/Dashboard';
import Auth from '@/components/Auth';
import { Toaster } from '@/components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (!token) {
      fetch(`${API}/auth/guest-token`)
        .then(res => res.json())
        .then(data => {
          setToken(data.access_token);
          const guestId = `guest_${Date.now()}`;
          setUserId(guestId);
          setIsGuest(true);
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('userId', guestId);
        })
        .catch(err => console.error('Error getting guest token:', err));
    }
  }, [token]);

  const handleLogin = (newToken, newUserId) => {
    setToken(newToken);
    setUserId(newUserId);
    setIsGuest(false);
    localStorage.setItem('token', newToken);
    localStorage.setItem('userId', newUserId);
  };

  const handleLogout = () => {
    setToken(null);
    setUserId(null);
    setIsGuest(false);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  };

  return (
    <div className="App dark">
      {token && userId ? (
        <Dashboard 
          userId={userId} 
          isGuest={isGuest} 
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      ) : (
        <Auth onLogin={handleLogin} />
      )}
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
