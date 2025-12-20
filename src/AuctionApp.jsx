import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gavel, DollarSign, Download, Upload, Trophy, Play, Square, SkipForward, RefreshCw, Settings, LogOut, User } from 'lucide-react';

// Utility function for generating unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Initial bidder data
const INITIAL_BIDDERS = [
  { name: 'Laurie', balance: 500, password: '', itemsWon: [] },
  { name: 'Miguel', balance: 500, password: '', itemsWon: [] },
  { name: 'Seth', balance: 500, password: '', itemsWon: [] },
  { name: 'Richard', balance: 500, password: '', itemsWon: [] },
  { name: 'Benjamin', balance: 500, password: '', itemsWon: [] },
  { name: 'Erik', balance: 500, password: '', itemsWon: [] },
  { name: 'Gregory', balance: 500, password: '', itemsWon: [] }
];

const AuctionApp = () => {
  // Core state
  const [setupComplete, setSetupComplete] = useState(false);
  const [auctioneerPassword, setAuctioneerPassword] = useState('');
  const [bidders, setBidders] = useState(INITIAL_BIDDERS);
  const [items, setItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuctioneer, setIsAuctioneer] = useState(false);
  
  // Auction state
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  const [currentBids, setCurrentBids] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const [itemActive, setItemActive] = useState(false);
  const [lastBidTime, setLastBidTime] = useState(null);
  
  // UI state
  const [customBidAmount, setCustomBidAmount] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  
  // Login state
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Refs
  const timerRef = useRef(null);
  const lastBidTimeRef = useRef(null);
  
  // Get sorted items by number
  const sortedItems = [...items].sort((a, b) => a.number - b.number);
  const currentItem = currentItemIndex >= 0 ? sortedItems[currentItemIndex] : null;
  
  // End current item function (defined before useEffect that uses it)
  const endCurrentItem = useCallback(() => {
    if (!currentItem || !itemActive) return;
    
    setItemActive(false);
    
    // Determine winner
    if (currentBids.length > 0) {
      const highestBid = currentBids[currentBids.length - 1];
      const winner = highestBid.bidder;
      const amount = highestBid.amount;
      
      // Update item with winner
      setItems(items.map(item => 
        item.id === currentItem.id 
          ? { ...item, winner, winningBid: amount }
          : item
      ));
      
      // Update bidder's balance and items won
      setBidders(bidders.map(b => 
        b.name === winner 
          ? { 
              ...b, 
              balance: b.balance - amount,
              itemsWon: [...b.itemsWon, { ...currentItem, winningBid: amount }]
            }
          : b
      ));
      
      showNotification(`${currentItem.title} sold to ${winner} for $${amount}!`);
    } else {
      showNotification(`${currentItem.title} ended with no bids`);
    }
  }, [currentItem, itemActive, currentBids, items, bidders]);
  
  // Timer logic
  useEffect(() => {
    if (itemActive && currentItem) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const now = Date.now();
          const timeSinceLastBid = lastBidTimeRef.current 
            ? (now - lastBidTimeRef.current) / 1000 
            : Infinity;
          
          // End if 30 seconds since last bid
          if (timeSinceLastBid >= 30) {
            endCurrentItem();
            return 0;
          }
          
          // End if time runs out
          if (prev <= 1) {
            endCurrentItem();
            return 0;
          }
          
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [itemActive, currentItem, endCurrentItem]);
  
  // Update last bid time ref
  useEffect(() => {
    lastBidTimeRef.current = lastBidTime;
  }, [lastBidTime]);
  
  // Show notification helper
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };
  
  // Setup handlers
  const handleSetupComplete = () => {
    if (!auctioneerPassword) {
      showNotification('Please set an auctioneer password');
      return;
    }
    const allPasswordsSet = bidders.every(b => b.password);
    if (!allPasswordsSet) {
      showNotification('Please set passwords for all bidders');
      return;
    }
    setSetupComplete(true);
    showNotification('Setup complete! Ready to start auction.');
  };
  
  const handleLogin = (name, password) => {
    if (name === 'auctioneer' && password === auctioneerPassword) {
      setIsAuctioneer(true);
      setCurrentUser('auctioneer');
      showNotification('Logged in as Auctioneer');
      return;
    }
    
    const bidder = bidders.find(b => b.name === name && b.password === password);
    if (bidder) {
      setCurrentUser(name);
      setIsAuctioneer(false);
      showNotification(`Welcome, ${name}!`);
    } else {
      showNotification('Invalid credentials');
    }
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuctioneer(false);
  };
  
  // Item management
  const addItem = (item) => {
    setItems([...items, { ...item, id: generateId(), winner: null, winningBid: null }]);
    showNotification('Item added');
  };
  
  const updateItem = (id, updates) => {
    setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
    setEditingItem(null);
    showNotification('Item updated');
  };
  
  const deleteItem = (id) => {
    if (window.confirm('Delete this item?')) {
      setItems(items.filter(item => item.id !== id));
      showNotification('Item deleted');
    }
  };
  
  // Auction control
  const startItem = (index) => {
    if (itemActive) {
      showNotification('End current item first');
      return;
    }
    setCurrentItemIndex(index);
    setCurrentBids([]);
    setTimeRemaining(300);
    setItemActive(true);
    setLastBidTime(null);
    lastBidTimeRef.current = null;
    showNotification(`Started: ${sortedItems[index].title}`);
  };
  
  const startNextItem = () => {
    const nextIndex = currentItemIndex + 1;
    if (nextIndex < sortedItems.length) {
      startItem(nextIndex);
    } else {
      showNotification('No more items to auction');
    }
  };
  
  // Bidding
  const placeBid = (amount) => {
    if (!currentUser || isAuctioneer) {
      showNotification('Only bidders can place bids');
      return;
    }
    
    if (!itemActive) {
      showNotification('No active auction');
      return;
    }
    
    const bidder = bidders.find(b => b.name === currentUser);
    const currentHighBid = currentBids.length > 0 
      ? currentBids[currentBids.length - 1].amount 
      : 0;
    
    if (amount <= currentHighBid) {
      showNotification(`Bid must be higher than $${currentHighBid}`);
      return;
    }
    
    if (amount > bidder.balance) {
      showNotification(`Insufficient balance. You have $${bidder.balance}`);
      return;
    }
    
    const newBid = {
      id: generateId(),
      bidder: currentUser,
      amount,
      timestamp: Date.now()
    };
    
    setCurrentBids([...currentBids, newBid]);
    setLastBidTime(Date.now());
    setCustomBidAmount('');
    showNotification(`Bid placed: $${amount}`);
  };
  
  const handleQuickBid = (increment) => {
    const currentHigh = currentBids.length > 0 
      ? currentBids[currentBids.length - 1].amount 
      : 0;
    placeBid(currentHigh + increment);
  };
  
  // Data management
  const exportData = () => {
    const data = {
      auctioneerPassword,
      bidders,
      items,
      currentItemIndex,
      currentBids,
      setupComplete
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showNotification('Data exported');
  };
  
  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setAuctioneerPassword(data.auctioneerPassword || '');
        setBidders(data.bidders || INITIAL_BIDDERS);
        setItems(data.items || []);
        setCurrentItemIndex(data.currentItemIndex ?? -1);
        setCurrentBids(data.currentBids || []);
        setSetupComplete(data.setupComplete || false);
        showNotification('Data imported successfully');
      } catch (err) {
        showNotification('Error importing data');
      }
    };
    reader.readAsText(file);
  };
  
  const resetBalances = () => {
    if (window.confirm('Reset all balances to $500? (keeps items won)')) {
      setBidders(bidders.map(b => ({ ...b, balance: 500 })));
      showNotification('Balances reset');
    }
  };
  
  const resetAllData = () => {
    if (window.confirm('Reset ALL data? This cannot be undone!')) {
      setBidders(INITIAL_BIDDERS);
      setItems([]);
      setCurrentItemIndex(-1);
      setCurrentBids([]);
      setItemActive(false);
      setAuctioneerPassword('');
      setSetupComplete(false);
      setCurrentUser(null);
      setIsAuctioneer(false);
      showNotification('All data reset');
    }
  };
  
  const restartAuction = () => {
    if (window.confirm('Restart auction from beginning? (keeps items and bids)')) {
      setCurrentItemIndex(-1);
      setCurrentBids([]);
      setItemActive(false);
      showNotification('Auction restarted');
    }
  };
  
  // Get current user's bidder data
  const currentBidder = currentUser && !isAuctioneer 
    ? bidders.find(b => b.name === currentUser) 
    : null;
  
  const currentHighBid = currentBids.length > 0 
    ? currentBids[currentBids.length - 1] 
    : null;
  
  const isHighBidder = currentHighBid && currentBidder 
    ? currentHighBid.bidder === currentBidder.name 
    : false;

  // Render functions
  const renderSetupView = () => (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#e8f5e9' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <svg width="80" height="80" viewBox="0 0 100 100" className="mr-4">
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">DD</text>
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-blue-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            December Debutantes
          </h1>
          <p className="text-blue-900 text-xl">Christmas Auction Setup</p>
        </div>
        
        <div className="bg-white rounded-lg p-8 shadow-2xl" style={{ border: '2px solid #10b981' }}>
          <h2 className="text-2xl font-bold text-blue-900 mb-6">Auction Configuration</h2>
          
          <div className="mb-8">
            <label className="block text-blue-900 mb-2 font-semibold">Auctioneer Password</label>
            <input
              type="password"
              value={auctioneerPassword}
              onChange={(e) => setAuctioneerPassword(e.target.value)}
              className="w-full p-3 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
              placeholder="Set auctioneer password"
            />
          </div>
          
          <div className="mb-8">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Bidder Passwords</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bidders.map((bidder, idx) => (
                <div key={bidder.name}>
                  <label className="block text-blue-900 mb-1">{bidder.name}</label>
                  <input
                    type="password"
                    value={bidder.password}
                    onChange={(e) => {
                      const newBidders = [...bidders];
                      newBidders[idx].password = e.target.value;
                      setBidders(newBidders);
                    }}
                    className="w-full p-2 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
                    placeholder="Password"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleSetupComplete}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Complete Setup
            </button>
            <button
              onClick={() => setShowSetupModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              <Settings className="inline mr-2" size={20} />
              Add Items
            </button>
          </div>
        </div>
        
        <div className="mt-6 flex gap-4">
          <button
            onClick={exportData}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            <Download className="inline mr-2" size={20} />
            Export Data
          </button>
          <label className="flex-1">
            <input type="file" accept=".json" onChange={importData} className="hidden" />
            <div className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors text-center cursor-pointer">
              <Upload className="inline mr-2" size={20} />
              Import Data
            </div>
          </label>
        </div>
      </div>
      
      {showSetupModal && <ItemSetupModal />}
    </div>
  );
  
  const ItemSetupModal = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Manage Auction Items</h2>
          <button
            onClick={() => setShowSetupModal(false)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <ItemForm onSubmit={addItem} />
        
        <div className="mt-8">
          <h3 className="text-xl font-bold text-blue-900 mb-4">Items ({items.length})</h3>
          <div className="space-y-3">
            {sortedItems.map((item) => (
              <div key={item.id} className="bg-slate-700 p-4 rounded-lg flex items-center gap-4">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="w-20 h-20 object-cover rounded" />
                )}
                <div className="flex-1">
                  <div className="font-bold text-white">#{item.number} - {item.title}</div>
                  <div className="text-blue-900 text-sm">{item.description}</div>
                  {item.winner && (
                    <div className="text-blue-900 text-sm mt-1">
                      Winner: {item.winner} - ${item.winningBid}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {editingItem && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 max-w-2xl w-full">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Edit Item</h3>
            <ItemForm 
              initialData={editingItem}
              onSubmit={(data) => updateItem(editingItem.id, data)}
              onCancel={() => setEditingItem(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
  
  const ItemForm = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState(initialData || {
      number: '',
      title: '',
      description: '',
      imageUrl: ''
    });
    
    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.number || !formData.title) {
        showNotification('Number and title are required');
        return;
      }
      onSubmit(formData);
      if (!initialData) {
        setFormData({ number: '', title: '', description: '', imageUrl: '' });
      }
    };
    
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-blue-900 mb-1">Item Number</label>
          <input
            type="number"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            className="w-full p-2 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
            required
          />
        </div>
        <div>
          <label className="block text-blue-900 mb-1">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-2 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
            required
          />
        </div>
        <div>
          <label className="block text-blue-900 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-2 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
            rows="3"
          />
        </div>
        <div>
          <label className="block text-blue-900 mb-1">Image URL (Imgur)</label>
          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            className="w-full p-2 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
            placeholder="https://i.imgur.com/xxxxx.jpg"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded"
          >
            {initialData ? 'Update' : 'Add'} Item
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    );
  };
  
  const renderLoginView = () => {
    return (
      <div className="min-h-screen style={{ backgroundColor: '#e8f5e9' }}  flex items-center justify-center p-6">
        <div className="bg-white rounded-lg border-2 border-emerald-500 p-8 max-w-md w-full shadow-2xl border border-emerald-600/30">
          <div className="text-center mb-8">
            <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto mb-4">
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">DD</text>
            </svg>
            <h1 className="text-4xl font-bold text-blue-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              December Debutantes
            </h1>
            <p className="text-blue-900">Christmas Auction</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleLogin(loginName, loginPassword);
          }}>
            <div className="mb-4">
              <label className="block text-blue-900 mb-2">Name</label>
              <select
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className="w-full p-3 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
                required
              >
                <option value="">Select your name</option>
                <option value="auctioneer">Auctioneer</option>
                {bidders.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-blue-900 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-3 text-black rounded border-2 border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none" style={{ backgroundColor: '#e8f5e9' }}
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  };
  
  const renderAuctioneerView = () => (
    <div className="min-h-screen style={{ backgroundColor: '#e8f5e9' }}  p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg border-2 border-emerald-500 p-4 mb-4 flex items-center justify-between border border-emerald-600/30">
          <div className="flex items-center gap-4">
            <svg width="50" height="50" viewBox="0 0 100 100">
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">DD</text>
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-blue-900" style={{ fontFamily: 'Georgia, serif' }}>
                Auctioneer Control Panel
              </h1>
              <p className="text-slate-400">December Debutantes Auction</p>
            </div>
          </div>
          <div className="flex gap-2">
            {currentUser === 'Miguel' && (
              <button
                onClick={() => setIsAuctioneer(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded transition-colors"
              >
                <User className="inline mr-2" size={16} />
                Switch to Bidder
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition-colors"
            >
              <LogOut className="inline mr-2" size={16} />
              Logout
            </button>
          </div>
        </div>
        
        {/* Current Item Display */}
        {currentItem && (
          <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 mb-4 border border-emerald-600/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {currentItem.imageUrl && (
                  <img 
                    src={currentItem.imageUrl} 
                    alt={currentItem.title}
                    className="w-full h-96 object-cover rounded-lg"
                  />
                )}
              </div>
              <div>
                <div className="text-blue-900 text-sm mb-2">Item #{currentItem.number}</div>
                <h2 className="text-3xl font-bold text-white mb-4">{currentItem.title}</h2>
                <p className="text-blue-900 mb-6">{currentItem.description}</p>
                
                <div className="bg-slate-900 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Time Remaining:</span>
                    <span className={`text-2xl font-bold ${timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-blue-900'}`}>
                      {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                    </span>
                  </div>
                  {lastBidTime && (
                    <div className="text-slate-400 text-sm">
                      Last bid: {Math.floor((Date.now() - lastBidTime) / 1000)}s ago
                    </div>
                  )}
                </div>
                
                {currentHighBid ? (
                  <div className="bg-emerald-900/30 rounded-lg p-4 mb-4 border border-emerald-600/50">
                    <div className="text-blue-900 mb-1">Current High Bid</div>
                    <div className="text-3xl font-bold text-blue-900">${currentHighBid.amount}</div>
                    <div className="text-blue-900">by {currentHighBid.bidder}</div>
                  </div>
                ) : (
                  <div className="bg-slate-700 rounded-lg p-4 mb-4 text-center text-slate-400">
                    No bids yet
                  </div>
                )}
                
                <div className="flex gap-3">
                  {itemActive ? (
                    <button
                      onClick={endCurrentItem}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      <Square className="inline mr-2" size={20} />
                      End Item
                    </button>
                  ) : (
                    <button
                      onClick={startNextItem}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      <SkipForward className="inline mr-2" size={20} />
                      Next Item
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Bid History */}
            {currentBids.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-bold text-blue-900 mb-3">Bid History</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {[...currentBids].reverse().map((bid) => (
                    <div key={bid.id} className="bg-slate-700 p-3 rounded flex justify-between items-center">
                      <span className="text-white font-semibold">{bid.bidder}</span>
                      <span className="text-blue-900 font-bold">${bid.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Items List and Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Items */}
          <div className="lg:col-span-2 bg-white rounded-lg border-2 border-emerald-500 p-6 border border-emerald-600/30">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Auction Items ({sortedItems.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sortedItems.map((item, idx) => (
                <div 
                  key={item.id}
                  className={`p-3 rounded-lg flex items-center gap-3 ${
                    idx === currentItemIndex 
                      ? 'bg-emerald-900/50 border border-emerald-600' 
                      : item.winner 
                      ? 'bg-slate-700/50' 
                      : 'bg-slate-700'
                  }`}
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} className="w-16 h-16 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-white">#{item.number} - {item.title}</div>
                    {item.winner ? (
                      <div className="text-blue-900 text-sm">
                        <Trophy className="inline mr-1" size={14} />
                        {item.winner} - ${item.winningBid}
                      </div>
                    ) : idx === currentItemIndex ? (
                      <div className="text-blue-900 text-sm">Currently Active</div>
                    ) : (
                      <div className="text-slate-400 text-sm">Not started</div>
                    )}
                  </div>
                  {!item.winner && !itemActive && (
                    <button
                      onClick={() => startItem(idx)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded transition-colors"
                    >
                      <Play className="inline mr-1" size={16} />
                      Start
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Bidders and Controls */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 border border-emerald-600/30">
              <h3 className="text-xl font-bold text-blue-900 mb-4">Bidders</h3>
              <div className="space-y-2">
                {bidders.map((bidder) => (
                  <div key={bidder.name} className="bg-slate-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-white">{bidder.name}</span>
                      <span className="text-blue-900 font-bold">${bidder.balance}</span>
                    </div>
                    {bidder.itemsWon.length > 0 && (
                      <div className="text-slate-400 text-sm">
                        Won {bidder.itemsWon.length} item{bidder.itemsWon.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 border border-emerald-600/30">
              <h3 className="text-xl font-bold text-blue-900 mb-4">Management</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowSetupModal(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  <Settings className="inline mr-2" size={16} />
                  Manage Items
                </button>
                <button
                  onClick={resetBalances}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  <DollarSign className="inline mr-2" size={16} />
                  Reset Balances
                </button>
                <button
                  onClick={restartAuction}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  <RefreshCw className="inline mr-2" size={16} />
                  Restart Auction
                </button>
                <button
                  onClick={exportData}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  <Download className="inline mr-2" size={16} />
                  Export Data
                </button>
                <label className="block">
                  <input type="file" accept=".json" onChange={importData} className="hidden" />
                  <div className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-colors text-center cursor-pointer">
                    <Upload className="inline mr-2" size={16} />
                    Import Data
                  </div>
                </label>
                <button
                  onClick={resetAllData}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Reset All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showSetupModal && <ItemSetupModal />}
    </div>
  );
  
  const renderBidderView = () => (
    <div className="min-h-screen style={{ backgroundColor: '#e8f5e9' }}  p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg border-2 border-emerald-500 p-4 mb-4 border border-emerald-600/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="40" height="40" viewBox="0 0 100 100">
                <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">DD</text>
              </svg>
              <div>
                <h2 className="text-xl font-bold text-blue-900">Welcome, {currentBidder.name}!</h2>
                <p className="text-slate-400 text-sm">December Debutantes Auction</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded transition-colors text-sm"
            >
              <LogOut className="inline mr-1" size={14} />
              Logout
            </button>
          </div>
        </div>
        
        {/* Balance */}
        <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 mb-4 border border-emerald-600/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 mb-1">Your Balance</div>
              <div className="text-4xl font-bold text-blue-900">${currentBidder.balance}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 mb-1">Items Won</div>
              <div className="text-3xl font-bold text-white">{currentBidder.itemsWon.length}</div>
            </div>
          </div>
        </div>
        
        {/* Current Item */}
        {currentItem && itemActive ? (
          <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 mb-4 border border-emerald-600/30">
            <div className="text-blue-900 text-sm mb-2">Item #{currentItem.number}</div>
            <h2 className="text-2xl font-bold text-white mb-4">{currentItem.title}</h2>
            
            {currentItem.imageUrl && (
              <img 
                src={currentItem.imageUrl} 
                alt={currentItem.title}
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}
            
            <p className="text-blue-900 mb-6">{currentItem.description}</p>
            
            <div className="bg-slate-900 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400">Time Remaining:</span>
                <span className={`text-3xl font-bold ${timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-blue-900'}`}>
                  {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </span>
              </div>
              {timeRemaining <= 10 && (
                <div className="text-red-400 text-center font-bold animate-pulse">
                  FINAL SECONDS!
                </div>
              )}
            </div>
            
            {currentHighBid ? (
              <div className={`rounded-lg p-4 mb-4 border ${
                isHighBidder 
                  ? 'bg-emerald-900/30 border-emerald-600/50' 
                  : 'bg-slate-700 border-slate-600'
              }`}>
                <div className="text-blue-900 mb-1">
                  {isHighBidder ? 'You are the high bidder! 🎉' : 'Current High Bid'}
                </div>
                <div className="text-3xl font-bold text-blue-900">${currentHighBid.amount}</div>
                {!isHighBidder && (
                  <div className="text-blue-900">by {currentHighBid.bidder}</div>
                )}
              </div>
            ) : (
              <div className="bg-slate-700 rounded-lg p-4 mb-4 text-center text-slate-400">
                No bids yet - Be the first!
              </div>
            )}
            
            {/* Bidding Controls */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickBid(10)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  +$10
                </button>
                <button
                  onClick={() => handleQuickBid(25)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  +$25
                </button>
                <button
                  onClick={() => handleQuickBid(50)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  +$50
                </button>
                <button
                  onClick={() => handleQuickBid(100)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  +$100
                </button>
              </div>
              
              <div className="flex gap-3">
                <input
                  type="number"
                  value={customBidAmount}
                  onChange={(e) => setCustomBidAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="flex-1 p-3 text-black rounded-lg border border-slate-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
                <button
                  onClick={() => customBidAmount && placeBid(parseInt(customBidAmount))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 rounded-lg transition-colors"
                >
                  Bid
                </button>
              </div>
            </div>
            
            {/* Recent Bids */}
            {currentBids.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-blue-900 mb-3">Recent Bids</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {[...currentBids].reverse().slice(0, 5).map((bid) => (
                    <div key={bid.id} className="bg-slate-700 p-2 rounded flex justify-between items-center text-sm">
                      <span className="text-white">{bid.bidder}</span>
                      <span className="text-blue-900 font-bold">${bid.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border-2 border-emerald-500 p-8 text-center border border-emerald-600/30">
            <Gavel className="mx-auto mb-4 text-slate-600" size={64} />
            <h3 className="text-xl font-bold text-slate-400 mb-2">Waiting for Next Item</h3>
            <p className="text-slate-500">The auctioneer will start the next item shortly</p>
          </div>
        )}
        
        {/* Your Wins */}
        {currentBidder.itemsWon.length > 0 && (
          <div className="bg-white rounded-lg border-2 border-emerald-500 p-6 border border-emerald-600/30">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Your Wins</h3>
            <div className="space-y-3">
              {currentBidder.itemsWon.map((item) => (
                <div key={item.id} className="bg-slate-700 p-4 rounded-lg flex items-center gap-3">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} className="w-16 h-16 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-white">#{item.number} - {item.title}</div>
                    <div className="text-blue-900">${item.winningBid}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-600">
              <div className="flex justify-between items-center text-lg">
                <span className="text-blue-900">Total Spent:</span>
                <span className="text-blue-900 font-bold">
                  ${currentBidder.itemsWon.reduce((sum, item) => sum + item.winningBid, 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  
  // Notification Toast
  const NotificationToast = () => notification ? (
    <div className="fixed top-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
      {notification}
    </div>
  ) : null;
  
  // Main render
  return (
    <>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
      
      <NotificationToast />
      
      {!setupComplete ? (
        renderSetupView()
      ) : !currentUser ? (
        renderLoginView()
      ) : isAuctioneer ? (
        renderAuctioneerView()
      ) : currentUser === 'Miguel' && !isAuctioneer ? (
        <div className="min-h-screen style={{ backgroundColor: '#e8f5e9' }}  p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border-2 border-emerald-500 p-8 text-center border border-emerald-600/30">
              <h2 className="text-2xl font-bold text-blue-900 mb-6">Choose Your View</h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setIsAuctioneer(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 px-4 rounded-lg transition-colors"
                >
                  <Gavel className="mx-auto mb-2" size={32} />
                  Auctioneer View
                </button>
                <button
                  onClick={() => setIsAuctioneer(false)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 px-4 rounded-lg transition-colors"
                >
                  <User className="mx-auto mb-2" size={32} />
                  Bidder View
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        renderBidderView()
      )}
    </>
  );
};

export default AuctionApp;
