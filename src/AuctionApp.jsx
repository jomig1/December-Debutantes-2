import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gavel, Download, Upload, Settings, LogOut, User } from 'lucide-react';

// Color palette
const colors = {
  cream: '#f5f9f5',
  sage: '#e8f5e9',
  navy: '#1e3a8a',
  emerald: '#10b981',
  gold: '#d4af37',
  white: '#ffffff',
  text: '#000000',
  lightText: '#4a5568',
  border: '#c7e6cb'
};

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
  // Load initial data from localStorage if available
  const loadFromStorage = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  // Core state
  const [setupComplete, setSetupComplete] = useState(false);
  const [auctioneerPassword, setAuctioneerPassword] = useState(() => 
    loadFromStorage('auctioneerPassword', '')
  );
  const [bidders, setBidders] = useState(() => 
    loadFromStorage('bidders', INITIAL_BIDDERS)
  );
  const [items, setItems] = useState(() => 
    loadFromStorage('items', [])
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuctioneer, setIsAuctioneer] = useState(false);
  
  // Auction state
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  const [currentBids, setCurrentBids] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [itemActive, setItemActive] = useState(false);
  const [lastBidTime, setLastBidTime] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  
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
  
  // End current item function
  const endCurrentItem = useCallback(() => {
    if (!currentItem || !itemActive) return;
    
    setItemActive(false);
    
    if (currentBids.length > 0) {
      const highestBid = currentBids[currentBids.length - 1];
      const winner = highestBid.bidder;
      const amount = highestBid.amount;
      
      setItems(items.map(item => 
        item.id === currentItem.id 
          ? { ...item, winner, winningBid: amount }
          : item
      ));
      
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
    if (itemActive && currentItem && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const now = Date.now();
          const timeSinceLastBid = lastBidTimeRef.current 
            ? (now - lastBidTimeRef.current) / 1000 
            : Infinity;
          
          if (timeSinceLastBid >= 30) {
            endCurrentItem();
            return 0;
          }
          
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
  }, [itemActive, currentItem, endCurrentItem, isPaused]);
  
  useEffect(() => {
    lastBidTimeRef.current = lastBidTime;
  }, [lastBidTime]);
  
  // Save critical setup data to localStorage so all users see it
  useEffect(() => {
    if (auctioneerPassword) {
      localStorage.setItem('auctioneerPassword', JSON.stringify(auctioneerPassword));
    }
  }, [auctioneerPassword]);
  
  useEffect(() => {
    localStorage.setItem('bidders', JSON.stringify(bidders));
  }, [bidders]);
  
  useEffect(() => {
    localStorage.setItem('items', JSON.stringify(items));
  }, [items]);
  
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };
  
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
    showNotification('Setup complete!');
  };
  
  const handleLogin = (name, password) => {
    // Check if setup is complete
    if (!auctioneerPassword || !bidders.every(b => b.password)) {
      if (name === 'auctioneer') {
        // Allow auctioneer to login even without setup to do initial setup
        setIsAuctioneer(true);
        setCurrentUser('auctioneer');
        showNotification('Please complete setup - set all passwords and add items');
        setShowSetupModal(true);
        return;
      } else {
        showNotification('Setup incomplete - please contact auctioneer');
        return;
      }
    }
    
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
  
  const startItem = (index) => {
    if (itemActive) {
      showNotification('End current item first');
      return;
    }
    const now = Date.now();
    setCurrentItemIndex(index);
    setCurrentBids([]);
    setTimeRemaining(300);
    setItemActive(true);
    setLastBidTime(now);
    lastBidTimeRef.current = now;
    setIsPaused(false);
    showNotification(`Started: ${sortedItems[index].title}`);
  };
  
  const placeBid = (amount) => {
    if (!currentUser || isAuctioneer) {
      showNotification('Only bidders can place bids');
      return;
    }
    
    if (!itemActive) {
      showNotification('No active auction');
      return;
    }
    
    if (isPaused) {
      showNotification('Auction is paused - bidding disabled');
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
      showNotification(`Insufficient balance: $${bidder.balance}`);
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
        
        // Update state
        const newPassword = data.auctioneerPassword || '';
        const newBidders = data.bidders || INITIAL_BIDDERS;
        const newItems = data.items || [];
        
        setAuctioneerPassword(newPassword);
        setBidders(newBidders);
        setItems(newItems);
        setCurrentItemIndex(data.currentItemIndex ?? -1);
        setCurrentBids(data.currentBids || []);
        setSetupComplete(data.setupComplete || false);
        
        // Also save to localStorage so all users see it
        localStorage.setItem('auctioneerPassword', JSON.stringify(newPassword));
        localStorage.setItem('bidders', JSON.stringify(newBidders));
        localStorage.setItem('items', JSON.stringify(newItems));
        
        showNotification('Data imported');
      } catch (err) {
        showNotification('Error importing data');
      }
    };
    reader.readAsText(file);
  };
  
  const currentBidder = currentUser && !isAuctioneer 
    ? bidders.find(b => b.name === currentUser) 
    : null;
  
  const currentHighBid = currentBids.length > 0 
    ? currentBids[currentBids.length - 1] 
    : null;
  
  const isHighBidder = currentHighBid && currentBidder 
    ? currentHighBid.bidder === currentBidder.name 
    : false;

  // Reset functions
  const resetBalances = () => {
    if (window.confirm('Reset all balances to $500? (Items won will be kept)')) {
      setBidders(bidders.map(b => ({ ...b, balance: 500 })));
      showNotification('Balances reset to $500');
    }
  };
  
  const resetItemsWon = () => {
    if (window.confirm('Clear all items won from bidders? (Balances will remain unchanged)')) {
      setBidders(bidders.map(b => ({ ...b, itemsWon: [] })));
      showNotification('Items won cleared');
    }
  };
  
  const restartAuction = () => {
    if (window.confirm('Restart auction from first unwon item? (Current item will stop, already won items stay won)')) {
      setItemActive(false);
      setCurrentBids([]);
      // Find first unwon item
      const firstUnwonIndex = sortedItems.findIndex(item => !item.winner);
      if (firstUnwonIndex >= 0) {
        setCurrentItemIndex(firstUnwonIndex);
        showNotification('Auction restarted - ready to start next unwon item');
      } else {
        setCurrentItemIndex(-1);
        showNotification('All items have been won!');
      }
    }
  };
  
  const resetAllData = () => {
    if (window.confirm('⚠️ RESET EVERYTHING? This will delete all items, bids, and winners. Cannot be undone!')) {
      if (window.confirm('Are you ABSOLUTELY SURE? This action is permanent!')) {
        setBidders(INITIAL_BIDDERS);
        setItems([]);
        setCurrentItemIndex(-1);
        setCurrentBids([]);
        setItemActive(false);
        setAuctioneerPassword('');
        
        // Clear localStorage
        localStorage.removeItem('auctioneerPassword');
        localStorage.removeItem('bidders');
        localStorage.removeItem('items');
        
        showNotification('All data has been reset');
      }
    }
  };
  
  const pauseAuction = () => {
    setIsPaused(true);
    showNotification('Auction paused');
  };
  
  const resumeAuction = () => {
    setIsPaused(false);
    showNotification('Auction resumed');
  };
  
  const startNextItem = () => {
    if (itemActive) {
      showNotification('Please end current item first');
      return;
    }
    
    // Find next unwon item
    const nextUnwonIndex = sortedItems.findIndex((item, idx) => !item.winner && idx > currentItemIndex);
    
    if (nextUnwonIndex >= 0) {
      startItem(nextUnwonIndex);
    } else {
      // If no unwon items after current, check from beginning
      const firstUnwonIndex = sortedItems.findIndex(item => !item.winner);
      if (firstUnwonIndex >= 0) {
        startItem(firstUnwonIndex);
      } else {
        showNotification('All items have been won!');
      }
    }
  };

  // Styles
  const inputStyle = {
    backgroundColor: colors.sage,
    color: colors.text,
    border: `2px solid ${colors.emerald}`,
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '16px',
    width: '100%',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s'
  };

  const labelStyle = {
    color: colors.navy,
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    display: 'block',
    letterSpacing: '0.3px'
  };

  const buttonStyle = {
    backgroundColor: colors.emerald,
    color: colors.white,
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
  };

  const cardStyle = {
    backgroundColor: colors.white,
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: `1px solid ${colors.border}`
  };

  // Always show login screen first - setup is handled through auctioneer panel
  // This way bidders never see setup screen
  if (!currentUser) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.sage,
        padding: '40px 20px',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ marginBottom: '16px' }}>
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill={colors.navy} textAnchor="middle">DD</text>
            </svg>
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: 'bold', 
              color: colors.navy,
              margin: '0 0 8px 0',
              letterSpacing: '-0.5px'
            }}>
              December Debutantes
            </h1>
            <p style={{ fontSize: '20px', color: colors.lightText, margin: 0 }}>
              Christmas Auction Setup
            </p>
          </div>
          
          <div style={cardStyle}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: colors.navy,
              marginBottom: '32px',
              borderBottom: `2px solid ${colors.border}`,
              paddingBottom: '16px'
            }}>
              Auction Configuration
            </h2>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={labelStyle}>Auctioneer Password</label>
              <input
                type="password"
                value={auctioneerPassword}
                onChange={(e) => setAuctioneerPassword(e.target.value)}
                style={inputStyle}
                placeholder="Set auctioneer password"
              />
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: colors.navy,
                marginBottom: '20px'
              }}>
                Bidder Passwords
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
              }}>
                {bidders.map((bidder, idx) => (
                  <div key={bidder.name}>
                    <label style={labelStyle}>{bidder.name}</label>
                    <input
                      type="password"
                      value={bidder.password}
                      onChange={(e) => {
                        const newBidders = [...bidders];
                        newBidders[idx].password = e.target.value;
                        setBidders(newBidders);
                      }}
                      style={inputStyle}
                      placeholder="Password"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={handleSetupComplete}
                style={{ ...buttonStyle, flex: 1, minWidth: '200px' }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                Complete Setup
              </button>
              <button
                onClick={() => setShowSetupModal(true)}
                style={{ 
                  ...buttonStyle, 
                  backgroundColor: colors.navy,
                  minWidth: '200px'
                }}
              >
                <Settings size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Add Items
              </button>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: `1px solid ${colors.border}`
            }}>
              <button
                onClick={exportData}
                style={{
                  ...buttonStyle,
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`
                }}
              >
                <Download size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Export Data
              </button>
              <label>
                <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
                <div style={{
                  ...buttonStyle,
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  textAlign: 'center'
                }}>
                  <Upload size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Import Data
                </div>
              </label>
            </div>
          </div>
        </div>
        
        {showSetupModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 50
          }}>
            <div style={{
              ...cardStyle,
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                  Manage Auction Items
                </h2>
                <button
                  onClick={() => setShowSetupModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: colors.lightText
                  }}
                >
                  ✕
                </button>
              </div>
              
              <ItemForm onSubmit={addItem} colors={colors} inputStyle={inputStyle} labelStyle={labelStyle} buttonStyle={buttonStyle} />
              
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                  Items ({items.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sortedItems.map((item) => (
                    <div key={item.id} style={{
                      backgroundColor: colors.cream,
                      padding: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      border: `1px solid ${colors.border}`
                    }}>
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.title} style={{ 
                          width: '80px', 
                          height: '80px', 
                          objectFit: 'cover', 
                          borderRadius: '6px' 
                        }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: colors.navy }}>
                          #{item.number} - {item.title}
                        </div>
                        <div style={{ fontSize: '14px', color: colors.lightText, marginTop: '4px' }}>
                          {item.description}
                        </div>
                        {item.winner && (
                          <div style={{ fontSize: '14px', color: colors.emerald, marginTop: '4px' }}>
                            Winner: {item.winner} - ${item.winningBid}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setEditingItem(item)}
                          style={{
                            ...buttonStyle,
                            padding: '8px 16px',
                            fontSize: '14px',
                            boxShadow: 'none'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          style={{
                            ...buttonStyle,
                            backgroundColor: '#ef4444',
                            padding: '8px 16px',
                            fontSize: '14px',
                            boxShadow: 'none'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {editingItem && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 60
          }}>
            <div style={{ ...cardStyle, maxWidth: '600px', width: '100%' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                Edit Item
              </h3>
              <ItemForm 
                initialData={editingItem}
                onSubmit={(data) => updateItem(editingItem.id, data)}
                onCancel={() => setEditingItem(null)}
                colors={colors}
                inputStyle={inputStyle}
                labelStyle={labelStyle}
                buttonStyle={buttonStyle}
              />
            </div>
          </div>
        )}
        
        {notification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: colors.emerald,
            color: colors.white,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100,
            animation: 'slideIn 0.3s ease-out'
          }}>
            {notification}
          </div>
        )}
        
        <style>{`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }
  
  // Login view
  if (!currentUser) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.sage,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{ ...cardStyle, maxWidth: '450px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ marginBottom: '16px' }}>
              <text x="50" y="70" fontSize="60" fontFamily="Georgia, serif" fontWeight="bold" fill={colors.navy} textAnchor="middle">DD</text>
            </svg>
            <h1 style={{ 
              fontSize: '36px', 
              fontWeight: 'bold', 
              color: colors.navy,
              margin: '0 0 8px 0'
            }}>
              December Debutantes
            </h1>
            <p style={{ fontSize: '16px', color: colors.lightText, margin: 0 }}>
              Christmas Auction
            </p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            handleLogin(loginName, loginPassword);
          }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Name</label>
              <select
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select your name</option>
                <option value="auctioneer">Auctioneer</option>
                {bidders.map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            
            <button
              type="submit"
              style={{ ...buttonStyle, width: '100%' }}
            >
              Login
            </button>
          </form>
        </div>
        
        {notification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: colors.emerald,
            color: colors.white,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100
          }}>
            {notification}
          </div>
        )}
      </div>
    );
  }
  
  // Bidder view
  if (!isAuctioneer && currentBidder) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.sage,
        padding: '20px',
        fontFamily: 'Georgia, serif'
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: '0 0 4px 0' }}>
                  Welcome, {currentBidder.name}!
                </h2>
                <p style={{ fontSize: '14px', color: colors.lightText, margin: 0 }}>
                  December Debutantes Auction
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {currentBidder.name === 'Miguel' && (
                  <button
                    onClick={() => setIsAuctioneer(true)}
                    style={{
                      ...buttonStyle,
                      backgroundColor: colors.emerald,
                      padding: '8px 16px',
                      fontSize: '14px',
                      boxShadow: 'none'
                    }}
                  >
                    <Gavel size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Auctioneer
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.white,
                    color: colors.navy,
                    border: `2px solid ${colors.navy}`,
                    padding: '8px 16px',
                    fontSize: '14px',
                    boxShadow: 'none'
                  }}
                >
                  <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Logout
                </button>
              </div>
            </div>
          </div>
          
          {/* Balance */}
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                  Your Balance
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: colors.emerald }}>
                  ${currentBidder.balance}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                  Items Won
                </div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: colors.navy }}>
                  {currentBidder.itemsWon.length}
                </div>
              </div>
            </div>
          </div>
          
          {/* Current item or waiting */}
          {currentItem && itemActive ? (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: '12px', color: colors.emerald, marginBottom: '8px', fontWeight: '600' }}>
                ITEM #{currentItem.number}
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: colors.navy, margin: '0 0 16px 0' }}>
                {currentItem.title}
              </h2>
              
              {currentItem.imageUrl && (
                <img 
                  src={currentItem.imageUrl} 
                  alt={currentItem.title}
                  style={{ 
                    width: '100%', 
                    height: '300px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}
                />
              )}
              
              <p style={{ fontSize: '16px', color: colors.lightText, marginBottom: '24px', lineHeight: '1.6' }}>
                {currentItem.description}
              </p>
              
              {/* Timer */}
              <div style={{
                backgroundColor: isPaused ? 'rgba(245, 158, 11, 0.1)' : colors.cream,
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: `2px solid ${isPaused ? '#f59e0b' : timeRemaining <= 10 ? '#ef4444' : colors.border}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: colors.lightText }}>
                    {isPaused ? '⏸️ PAUSED' : 'Time Remaining:'}
                  </span>
                  <span style={{ 
                    fontSize: '28px', 
                    fontWeight: 'bold', 
                    color: isPaused ? '#f59e0b' : timeRemaining <= 10 ? '#ef4444' : colors.navy
                  }}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                  </span>
                </div>
                {isPaused && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '8px',
                    color: '#f59e0b',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    Auction paused by auctioneer
                  </div>
                )}
                {timeRemaining <= 10 && !isPaused && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '8px',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    ⚠️ FINAL SECONDS! ⚠️
                  </div>
                )}
              </div>
              
              {/* Current bid */}
              <div style={{
                backgroundColor: isHighBidder ? 'rgba(16, 185, 129, 0.1)' : colors.cream,
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: `2px solid ${isHighBidder ? colors.emerald : colors.border}`
              }}>
                <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                  {isHighBidder ? 'You are the high bidder! 🎉' : 'Current High Bid'}
                </div>
                {currentHighBid ? (
                  <>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.emerald }}>
                      ${currentHighBid.amount}
                    </div>
                    {!isHighBidder && (
                      <div style={{ fontSize: '14px', color: colors.lightText }}>
                        by {currentHighBid.bidder}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '18px', color: colors.lightText }}>
                    No bids yet - Be the first!
                  </div>
                )}
              </div>
              
              {/* Bidding buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {[10, 25, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => handleQuickBid(amount)}
                    style={buttonStyle}
                  >
                    +${amount}
                  </button>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="number"
                  value={customBidAmount}
                  onChange={(e) => setCustomBidAmount(e.target.value)}
                  placeholder="Custom amount"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => customBidAmount && placeBid(parseInt(customBidAmount))}
                  style={{ ...buttonStyle, minWidth: '100px' }}
                >
                  Bid
                </button>
              </div>
              
              {/* Recent bids */}
              {currentBids.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${colors.border}` }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                    Recent Bids
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflow: 'auto' }}>
                    {[...currentBids].reverse().slice(0, 5).map((bid) => (
                      <div key={bid.id} style={{
                        backgroundColor: colors.cream,
                        padding: '12px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '14px'
                      }}>
                        <span style={{ color: colors.navy }}>{bid.bidder}</span>
                        <span style={{ color: colors.emerald, fontWeight: 'bold' }}>${bid.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 32px' }}>
              <Gavel size={64} style={{ color: colors.lightText, margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '8px' }}>
                Waiting for Next Item
              </h3>
              <p style={{ fontSize: '16px', color: colors.lightText }}>
                The auctioneer will start the next item shortly
              </p>
            </div>
          )}
          
          {/* Your wins */}
          {currentBidder.itemsWon.length > 0 && (
            <div style={{ ...cardStyle, marginTop: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                Your Wins
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentBidder.itemsWon.map((item) => (
                  <div key={item.id} style={{
                    backgroundColor: colors.cream,
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} style={{ 
                        width: '60px', 
                        height: '60px', 
                        objectFit: 'cover', 
                        borderRadius: '6px' 
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: colors.navy }}>
                        #{item.number} - {item.title}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.emerald, marginTop: '2px' }}>
                        ${item.winningBid}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: `1px solid ${colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                <span style={{ color: colors.lightText }}>Total Spent:</span>
                <span style={{ color: colors.emerald }}>
                  ${currentBidder.itemsWon.reduce((sum, item) => sum + item.winningBid, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {notification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: colors.emerald,
            color: colors.white,
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 100
          }}>
            {notification}
          </div>
        )}
      </div>
    );
  }
  
  // Auctioneer view
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.sage,
      padding: '20px',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: colors.navy, margin: '0 0 4px 0' }}>
                Auctioneer Control Panel
              </h1>
              <p style={{ fontSize: '14px', color: colors.lightText, margin: 0 }}>
                December Debutantes Auction
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {currentUser === 'Miguel' && (
                <button
                  onClick={() => setIsAuctioneer(false)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: colors.white,
                    color: colors.navy,
                    border: `2px solid ${colors.navy}`,
                    padding: '10px 20px',
                    fontSize: '14px',
                    boxShadow: 'none'
                  }}
                >
                  <User size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Switch to Bidder
                </button>
              )}
              <button
                onClick={handleLogout}
                style={{
                  ...buttonStyle,
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  padding: '10px 20px',
                  fontSize: '14px',
                  boxShadow: 'none'
                }}
              >
                <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Logout
              </button>
            </div>
          </div>
        </div>
        
        {/* Auction Controls */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
            Auction Controls
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {!itemActive ? (
              <button
                onClick={startNextItem}
                style={{
                  ...buttonStyle,
                  backgroundColor: colors.emerald,
                  fontSize: '16px',
                  padding: '16px'
                }}
              >
                ▶️ Start Next Item
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={resumeAuction}
                    style={{
                      ...buttonStyle,
                      backgroundColor: colors.emerald,
                      fontSize: '16px',
                      padding: '16px'
                    }}
                  >
                    ▶️ Resume Auction
                  </button>
                ) : (
                  <button
                    onClick={pauseAuction}
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#f59e0b',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                      fontSize: '16px',
                      padding: '16px'
                    }}
                  >
                    ⏸️ Pause Auction
                  </button>
                )}
                <button
                  onClick={() => {
                    endCurrentItem();
                  }}
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#ef4444',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                    fontSize: '16px',
                    padding: '16px'
                  }}
                >
                  ⏹️ End Current Item
                </button>
              </>
            )}
          </div>
          {isPaused && itemActive && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#f59e0b',
              fontWeight: 'bold'
            }}>
              ⏸️ AUCTION PAUSED - Timer stopped, bidding disabled
            </div>
          )}
        </div>
        
        {/* Current Item (if active) */}
        {currentItem && itemActive && (
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: colors.emerald, marginBottom: '8px', fontWeight: '600' }}>
              CURRENTLY ACTIVE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: '0 0 8px 0' }}>
                  #{currentItem.number} - {currentItem.title}
                </h2>
                <p style={{ fontSize: '14px', color: colors.lightText, marginBottom: '16px' }}>
                  {currentItem.description}
                </p>
                {currentItem.imageUrl && (
                  <img 
                    src={currentItem.imageUrl} 
                    alt={currentItem.title}
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                )}
              </div>
              <div>
                <div style={{
                  backgroundColor: colors.cream,
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                    Time Remaining
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: timeRemaining <= 10 ? '#ef4444' : colors.navy }}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                  </div>
                </div>
                
                {currentHighBid ? (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    textAlign: 'center',
                    border: `2px solid ${colors.emerald}`
                  }}>
                    <div style={{ fontSize: '14px', color: colors.lightText, marginBottom: '4px' }}>
                      Current High Bid
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: colors.emerald }}>
                      ${currentHighBid.amount}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.navy }}>
                      by {currentHighBid.bidder}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: colors.cream,
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: colors.lightText }}>
                      No bids yet
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    endCurrentItem();
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    backgroundColor: '#ef4444',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  End Item
                </button>
              </div>
            </div>
            
            {/* Bid history */}
            {currentBids.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                  Bid History
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[...currentBids].reverse().slice(0, 10).map((bid) => (
                    <div key={bid.id} style={{
                      backgroundColor: colors.cream,
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: colors.navy, fontWeight: 'bold' }}>{bid.bidder}</span>
                      <span style={{ color: colors.lightText, margin: '0 4px' }}>•</span>
                      <span style={{ color: colors.emerald, fontWeight: 'bold' }}>${bid.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          {/* Items List */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                Auction Items ({sortedItems.length})
              </h3>
              <button
                onClick={() => setShowSetupModal(true)}
                style={{
                  ...buttonStyle,
                  padding: '8px 16px',
                  fontSize: '14px',
                  boxShadow: 'none'
                }}
              >
                <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Manage
              </button>
            </div>
            <div style={{ maxHeight: '600px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedItems.map((item, idx) => (
                <div key={item.id} style={{
                  backgroundColor: idx === currentItemIndex ? 'rgba(16, 185, 129, 0.1)' : colors.cream,
                  padding: '12px',
                  borderRadius: '8px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  border: idx === currentItemIndex ? `2px solid ${colors.emerald}` : `1px solid ${colors.border}`
                }}>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} style={{ 
                      width: '60px', 
                      height: '60px', 
                      objectFit: 'cover', 
                      borderRadius: '6px' 
                    }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: colors.navy, fontSize: '14px' }}>
                      #{item.number} - {item.title}
                    </div>
                    {item.winner ? (
                      <div style={{ fontSize: '12px', color: colors.emerald, marginTop: '2px' }}>
                        Winner: {item.winner} - ${item.winningBid}
                      </div>
                    ) : idx === currentItemIndex ? (
                      <div style={{ fontSize: '12px', color: colors.emerald, marginTop: '2px' }}>
                        Currently Active
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: colors.lightText, marginTop: '2px' }}>
                        Not started
                      </div>
                    )}
                  </div>
                  {!item.winner && !itemActive && idx !== currentItemIndex && (
                    <button
                      onClick={() => startItem(idx)}
                      style={{
                        ...buttonStyle,
                        padding: '6px 16px',
                        fontSize: '14px',
                        boxShadow: 'none'
                      }}
                    >
                      Start
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Bidders Panel */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Bidders
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bidders.map((bidder) => (
                <div key={bidder.name} style={{
                  backgroundColor: colors.cream,
                  padding: '12px',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: colors.navy }}>{bidder.name}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: colors.emerald }}>
                      ${bidder.balance}
                    </span>
                  </div>
                  {bidder.itemsWon.length > 0 && (
                    <div style={{ fontSize: '12px', color: colors.lightText }}>
                      Won {bidder.itemsWon.length} item{bidder.itemsWon.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
              <button
                onClick={() => setShowSetupModal(true)}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.emerald,
                  marginBottom: '20px'
                }}
              >
                <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Setup Passwords & Items
              </button>
              
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                Data Management
              </h4>
              <button
                onClick={exportData}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  boxShadow: 'none',
                  marginBottom: '8px'
                }}
              >
                <Download size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Export Data
              </button>
              <label style={{ display: 'block', marginBottom: '20px' }}>
                <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
                <div style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: colors.white,
                  color: colors.navy,
                  border: `2px solid ${colors.navy}`,
                  boxShadow: 'none',
                  textAlign: 'center'
                }}>
                  <Upload size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Import Data
                </div>
              </label>
              
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                Reset Options
              </h4>
              <button
                onClick={restartAuction}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  marginBottom: '8px'
                }}
              >
                ↻ Restart from Next Unwon Item
              </button>
              <button
                onClick={resetBalances}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  marginBottom: '8px'
                }}
              >
                💰 Reset All Balances to $500
              </button>
              <button
                onClick={resetItemsWon}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#f59e0b',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  marginBottom: '8px'
                }}
              >
                🏆 Clear All Items Won
              </button>
              <button
                onClick={resetAllData}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                }}
              >
                ⚠️ Reset Everything
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showSetupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 50
        }}>
          <div style={{
            ...cardStyle,
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: colors.navy, margin: 0 }}>
                Setup & Manage Auction
              </h2>
              <button
                onClick={() => setShowSetupModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: colors.lightText
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Password Setup Section */}
            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: `2px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                Password Setup
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Auctioneer Password</label>
                <input
                  type="password"
                  value={auctioneerPassword}
                  onChange={(e) => setAuctioneerPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="Set auctioneer password"
                />
              </div>
              
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.navy, marginBottom: '12px' }}>
                Bidder Passwords
              </h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px'
              }}>
                {bidders.map((bidder, idx) => (
                  <div key={bidder.name}>
                    <label style={labelStyle}>{bidder.name}</label>
                    <input
                      type="password"
                      value={bidder.password}
                      onChange={(e) => {
                        const newBidders = [...bidders];
                        newBidders[idx].password = e.target.value;
                        setBidders(newBidders);
                      }}
                      style={inputStyle}
                      placeholder="Password"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Manage Items
            </h3>
            
            <ItemForm onSubmit={addItem} colors={colors} inputStyle={inputStyle} labelStyle={labelStyle} buttonStyle={buttonStyle} />
            
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
                Items ({items.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedItems.map((item) => (
                  <div key={item.id} style={{
                    backgroundColor: colors.cream,
                    padding: '16px',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    border: `1px solid ${colors.border}`
                  }}>
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} style={{ 
                        width: '80px', 
                        height: '80px', 
                        objectFit: 'cover', 
                        borderRadius: '6px' 
                      }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: colors.navy }}>
                        #{item.number} - {item.title}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.lightText, marginTop: '4px' }}>
                        {item.description}
                      </div>
                      {item.winner && (
                        <div style={{ fontSize: '14px', color: colors.emerald, marginTop: '4px' }}>
                          Winner: {item.winner} - ${item.winningBid}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setEditingItem(item)}
                        style={{
                          ...buttonStyle,
                          padding: '8px 16px',
                          fontSize: '14px',
                          boxShadow: 'none'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        style={{
                          ...buttonStyle,
                          backgroundColor: '#ef4444',
                          padding: '8px 16px',
                          fontSize: '14px',
                          boxShadow: 'none'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {editingItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 60
        }}>
          <div style={{ ...cardStyle, maxWidth: '600px', width: '100%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.navy, marginBottom: '16px' }}>
              Edit Item
            </h3>
            <ItemForm 
              initialData={editingItem}
              onSubmit={(data) => updateItem(editingItem.id, data)}
              onCancel={() => setEditingItem(null)}
              colors={colors}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
              buttonStyle={buttonStyle}
            />
          </div>
        </div>
      )}
      
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: colors.emerald,
          color: colors.white,
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100
        }}>
          {notification}
        </div>
      )}
    </div>
  );
};

// Item form component
const ItemForm = ({ initialData, onSubmit, onCancel, colors, inputStyle, labelStyle, buttonStyle }) => {
  const [formData, setFormData] = useState(initialData || {
    number: '',
    title: '',
    description: '',
    imageUrl: ''
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.number || !formData.title) {
      alert('Number and title are required');
      return;
    }
    onSubmit(formData);
    if (!initialData) {
      setFormData({ number: '', title: '', description: '', imageUrl: '' });
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Item Number</label>
          <input
            type="number"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={inputStyle}
            required
          />
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Image URL (Imgur)</label>
        <input
          type="url"
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          style={inputStyle}
          placeholder="https://i.imgur.com/xxxxx.jpg"
        />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="submit"
          style={{ ...buttonStyle, flex: 1 }}
        >
          {initialData ? 'Update' : 'Add'} Item
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              ...buttonStyle,
              backgroundColor: colors.white,
              color: colors.navy,
              border: `2px solid ${colors.navy}`
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default AuctionApp;
